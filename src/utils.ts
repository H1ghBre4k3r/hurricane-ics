import { ICalEventData } from "ical-generator";
import { Show } from "./types";

export const FESTIVAL_DAY_ROLLOVER_HOUR = 6;

export const eventFactory = (show: Show): ICalEventData => {
  const start = getShowStart(show);
  const end = getShowEnd(show);

  return {
    summary: show.artist.name,
    location: show.stage.name,
    start,
    end,
    description: {
      plain: show.artist.description,
      html: show.artist.description,
    },
    url: `https://hurricane.de${show.artist.details_url}`,
    timezone: "Europe/Berlin",
  };
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

export const isFestivalNightRollover = (rawTime: string): boolean => {
  const [hour] = /(\d+):(\d+)/
    .exec(rawTime)!
    .slice(1)
    .map((d) => parseInt(d, 10));

  return hour < FESTIVAL_DAY_ROLLOVER_HOUR;
};

export const parseDate = (rawDate: string, rawTime: string): Date => {
  const [year, month, day] = /(\d\d)(\d\d)(\d\d)/
    .exec(rawDate)!
    .slice(1)
    .map((d) => parseInt(d, 10));
  const [hour, minute] = /(\d+):(\d+)/
    .exec(rawTime)!
    .slice(1)
    .map((d) => parseInt(d, 10));
  return new Date(2000 + year, month - 1, day, hour, minute);
};
