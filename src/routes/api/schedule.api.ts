import { Request, Response } from "express";
import {
  ScheduleStore,
  SharedSchedule,
  UserScheduleLookupResult,
  UserScheduleStore,
} from "../../types";
import {
  getSignedScheduleLookup,
  isSignedScheduleId,
} from "../../scheduleStore";

const isValidArtistName = (artist: unknown): artist is string =>
  typeof artist === "string" && artist.trim().length > 0;

export const readArtistsFromBody = (body: unknown): string[] => {
  if (!body || typeof body !== "object" || !("artists" in body)) {
    return [];
  }

  const candidate = (body as { artists?: unknown }).artists;
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.filter(isValidArtistName).map((artist) => artist.trim());
};

export const handleCreateScheduleFactory = (scheduleStore: ScheduleStore) => {
  return async (req: Request, res: Response) => {
    const artists = readArtistsFromBody(req.body);
    if (!artists.length) {
      res.status(400).json({
        error: "No valid artists provided. Expect { artists: string[] }.",
      });
      return;
    }

    const normalized = Array.from(new Set(artists));
    const schedule = scheduleStore.createOrGet(normalized);
    console.info(
      JSON.stringify({
        event: "schedule-create",
        scheduleId: schedule.id,
        artists: schedule.artists.length,
        resolver: "signed-token",
      }),
    );
    res.status(201).json(schedule);
  };
};

const normalizeUserSchedule = (
  payload: UserScheduleLookupResult,
): SharedSchedule | null => {
  if (!payload.schedule) {
    return null;
  }

  return {
    id: payload.schedule.id,
    artists: payload.schedule.artists,
    createdAt: payload.schedule.createdAt,
    updatedAt: payload.schedule.updatedAt,
  };
};

const scheduleMissPayload = (lookup: UserScheduleLookupResult) => {
  if (lookup.status === "deleted") {
    return { status: 410, event: "schedule-get-deleted" };
  }

  return { status: 404, event: "schedule-get-miss" };
};

export const handleGetScheduleFactory = (
  scheduleStore: ScheduleStore,
  userScheduleStore?: UserScheduleStore,
) => {
  return async (req: Request, res: Response) => {
    const scheduleId = req.params["scheduleId"];
    if (!scheduleId) {
      res.status(400).json({ error: "Missing schedule id." });
      return;
    }

    if (isSignedScheduleId(scheduleId)) {
      const lookup = getSignedScheduleLookup(scheduleId);
      if (lookup.status === "ok") {
        console.info(
          JSON.stringify({
            event: "schedule-hit",
            scheduleId,
            artists: lookup.schedule?.artists.length || 0,
            resolver: "signed-token",
          }),
        );
        res.json(lookup.schedule);
        return;
      }

      const status = lookup.status === "malformed" ? 400 : 404;
      const event =
        lookup.status === "malformed"
          ? "schedule-get-bad-request"
          : "schedule-get-miss";

      console.warn(
        JSON.stringify({
          event,
          status,
          scheduleId,
          resolver: "signed-token",
          reason: lookup.reason,
        }),
      );

      if (lookup.status === "malformed") {
        res
          .status(status)
          .json({ error: lookup.reason || "Invalid schedule id format." });
        return;
      }

      res.status(status).json({ error: lookup.reason || "Schedule not found." });
      return;
    }

    if (!userScheduleStore) {
      res.status(400).json({ error: "Unrecognized schedule id format." });
      return;
    }

    const lookup = await userScheduleStore.getPublic(scheduleId);
    if (lookup.status === "ok") {
      console.info(
        JSON.stringify({
          event: "schedule-user-hit",
          scheduleId,
          resolver: "user-schedule",
          artists: lookup.schedule?.artists.length || 0,
        }),
      );

      const payload = normalizeUserSchedule(lookup);
      if (payload) {
        res.json(payload);
      } else {
        res.status(404).json({ error: "Schedule not found." });
      }
      return;
    }

    const miss = scheduleMissPayload(lookup);
    console.warn(
      JSON.stringify({
        event: miss.event,
        status: miss.status,
        scheduleId,
        resolver: "user-schedule",
        reason: lookup.reason || "Schedule not found.",
      }),
    );
    res
      .status(miss.status)
      .json({ error: lookup.reason || "Schedule not found." });
  };
};
