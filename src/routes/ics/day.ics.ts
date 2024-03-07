import { Request, Response } from "express";
import ical from "ical-generator";
import { Day, FetchFestivalFn } from "../../types";
import { eventFactory } from "../../utils";

const days: { [key: string]: number } = {
  thursday: 0,
  friday: 1,
  saturday: 2,
  sunday: 3,
};

export function handleGetDayIcsFactory(fetchFestival: FetchFestivalFn) {
  return async (req: Request, res: Response) => {
    const day = req.params["day"];
    if (!day || days[day] === undefined) {
      res.sendStatus(400);
      return;
    }

    const dayIndex = days[day] as Day;

    // generate appropriate calendar name suggestion
    const calendar = ical({
      name: `Hurricane Calendar ${
        day.charAt(0).toUpperCase() + day.substring(1)
      }`,
    });
    const festival = await fetchFestival();
    const concerts = festival.shows
      .filter((show) => show.date_start === `2206${16 + dayIndex}`)
      .map((show) => eventFactory(show));
    calendar.events(concerts);
    res.end(calendar.toString());
  };
}
