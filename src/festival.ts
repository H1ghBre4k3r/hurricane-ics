import fetch from "node-fetch";
import { createHash } from "crypto";
import {
  FestivalDateRange,
  FestivalFetchStatus,
  FestivalPlan,
  LineupParseWarning,
  UpstreamLineupHealth,
  Show,
} from "./types";

const LINEUP_URL = "https://hurricane.de/line-up/";
const LINEUP_USER_AGENT =
  process.env.LINEUP_USER_AGENT ||
  "hurricane-ics-scraper/1.0 (+https://github.com/H1ghBre4k3r/hurricane-ics)";
const DEFAULT_MARKER_ALLOWLIST = [
  "m0132_lineupv2",
  "m0132_lineupv2__day",
  "m0132_lineupv2__show",
  "m0132_lineupv2__artist",
  "m0132_lineupv2__time",
  "m0132_lineupv2__stage",
  "m0132_lineupv2__category",
];
const DEFAULT_IMAGE_URL = "/fileadmin/placeholder-image.jpg";

function diff_minutes(dt2: Date, dt1: Date) {
  const diff = (dt2.getTime() - dt1.getTime()) / 1000 / 60;
  return Math.abs(Math.round(diff));
}

const getUpstreamMarkerAllowlist = (): string[] => {
  const envValue = process.env.LINEUP_MARKER_ALLOWLIST;
  if (!envValue) {
    return DEFAULT_MARKER_ALLOWLIST;
  }

  const entries = envValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.length ? entries : DEFAULT_MARKER_ALLOWLIST;
};

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
  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `<[^>]*class="[^"]*${escapedClassName}[^"]*"[^>]*>([\\s\\S]*?)</[^>]+>`,
  ).exec(value);
  return match ? stripTags(match[1]) : "";
};

