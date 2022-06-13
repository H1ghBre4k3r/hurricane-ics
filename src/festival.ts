import fetch from "node-fetch";
import { FestivalPlan } from "./types";

/**
 * Fetch the festival plan by scraping the lineup website.
 */
export const fetchFestival = async (): Promise<FestivalPlan> => {
    const response = await fetch("https://hurricane.de/de/line-up");
    const raw = await response.text();
    const match = /var\s+timetableEvents\s*=\s*(\{.+?\});/.exec(raw);
    return match ? JSON.parse(match[1]) : { shows: [] };
};
