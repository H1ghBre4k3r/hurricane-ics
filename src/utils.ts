import { ICalEventData } from "ical-generator";
import { Concert, ConcertDate, Day } from "./types";

export function event(day: Day, hour: number, minutes = 0): Date {
    return new Date(2022, 5, 16 + day, hour, minutes);
}

export function date(hours: number, minutes = 0): ConcertDate {
    return {
        hours,
        minutes,
    };
}

export function eventFactory(day: string, concert: Concert): ICalEventData {
    return {
        summary: concert.summary,
        location: concert.location,
        start: event(parseInt(day, 10), concert.start.hours, concert.start.minutes),
        end: event(parseInt(day, 10), concert.end.hours, concert.end.minutes),
        categories: [
            {
                name: concert.location,
            },
        ],
        timezone: "Europe/Berlin",
    };
}
