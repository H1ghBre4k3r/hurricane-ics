import { Request, Response } from "express";
import ical, { ICalCalendarMethod } from "ical-generator";
import { FetchFestivalFn } from "../../types";
import { eventFactory } from "../../utils";
import { sendCalendar } from "./response";

export const handleGetIndexIcsFactory = (fetchFestival: FetchFestivalFn) => {
  return async (_req: Request, res: Response) => {
    try {
      const calendar = ical({
        method: ICalCalendarMethod.PUBLISH,
        name: "Hurricane Calendar",
      });
      const festival = await fetchFestival();
      const concerts = festival.shows.map((show) => eventFactory(show));
      calendar.events(concerts);
      sendCalendar(res, calendar, "hurricane.ics");
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "ics-route-error",
          route: "index",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      res.sendStatus(500);
    }
  };
};
