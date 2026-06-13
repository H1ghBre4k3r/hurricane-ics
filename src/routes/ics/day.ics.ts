import { Request, Response } from "express";
import ical, { ICalCalendarMethod } from "ical-generator";
import { FetchFestivalFn } from "../../types";
import { eventFactory } from "../../utils";
import { sendCalendar } from "./response";

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

    // generate appropriate calendar name suggestion
    const calendar = ical({
      method: ICalCalendarMethod.PUBLISH,
      name: `Hurricane Calendar ${
        day.charAt(0).toUpperCase() + day.substring(1)
      }`,
    });
    const festival = await fetchFestival();
    const festivalDates = Array.from(
      new Set(festival.shows.map((show) => show.date_start)),
    ).sort();
    const dateStart = festivalDates[days[day]];

    if (!dateStart) {
      res.sendStatus(404);
      return;
    }

    const concerts = festival.shows
      .filter((show) => show.date_start === dateStart)
      .map((show) => eventFactory(show));
    calendar.events(concerts);
    sendCalendar(res, calendar, `hurricane-${day}.ics`);
  };
}
