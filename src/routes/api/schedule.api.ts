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
      res.sendStatus(400);
      return;
    }

    const schedule = scheduleStore.createOrGet(artists);
    res.status(201).json(schedule);
  };
};

export const handleGetScheduleFactory = (scheduleStore: ScheduleStore) => {
  return (req: Request, res: Response) => {
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

    res.json(schedule);
  };
};
