import { Request, Response } from "express";
import ical, { ICalEventData } from "ical-generator";
import { FestivalPlan } from "../types";
import { eventFactory } from "../utils";

export function handleGetIndexFactory(festival: FestivalPlan) {
    return (req: Request, res: Response) => {
        const calendar = ical({ name: "Hurricane Calendar" });
        const concerts = Object.entries(festival).flatMap(([day, concerts]) => {
            return concerts.map<ICalEventData>((concert) => eventFactory(day, concert));
        });
        calendar.events(concerts);
        calendar.serve(res);
    };
}
