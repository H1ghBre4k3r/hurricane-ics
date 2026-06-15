import { Request, Response } from "express";
import { ScheduleStore, SharedSchedule } from "../../types";
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

export const handleGetScheduleFactory = (scheduleStore: ScheduleStore) => {
  return async (req: Request, res: Response) => {
    const scheduleId = req.params["scheduleId"];
    if (!scheduleId) {
      res.status(400).json({ error: "Missing schedule id." });
      return;
    }

    if (!isSignedScheduleId(scheduleId)) {
      console.warn(
        JSON.stringify({
          event: "schedule-get-bad-request",
          status: 400,
          scheduleId,
          resolver: "signed-token",
          reason: "Unrecognized schedule id format.",
        }),
      );
      res.status(400).json({ error: "Unrecognized schedule id format." });
      return;
    }

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
      res.json(lookup.schedule as SharedSchedule);
      return;
    }

    const status = lookup.status === "malformed" ? 400 : 404;
    const event = lookup.status === "malformed"
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
      res.status(status).json({ error: lookup.reason || "Invalid schedule id format." });
      return;
    }

    res.status(status).json({ error: lookup.reason || "Schedule not found." });
  };
};
