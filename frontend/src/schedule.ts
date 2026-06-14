import { Show } from "../../src/types";
import { parseDate } from "./utils";

export const FESTIVAL_DAY_ROLLOVER_HOUR = 6;

export type FestivalDay = {
  day: string;
  events: Show[];
};

export type ConflictDetail = {
  artist: string;
  overlap: string;
};

export type ShowConflictMap = {
  [artist: string]: ConflictDetail[];
};

export const normalize = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

export const formatDayLabel = (rawDay: string): string => {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(parseDate(rawDay, "00:00"));
};

export const isFestivalNightRollover = (rawTime: string): boolean => {
  const [hour] = /(\d+):(\d+)/
    .exec(rawTime)!
    .slice(1)
    .map((d) => parseInt(d, 10));

  return hour < FESTIVAL_DAY_ROLLOVER_HOUR;
};

export const getShowStart = (show: Show): Date => {
  const start = parseDate(show.date_start, show.time_start);

  if (isFestivalNightRollover(show.time_start)) {
    start.setDate(start.getDate() + 1);
  }

  return start;
};

export const getShowEnd = (show: Show): Date => {
  const start = getShowStart(show);
  const end = parseDate(show.date_start, show.time_end);

  while (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return end;
};

export const formatTimeRange = (start: Date, end: Date): string => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

export const formatShowTime = (show: Show): string => {
  const start = getShowStart(show);
  const timeRange = formatTimeRange(start, getShowEnd(show));

  if (!isFestivalNightRollover(show.time_start)) {
    return timeRange;
  }

  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
  }).format(start);

  return `${weekday} ${timeRange}`;
};

export const formatConflictOverlap = (start: Date, end: Date): string => {
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const hour = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  const minutePart = `${remainder}m`;
  if (!hour) {
    return `${minutePart} overlap`;
  }

  return `${hour}h ${minutePart} overlap`;
};

export const showsOverlap = (a: Show, b: Show): boolean => {
  return getShowStart(a) < getShowEnd(b) && getShowStart(b) < getShowEnd(a);
};

export const sortShowsByStart = (shows: Show[]): Show[] => {
  return [...shows].sort(
    (a, b) => getShowStart(a).getTime() - getShowStart(b).getTime(),
  );
};

export const getImageUrl = (image: string): string => {
  if (!image) {
    return "";
  }

  return image.startsWith("http") ? image : `https://hurricane.de${image}`;
};

export const groupSelectedShowsByDay = (
  festival: FestivalDay[],
  selections: { [key: string]: boolean },
): FestivalDay[] => {
  return festival
    .map((day) => ({
      day: day.day,
      events: deduplicateShowsByArtist(
        sortShowsByStart(day.events.filter((show) => selections[show.artist.name])),
      ),
    }))
    .filter((day) => day.events.length > 0);
};

export const buildConflictMap = (selectedShows: Show[]): ShowConflictMap => {
  const conflicts: ShowConflictMap = {};
  const dedupedShows = deduplicateShowsByArtist(selectedShows);

  dedupedShows.forEach((show, index) => {
    dedupedShows.slice(index + 1).forEach((otherShow) => {
      if (
        !showsOverlap(show, otherShow)
      ) {
        return;
      }

      const overlapStart = new Date(
        Math.max(
          getShowStart(show).getTime(),
          getShowStart(otherShow).getTime(),
        ),
      );
      const overlapEnd = new Date(
        Math.min(getShowEnd(show).getTime(), getShowEnd(otherShow).getTime()),
      );
      const overlap = formatTimeRange(overlapStart, overlapEnd);
      const overlapDuration = formatConflictOverlap(overlapStart, overlapEnd);
      const overlapText = `${overlap} (${overlapDuration})`;

      conflicts[show.artist.name] = [
        ...(conflicts[show.artist.name] || []),
        { artist: otherShow.artist.name, overlap: overlapText },
      ];
      conflicts[otherShow.artist.name] = [
        ...(conflicts[otherShow.artist.name] || []),
        { artist: show.artist.name, overlap: overlapText },
      ];
    });
  });

  return conflicts;
};

export const deduplicateShowsByArtist = (shows: Show[]): Show[] => {
  const grouped = new Map<string, Show[]>();

  for (const show of shows) {
    const key = show.artist.name;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, [show]);
      continue;
    }

    existing.push(show);
  }

  const deduped: Show[] = [];

  grouped.forEach((group) => {
    if (group.length === 1) {
      deduped.push(group[0]);
      return;
    }

    const canonical = [...group].sort((a, b) => {
      const diff = getShowEnd(b).getTime() - getShowEnd(a).getTime();
      if (diff !== 0) {
        return diff;
      }

      const startDiff = getShowStart(b).getTime() - getShowStart(a).getTime();
      if (startDiff !== 0) {
        return startDiff;
      }

      if (a.stage.name !== b.stage.name) {
        return a.stage.name.localeCompare(b.stage.name);
      }

      return a.time_start.localeCompare(b.time_start);
    })[0];

    deduped.push(canonical);
  });

  return deduped;
};
