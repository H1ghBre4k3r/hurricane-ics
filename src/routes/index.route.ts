import { Request, Response } from "express";
import ical, { ICalEventData } from "ical-generator";
import { FestivalPlan } from "../types";
import { event } from "../utils";

export function handleGetIndexFactory(festival: FestivalPlan) {
    return (req: Request, res: Response) => {
        const calendar = ical({ name: "Hurricane Calendar" });
        const concerts = Object.entries(festival).flatMap(([day, concerts]) => {
            return concerts.map<ICalEventData>((concert) => {
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
            });
        });
        calendar.events(concerts);
        calendar.serve(res);
    };
}
