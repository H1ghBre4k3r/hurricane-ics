import { Request, Response } from "express";
import ical, { ICalCalendarMethod } from "ical-generator";
import { FetchFestivalFn, ScheduleStore } from "../../types";
import { eventFactory } from "../../utils";
import { sendCalendar } from "./response";

export const handleGetScheduleIcsFactory = (
  fetchFestival: FetchFestivalFn,
  scheduleStore: ScheduleStore,
) => {
  return async (req: Request, res: Response) => {
    const scheduleId = req.params["scheduleId"];
    if (!scheduleId) {
      res.sendStatus(400);
      return;
    }

    const schedule = scheduleStore.get(scheduleId);
    if (!schedule) {
      res.sendStatus(404);
      return;
    }

    const artistSet = new Set(schedule.artists);
    if (!artistSet.size) {
      res.sendStatus(400);
      return;
    }

    try {
      const calendar = ical({
        method: ICalCalendarMethod.PUBLISH,
        name: "Hurricane Calendar",
      });

      const festival = await fetchFestival();
      const concerts = festival.shows
        .filter((show) => artistSet.has(show.artist.name))
        .map((event) => eventFactory(event));

      if (!concerts.length) {
        console.warn(
          JSON.stringify({
            event: "ics-route-empty-schedule",
            route: "schedule",
            scheduleId,
          }),
        );
        res.sendStatus(404);
        return;
      }

      calendar.events(concerts);
      sendCalendar(
        res,
        calendar,
        `hurricane-schedule-${scheduleId.slice(0, 8)}.ics`,
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "ics-route-error",
          route: "schedule",
          scheduleId,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      res.sendStatus(500);
    }
  };
};
