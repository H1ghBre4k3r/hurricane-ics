import { Request, Response } from "express";
import ical, { ICalCalendarMethod } from "ical-generator";
import { FetchFestivalFn, ScheduleStore, UserScheduleStore } from "../../types";
import { eventFactory } from "../../utils";
import { sendCalendar } from "./response";
import { getSignedScheduleLookup, isSignedScheduleId } from "../../scheduleStore";

const resolveScheduleArtists = async (
  scheduleStore: ScheduleStore,
  userScheduleStore: UserScheduleStore | undefined,
  scheduleId: string,
) => {
  if (isSignedScheduleId(scheduleId)) {
    const lookup = getSignedScheduleLookup(scheduleId);
    return {
      lookup,
      resolver: "signed-token" as const,
    };
  }

  if (!userScheduleStore) {
    return {
      lookup: {
        status: "malformed",
        reason: "Unrecognized schedule id format.",
      } as const,
      resolver: "user-schedule" as const,
    };
  }

  const lookup = await userScheduleStore.getPublic(scheduleId);
  return { lookup, resolver: "user-schedule" as const };
};

export const handleGetScheduleIcsFactory = (
  fetchFestival: FetchFestivalFn,
  scheduleStore: ScheduleStore,
  userScheduleStore?: UserScheduleStore,
) => {
  return async (req: Request, res: Response) => {
    const scheduleId = req.params["scheduleId"];
    if (!scheduleId) {
      res.status(400).json({ error: "Missing schedule id." });
      return;
    }

    const resolution = await resolveScheduleArtists(
      scheduleStore,
      userScheduleStore,
      scheduleId,
    );
    const { lookup } = resolution;
    const schedule = lookup.status === "ok" ? lookup.schedule : null;
    if (lookup.status !== "ok" || !schedule) {
      const status =
        lookup.status === "malformed"
          ? 400
          : lookup.status === "deleted"
            ? 410
            : 404;
      const event =
        status === 400
          ? "schedule-ics-malformed"
          : status === 410
            ? "schedule-ics-deleted"
            : "schedule-ics-miss";

      console.warn(
        JSON.stringify({
          event,
          route: "schedule",
          scheduleId,
          resolver: resolution.resolver,
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
          resolver: resolution.resolver,
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
