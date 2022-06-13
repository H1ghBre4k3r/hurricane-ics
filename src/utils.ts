import { ICalEventData } from "ical-generator";
import { ConcertDate, Day, Show } from "./types";

export const event = (day: Day, hour: number, minutes = 0): Date => {
    return new Date(2022, 5, 16 + day, hour, minutes);
};

export function date(hours: number, minutes = 0): ConcertDate {
    return {
        hours,
        minutes,
    };
}

export const eventFactory = (show: Show): ICalEventData => {
    const start = parseDate(show.date_start, show.time_start);
    const end = parseDate(show.date_start, show.time_end);
    // Handle case where event goes past midnight
    while (end < start) {
        end.setDate(end.getDate() + 1);
    }
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
