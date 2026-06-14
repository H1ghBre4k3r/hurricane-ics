import { Request, Response } from "express";
import { ScheduleStore } from "../../types";

const isValidArtistName = (artist: unknown): artist is string =>
  typeof artist === "string" && artist.trim().length > 0;

const readArtistsFromBody = (body: unknown): string[] => {
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
      }),
    );
    res.status(201).json(schedule);
  };
};

export const handleGetScheduleFactory = (scheduleStore: ScheduleStore) => {
  return (req: Request, res: Response) => {
    const scheduleId = req.params["scheduleId"];
    if (!scheduleId) {
      res.status(400).json({ error: "Missing schedule id." });
      return;
    }

    const lookup = scheduleStore.get(scheduleId);
    if (lookup.status === "ok") {
      console.info(
        JSON.stringify({
          event: "schedule-hit",
          scheduleId,
          artists: lookup.schedule?.artists.length || 0,
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
        reason: lookup.reason,
      }),
    );

    if (lookup.status === "malformed") {
      res.status(status).json({
        error: lookup.reason || "Invalid schedule id format.",
      });
      return;
    }

    if (
      lookup.status === "expired" ||
      lookup.status === "invalid_signature" ||
      lookup.status === "invalid_payload" ||
      lookup.status === "unsupported_version"
    ) {
      res.status(404).json({ error: lookup.reason || "Schedule not found." });
      return;
    }

    res.status(404).json({ error: lookup.reason || "Schedule not found." });
  };
};
