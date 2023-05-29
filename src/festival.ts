import fetch from "node-fetch";
import { FestivalPlan } from "./types";

function diff_minutes(dt2: Date, dt1: Date) {
  var diff = (dt2.getTime() - dt1.getTime()) / 1000;
  diff /= 60;
  return Math.abs(Math.round(diff));
}

/**
 * Fetch the festival plan by scraping the lineup website.
 */
export const fetchFestivalFactory = () => {
  let last_fetch: Date = new Date();

  let cache: FestivalPlan | null = null;

  return async (): Promise<FestivalPlan> => {
    const now = new Date();
    const diff = diff_minutes(now, last_fetch);

    if (diff > 15 || cache === null) {
      const response = await fetch("https://hurricane.de/de/line-up");
      const raw = await response.text();
      const match = /var\s+timetableEvents\s*=\s*(\{[\s\S]+?\});/.exec(raw);
      cache = match ? JSON.parse(match[1]) : { shows: [] };
      last_fetch = now;
    }

    return cache as FestivalPlan;
  };
};
