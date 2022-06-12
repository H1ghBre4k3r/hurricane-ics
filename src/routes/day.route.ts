import { Request, Response } from "express";
import ical from "ical-generator";
import { Day, FestivalPlan } from "../types";
import { eventFactory } from "../utils";

const days: { [key: string]: number } = {
    thursday: 0,
    friday: 1,
    saturday: 2,
    sunday: 3,
};

export function handleGetDayFactory(festival: FestivalPlan) {
    return (req: Request, res: Response) => {
        const day = req.params["day"];
        if (!day || days[day] === undefined) {
            res.sendStatus(400);
            return;
        }

        const dayIndex = days[day] as Day;

        const calendar = ical({ name: `Hurricane Calendar ${day.charAt(0).toUpperCase() + day.substring(1)}` });
        const concerts = festival[dayIndex].map((concert) => eventFactory(`${dayIndex}`, concert));
        calendar.events(concerts);
        calendar.serve(res);
    };
}
