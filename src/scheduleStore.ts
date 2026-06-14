import { randomBytes } from "crypto";
import { SharedSchedule, ScheduleStore } from "./types";

const normalizeArtists = (artists: string[]): string[] => {
  return Array.from(
    new Set(
      artists
        .map((artist) => (artist || "").trim())
        .filter((artist) => artist.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
};

const randomScheduleId = (): string => randomBytes(12).toString("hex");

const createEmptySchedule = (id: string, artists: string[]): SharedSchedule => ({
  id,
  artists,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const createScheduleStore = (
  ttlMinutes = 24 * 60 * 7,
): ScheduleStore => {
  const schedules = new Map<string, SharedSchedule>();
  const artistSetIndex = new Map<string, string>();
  const ttlMs = ttlMinutes * 60 * 1000;

  const makeArtistKey = (artists: string[]): string =>
    normalizeArtists(artists).join("|");

  const get = (id: string): SharedSchedule | undefined => {
    const schedule = schedules.get(id);
    if (!schedule) {
      return undefined;
    }

    const parsed = new Date(schedule.updatedAt).getTime();
    if (Number.isFinite(parsed) && Date.now() - parsed > ttlMs) {
      schedules.delete(id);
      artistSetIndex.delete(makeArtistKey(schedule.artists));
      return undefined;
    }

    return schedule;
  };

  const createOrGet = (artists: string[]): SharedSchedule => {
    const normalizedArtists = normalizeArtists(artists);
    const artistKey = normalizedArtists.join("|");
    const existingId = artistSetIndex.get(artistKey);
    if (existingId) {
      const existing = schedules.get(existingId);
      if (existing) {
        existing.updatedAt = new Date().toISOString();
        return existing;
      }
    }

    const id = randomScheduleId();
    const schedule = createEmptySchedule(id, normalizedArtists);
    schedules.set(id, schedule);
    artistSetIndex.set(artistKey, id);

    return schedule;
  };

  return {
    createOrGet,
    get,
  };
};
