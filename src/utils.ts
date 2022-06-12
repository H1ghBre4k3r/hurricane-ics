import { ConcertDate, Day } from "types";

export function event(day: Day, hour: number, minutes = 0): Date {
    return new Date(2022, 5, 16 + day, hour, minutes);
}

export function date(hours: number, minutes = 0): ConcertDate {
    return {
        hours,
        minutes,
    };
}
