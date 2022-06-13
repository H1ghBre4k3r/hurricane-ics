import fetch from "node-fetch";
import { FestivalPlan } from "./types";

/**
 * Fetch the festival plan by scraping the lineup website.
 */
export const fetchFestivalFactory = () => {
    let last_fetch: Date | null = null;

    let cache: FestivalPlan | null = null;

    return async (): Promise<FestivalPlan> => {
        const now = new Date();
        var diffMs = now.getTime() - (last_fetch?.getTime() ?? 0);
        const diff = Math.round(((diffMs % 86400000) % 3600000) / 60000);

        if (diff > 15) {
            console.log("fetccch");
            const response = await fetch("https://hurricane.de/de/line-up");
            const raw = await response.text();
            const match = /var\s+timetableEvents\s*=\s*(\{.+?\});/.exec(raw);
            cache = match ? JSON.parse(match[1]) : { shows: [] };
            last_fetch = now;
        }

        return cache as FestivalPlan;
    };
};
