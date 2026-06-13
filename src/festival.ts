import fetch from "node-fetch";
import { FestivalFetchStatus, FestivalPlan, FestivalDateRange, Show } from "./types";

const LINEUP_URL = "https://hurricane.de/line-up/";

function diff_minutes(dt2: Date, dt1: Date) {
  var diff = (dt2.getTime() - dt1.getTime()) / 1000;
  diff /= 60;
  return Math.abs(Math.round(diff));
}

const decodeHtml = (value: string): string => {
  const namedEntities: { [key: string]: string } = {
    Auml: "Ä",
    amp: "&",
    apos: "'",
    auml: "ä",
    gt: ">",
    lt: "<",
    nbsp: " ",
    Ouml: "Ö",
    ouml: "ö",
    quot: '"',
    szlig: "ß",
    Uuml: "Ü",
    uuml: "ü",
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity) => {
    if (entity[0] === "#") {
      const radix = entity[1].toLowerCase() === "x" ? 16 : 10;
      const rawCodePoint = entity[1].toLowerCase() === "x"
        ? entity.substring(2)
        : entity.substring(1);
      const codePoint = parseInt(rawCodePoint, radix);
      return Number.isNaN(codePoint) ? `&${entity};` : String.fromCodePoint(codePoint);
    }
    return namedEntities[entity] || `&${entity};`;
  });
};

const stripTags = (value: string): string => {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
};

const extractAttribute = (value: string, attribute: string): string => {
  const match = new RegExp(`${attribute}="([^"]*)"`).exec(value);
  return match ? decodeHtml(match[1]) : "";
};

const extractText = (value: string, className: string): string => {
  const match = new RegExp(
    `<[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
  ).exec(value);
  return match ? stripTags(match[1]) : "";
};

const extractImage = (value: string): string => {
  return extractAttribute(value, "data-image-imageSrc")
    || extractAttribute(value, "data-src")
    || extractAttribute(value, "src");
};

const parseLineupYear = (raw: string): number => {
  const headlineMatch = /<span>\s*LINE-UP\s*<\/span>\s*(\d{4})/.exec(raw);
  if (headlineMatch) {
    return parseInt(headlineMatch[1], 10);
  }

  const descriptionMatch = /content="[^"]*?(\d{4})\s*\/\/\s*Schee/i.exec(raw);
  if (descriptionMatch) {
    return parseInt(descriptionMatch[1], 10);
  }

  return new Date().getFullYear();
};

const parseDateStart = (year: number, rawDay: string): string => {
  const [day, month] = rawDay.split("-").map((part) => parseInt(part, 10));
  return `${year.toString().slice(2)}${month.toString().padStart(2, "0")}${day
    .toString()
    .padStart(2, "0")}`;
};

const collectMatches = (regex: RegExp, value: string): RegExpExecArray[] => {
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(value)) !== null) {
    matches.push(match);
  }

  return matches;
};

const getLineupDateRange = (festival: FestivalPlan | null): FestivalDateRange | null => {
  if (!festival?.shows.length) {
    return null;
  }

  const dates = Array.from(
    new Set(festival.shows.map((show) => show.date_start)),
  ).sort();

  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
};

export const parseFestivalPlan = (raw: string): FestivalPlan => {
  const year = parseLineupYear(raw);
  const shows: Show[] = [];
  const dayRegex = /<div class="m0132_lineupv2__day" data-day="(\d{2}-\d{2})">/g;
  const days = collectMatches(dayRegex, raw);

  days.forEach((dayMatch, index) => {
    const dayStart = dayMatch.index || 0;
    const nextDayStart = days[index + 1]?.index || raw.length;
    const dayHtml = raw.slice(dayStart, nextDayStart);
    const dateStart = parseDateStart(year, dayMatch[1]);
    const showRegex = /<a class="m0132_lineupv2__show"([^>]*)>([\s\S]*?)<\/a>/g;

    collectMatches(showRegex, dayHtml).forEach((showMatch) => {
      const attributes = showMatch[1];
      const showHtml = showMatch[2];
      const rawTime = extractText(showHtml, "m0132_lineupv2__time");
      const timeMatch = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(rawTime);

      if (!timeMatch) {
        return;
      }

      const artistName = extractText(showHtml, "m0132_lineupv2__artist");
      const stageName = extractText(showHtml, "m0132_lineupv2__stage");
      const categoryName = extractText(showHtml, "m0132_lineupv2__category");

      if (!artistName || !stageName || !categoryName) {
        return;
      }

      shows.push({
        category: {
          id: parseInt(extractAttribute(attributes, "data-category"), 10),
          name: categoryName,
        },
        stage: {
          id: parseInt(extractAttribute(attributes, "data-stage"), 10),
          name: stageName,
        },
        date_timestamp: `${dateStart}${timeMatch[1].replace(":", "")}`,
        date_start: dateStart,
        time_start: timeMatch[1],
        time_end: timeMatch[2],
        artist: {
          name: artistName,
          description: "",
          image: extractImage(showHtml),
          details_url: extractAttribute(attributes, "href"),
          url: extractAttribute(attributes, "href"),
        },
        teasertype: 0,
      });
    });
  });

  return { shows };
};

/**
 * Fetch the festival plan by scraping the lineup website.
 */
export const fetchFestivalFactory = () => {
  let last_fetch: Date = new Date();

  let cache: FestivalPlan | null = null;
  let lastSuccessfulFetch: Date | null = null;
  let lastAttemptedFetch: Date | null = null;
  let lastError: string | null = null;

  const fetchFestival = async (): Promise<FestivalPlan> => {
    const now = new Date();
    const diff = diff_minutes(now, last_fetch);

    if (diff > 15 || cache === null) {
      lastAttemptedFetch = now;

      try {
        const response = await fetch(LINEUP_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${LINEUP_URL}: ${response.status}`);
        }

        const raw = await response.text();
        const festival = parseFestivalPlan(raw);
        if (!festival.shows.length) {
          throw new Error(`No shows found while parsing ${LINEUP_URL}`);
        }

        cache = festival;
        last_fetch = now;
        lastSuccessfulFetch = now;
        lastError = null;
      } catch (error) {
        console.error(error);
        lastError = error instanceof Error ? error.message : String(error);
        if (cache === null) {
          throw error;
        }
        last_fetch = now;
      }
    }

    return cache as FestivalPlan;
  };

  fetchFestival.getStatus = (): FestivalFetchStatus => ({
    cacheAvailable: cache !== null,
    lastSuccessfulFetch: lastSuccessfulFetch?.toISOString() || null,
    lastAttemptedFetch: lastAttemptedFetch?.toISOString() || null,
    showCount: cache?.shows.length || 0,
    lineupDateRange: getLineupDateRange(cache),
    lastError,
  });

  return fetchFestival;
};
