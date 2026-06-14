import { randomBytes } from "crypto";
import {
  AppUser,
  AuthStore,
  PersistedUser,
  UserSchedule,
  UserScheduleLookupResult,
  UserScheduleStore,
} from "./types";

const nowIso = (): string => new Date().toISOString();

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const makeId = (): string => randomBytes(12).toString("base64url");

const normalizeArtists = (artists: string[]): string[] => {
  return Array.from(new Set(artists.map((artist) => artist.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
};

class InMemoryAuthStore implements AuthStore {
  private readonly usersById = new Map<string, PersistedUser>();
  private readonly usersByEmail = new Map<string, PersistedUser>();

  async createUser(
    rawEmail: string,
    passwordHash: string,
    passwordSalt: string,
  ): Promise<PersistedUser> {
    const email = normalizeEmail(rawEmail);
    const now = nowIso();
    const user: PersistedUser = {
      id: makeId(),
      email,
      passwordHash,
      passwordSalt,
      createdAt: now,
      updatedAt: now,
    };

    this.usersByEmail.set(email, user);
    this.usersById.set(user.id, user);

    return user;
  }

  async getUserByEmail(rawEmail: string): Promise<PersistedUser | null> {
    return this.usersByEmail.get(normalizeEmail(rawEmail)) || null;
  }

  async getUserById(userId: string): Promise<PersistedUser | null> {
    return this.usersById.get(userId) || null;
  }
}

class InMemoryUserScheduleStore implements UserScheduleStore {
  private readonly schedulesById = new Map<string, UserSchedule>();
  private readonly schedulesByUser = new Map<string, Set<string>>();

  async create(
    userId: string,
    artists: string[],
    name: string | null = null,
  ): Promise<UserSchedule> {
    const now = nowIso();
    const normalizedArtists = normalizeArtists(artists);
    const schedule: UserSchedule = {
      id: makeId(),
      userId,
      name: name ? name.trim() : null,
      artists: normalizedArtists,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    this.schedulesById.set(schedule.id, schedule);
    const setForUser = this.schedulesByUser.get(userId) || new Set<string>();
    setForUser.add(schedule.id);
    this.schedulesByUser.set(userId, setForUser);

    return schedule;
  }

  async list(userId: string): Promise<UserSchedule[]> {
    const ids = this.schedulesByUser.get(userId);
    if (!ids) {
      return [];
    }

    const result: UserSchedule[] = [];
    for (const id of ids) {
      const schedule = this.schedulesById.get(id);
      if (schedule && !schedule.deletedAt) {
        result.push({ ...schedule });
      }
    }

    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(
    userId: string,
    scheduleId: string,
  ): Promise<UserScheduleLookupResult> {
    const schedule = this.schedulesById.get(scheduleId);
    if (!schedule || schedule.userId !== userId) {
      return { status: "missing" };
    }

    if (schedule.deletedAt) {
      return {
        status: "deleted",
        reason: "Schedule has been deleted",
      };
    }

    return {
      status: "ok",
      schedule: { ...schedule },
    };
  }

  async getPublic(scheduleId: string): Promise<UserScheduleLookupResult> {
    const schedule = this.schedulesById.get(scheduleId);
    if (!schedule) {
      return { status: "missing" };
    }

    if (schedule.deletedAt) {
      return {
        status: "deleted",
        reason: "Schedule has been deleted",
      };
    }

    return {
      status: "ok",
      schedule: { ...schedule },
    };
  }

  async delete(userId: string, scheduleId: string): Promise<boolean> {
    const lookup = await this.get(userId, scheduleId);
    if (lookup.status !== "ok") {
      return false;
    }

    const schedule = lookup.schedule as UserSchedule;
    schedule.deletedAt = nowIso();
    schedule.updatedAt = schedule.deletedAt;
    this.schedulesById.set(scheduleId, schedule);

    return true;
  }

  async update(
    userId: string,
    scheduleId: string,
    patch: { name?: string | null; artists?: string[] },
  ): Promise<UserScheduleLookupResult> {
    const lookup = await this.get(userId, scheduleId);
    if (lookup.status !== "ok") {
      return lookup;
    }

    const schedule = lookup.schedule as UserSchedule;
    if (typeof patch.name !== "undefined") {
      const normalizedName = patch.name?.trim() || null;
      schedule.name = normalizedName;
    }

    if (patch.artists) {
      const normalized = normalizeArtists(patch.artists);
      if (!normalized.length) {
        return {
          status: "missing",
          reason: "No valid artists provided. Expect { artists: string[] }.",
        };
      }

      schedule.artists = normalized;
    }

    schedule.updatedAt = nowIso();
    this.schedulesById.set(scheduleId, schedule);

    return {
      status: "ok",
      schedule: { ...schedule },
    };
  }
}

export const createInMemoryAppStore = (): {
  authStore: AuthStore;
  userScheduleStore: UserScheduleStore;
} => {
  return {
    authStore: new InMemoryAuthStore(),
    userScheduleStore: new InMemoryUserScheduleStore(),
  };
};

export const createAppStore = (): {
  authStore: AuthStore;
  userScheduleStore: UserScheduleStore;
} => {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.warn(
      JSON.stringify({
        event: "db-store-not-supported",
        message:
          "DATABASE_URL is set, but only the in-memory store is implemented in this version",
      }),
    );
  }

  return createInMemoryAppStore();
};

export const toAppUser = (user: PersistedUser): AppUser => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt,
});
