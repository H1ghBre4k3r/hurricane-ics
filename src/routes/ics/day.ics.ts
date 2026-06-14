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
      console.warn(
        JSON.stringify({
          event: "ics-route-invalid-day",
          route: "day",
          requestedDay: String(day),
        }),
      );
      res.sendStatus(400);
      return;
    }

    try {
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
        console.warn(
          JSON.stringify({
            event: "ics-route-empty-day",
            route: "day",
            requestedDay: day,
          }),
        );
        res.sendStatus(404);
        return;
      }

      const concerts = festival.shows
        .filter((show) => show.date_start === dateStart)
        .map((show) => eventFactory(show));
      calendar.events(concerts);
      sendCalendar(res, calendar, `hurricane-${day}.ics`);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "ics-route-error",
          route: "day",
          requestedDay: day,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      res.sendStatus(500);
    }
  };
}