const extractImage = (value: string): string => {
  return (
    extractAttribute(value, "data-image-imageSrc") ||
    extractAttribute(value, "data-src") ||
    extractAttribute(value, "src")
  );
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
  const [day, month] = rawDay
    .split("-")
    .map((part) => parseInt(part, 10));

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

const getLineupDateRange = (
  festival: FestivalPlan | null,
): FestivalDateRange | null => {
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

type ParsedFestivalPlanResult = {
  festival: FestivalPlan;
  warnings: LineupParseWarning[];
  missingMarkers: string[];
  markerAllowlist: string[];
};

const warnMissingMarker = (marker: string): LineupParseWarning => ({
  code: "missing",
  message: `Missing expected lineup marker: ${marker}`,
});

const warnInvalidShow = (artist: string, reason: string): LineupParseWarning => ({
  code: "invalid",
  message: `${artist ? `${artist}:` : "Show:"} ${reason}`,
});

const parseIntOrZero = (value: string): number => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const withFallback = (
  value: string,
  fallback: string,
  artist: string,
  field: string,
): string => {
  if (value) {
    return value;
  }

  console.warn(
    JSON.stringify({
      event: "lineup-show-fallback",
      artist,
      field,
    }),
  );

  return fallback;
};

export const parseFestivalPlanWithDiagnostics = (
  raw: string,
  markerAllowlist: string[] = DEFAULT_MARKER_ALLOWLIST,
): ParsedFestivalPlanResult => {
  const warnings = markerAllowlist
    .filter((marker) => !raw.includes(marker))
    .map(warnMissingMarker);

  const year = parseLineupYear(raw);
  const shows: Show[] = [];
  const dayRegex =
    /<div[^>]*class="[^"]*m0132_lineupv2__day[^"]*"[^>]*\bdata-day="(\d{2}-\d{2})"[^>]*>/g;
  const days = collectMatches(dayRegex, raw);
  if (process.env.DEBUG_PARSER === "1") {
    console.log(
      JSON.stringify({
        event: "parser-debug",
        dayCount: days.length,
        markers: markerAllowlist.filter((marker) => !raw.includes(marker)),
        sample: raw.slice(0, 80),
      }),
    );
  }

  days.forEach((dayMatch, index) => {
    const dayStart = dayMatch.index || 0;
    const nextDayStart = days[index + 1]?.index || raw.length;
    const dayHtml = raw.slice(dayStart, nextDayStart);
    const dateStart = parseDateStart(year, dayMatch[1]);
    const showRegex = /<a[^>]*class="[^"]*m0132_lineupv2__show[^"]*"([^>]*)>([\s\S]*?)<\/a>/g;

    if (process.env.DEBUG_PARSER === "1") {
      const debugShows = collectMatches(showRegex, dayHtml);
      console.log(
        JSON.stringify({
          event: "parser-debug-day",
          day: dayMatch[1],
          showCount: debugShows.length,
          showRegex: showRegex.source,
          dayHtmlSample: dayHtml.slice(0, 120),
        }),
      );

      showRegex.lastIndex = 0;
    }

    collectMatches(showRegex, dayHtml).forEach((showMatch) => {
      const attributes = showMatch[1];
      const showHtml = showMatch[2];
      const rawTime = extractText(showHtml, "m0132_lineupv2__time");
      const timeMatch = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(rawTime);

      if (!timeMatch) {
        warnings.push(warnInvalidShow("unknown", "time range missing"));
        return;
      }

      const artistName = extractText(showHtml, "m0132_lineupv2__artist");
      const stageName = extractText(showHtml, "m0132_lineupv2__stage");
      const categoryName = extractText(showHtml, "m0132_lineupv2__category");
      const image = extractImage(showHtml);
      const detailUrl = extractAttribute(attributes, "href");

      const artist = withFallback(artistName, "Unknown Artist", "unknown", "artist");
      const stage = withFallback(stageName, "Unknown Stage", artist, "stage");
      const category = withFallback(
        categoryName,
        "Unknown Category",
        artist,
        "category",
      );
      const resolvedImage = withFallback(image, DEFAULT_IMAGE_URL, artist, "image");
      const resolvedDetailUrl = withFallback(
        detailUrl,
        "/line-up/",
        artist,
        "details_url",
      );

      if (!artistName || !stageName || !categoryName || !image || !detailUrl) {
        warnings.push(warnInvalidShow(artist, "fallback fields were used"));
      }

      shows.push({
        category: {
          id: parseIntOrZero(extractAttribute(attributes, "data-category")),
          name: category,
        },
        stage: {
          id: parseIntOrZero(extractAttribute(attributes, "data-stage")),
          name: stage,
        },
        date_timestamp: `${dateStart}${timeMatch[1].replace(":", "")}`,
        date_start: dateStart,
        time_start: timeMatch[1],
        time_end: timeMatch[2],
        artist: {
          name: artist,
          description: "",
          image: resolvedImage,
          details_url: resolvedDetailUrl,
          url: resolvedDetailUrl,
        },
        teasertype: 0,
      });
    });
  });

  return {
    festival: { shows },
    warnings,
    missingMarkers: markerAllowlist.filter((marker) => !raw.includes(marker)),
    markerAllowlist,
  };
};

export const parseFestivalPlan = (raw: string): FestivalPlan => {
  return parseFestivalPlanWithDiagnostics(raw).festival;
};

const logLineupWarnings = (warnings: LineupParseWarning[]) => {
  if (!warnings.length) {
    return;
  }

  console.warn(
    JSON.stringify({
      event: "lineup-parse-warnings",
      count: warnings.length,
      warnings: warnings.map((warning) => warning.message),
    }),
  );
};

const hashLineup = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex").slice(0, 24);

/**
 * Fetch the festival plan by scraping the lineup website.
 */
export const fetchFestivalFactory = () => {
  let last_fetch: Date = new Date();

  let cache: FestivalPlan | null = null;
  let lastSuccessfulFetch: Date | null = null;
  let lastAttemptedFetch: Date | null = null;
  let lastError: string | null = null;
  let staleReason: string | null = null;
  let stale = false;
  let health: UpstreamLineupHealth | null = null;
  const markerAllowlist = getUpstreamMarkerAllowlist();

  const fetchFestival = async (): Promise<FestivalPlan> => {
    const now = new Date();
    const diff = diff_minutes(now, last_fetch);

    if (diff > 15 || cache === null) {
      lastAttemptedFetch = now;

      try {
        const response = await fetch(LINEUP_URL, {
          headers: {
            "User-Agent": LINEUP_USER_AGENT,
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch ${LINEUP_URL}: ${response.status}`);
        }

        const raw = await response.text();
        const {
          festival,
          warnings,
          missingMarkers,
          markerAllowlist: usedMarkerAllowlist,
        } = parseFestivalPlanWithDiagnostics(raw, markerAllowlist);

        logLineupWarnings(warnings);

        if (!festival.shows.length) {
          throw new Error(`No valid shows found while parsing ${LINEUP_URL}`);
        }

        cache = festival;
        last_fetch = now;
        lastSuccessfulFetch = now;
        stale = false;
        lastError = null;
        health = {
          url: LINEUP_URL,
          lineupTimestamp: new Date().toISOString(),
          sourceMarker: hashLineup(raw),
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          parsedShowCount: festival.shows.length,
          requiredMarkers: usedMarkerAllowlist,
          missingMarkers,
          parseWarnings: warnings,
        };
        staleReason = null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          JSON.stringify({
            event: "lineup-fetch-failed",
            url: LINEUP_URL,
            message,
          }),
        );
        lastError = message;
        staleReason = message;
        stale = true;

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
    stale,
    staleReason,
    lastSuccessfulFetch: lastSuccessfulFetch?.toISOString() || null,
    lastAttemptedFetch: lastAttemptedFetch?.toISOString() || null,
    showCount: cache?.shows.length || 0,
    lineupDateRange: getLineupDateRange(cache),
    lastError,
    health,
  });

  return fetchFestival;
};
