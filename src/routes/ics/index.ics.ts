import { Request, Response } from "express";
import ical, { ICalCalendarMethod } from "ical-generator";
import { FetchFestivalFn } from "../../types";
import { eventFactory } from "../../utils";
import { sendCalendar } from "./response";

export const handleGetIndexIcsFactory = (fetchFestival: FetchFestivalFn) => {
  return async (_req: Request, res: Response) => {
    const calendar = ical({
      method: ICalCalendarMethod.PUBLISH,
      name: "Hurricane Calendar",
    });
    const festival = await fetchFestival();
    const concerts = festival.shows.map((show) => eventFactory(show));
    calendar.events(concerts);
    sendCalendar(res, calendar, "hurricane.ics");
  };
};
