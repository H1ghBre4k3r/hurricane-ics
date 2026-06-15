import { Request, Response } from "express";
import ical, { ICalCalendarMethod } from "ical-generator";
import { FetchFestivalFn } from "../../types";
import { eventFactory } from "../../utils";
import { sendCalendar } from "./response";
import { getSignedScheduleLookup, isSignedScheduleId } from "../../scheduleStore";

export const handleGetScheduleIcsFactory = (
  fetchFestival: FetchFestivalFn,
) => {
  return async (req: Request, res: Response) => {
    const scheduleId = req.params["scheduleId"];
    if (!scheduleId) {
      res.status(400).json({ error: "Missing schedule id." });
      return;
    }

    if (!isSignedScheduleId(scheduleId)) {
      console.warn(
        JSON.stringify({
          event: "schedule-ics-malformed",
          route: "schedule",
          scheduleId,
          resolver: "signed-token",
          reason: "Unrecognized schedule id format.",
        }),
      );
      res.status(400).json({ error: "Unrecognized schedule id format." });
      return;
    }

    const lookup = getSignedScheduleLookup(scheduleId);
    const schedule = lookup.status === "ok" ? lookup.schedule : null;
    if (lookup.status !== "ok" || !schedule) {
    const status = lookup.status === "malformed" ? 400 : 404;
    const event = status === 400 ? "schedule-ics-malformed" : "schedule-ics-miss";

      console.warn(
        JSON.stringify({
          event,
          route: "schedule",
          scheduleId,
          resolver: "signed-token",
          status: lookup.status,
          reason: lookup.reason,
        }),
      );

      res.status(status).json({ error: lookup.reason || "Schedule not found." });
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

      console.info(
        JSON.stringify({
          event: "schedule-ics-hit",
          route: "schedule",
          scheduleId,
          resolver: "signed-token",
          artists: artistSet.size,
          events: concerts.length,
        }),
      );

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
