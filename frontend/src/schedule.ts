import { Show } from "../../src/types";
import { parseDate } from "./utils";

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

export const getShowStart = (show: Show): Date => {
  return parseDate(show.date_start, show.time_start);
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
  return formatTimeRange(getShowStart(show), getShowEnd(show));
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
      events: sortShowsByStart(
        day.events.filter((show) => selections[show.artist.name]),
      ),
    }))
    .filter((day) => day.events.length > 0);
};

export const buildConflictMap = (selectedShows: Show[]): ShowConflictMap => {
  const conflicts: ShowConflictMap = {};

  selectedShows.forEach((show, index) => {
    selectedShows.slice(index + 1).forEach((otherShow) => {
      if (
        show.date_start !== otherShow.date_start ||
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

      conflicts[show.artist.name] = [
        ...(conflicts[show.artist.name] || []),
        { artist: otherShow.artist.name, overlap },
      ];
      conflicts[otherShow.artist.name] = [
        ...(conflicts[otherShow.artist.name] || []),
        { artist: show.artist.name, overlap },
      ];
    });
  });

  return conflicts;
};
