export enum Day {
  thursday = 0,
  friday = 1,
  saturday = 2,
  sunday = 3,
  monday = 4,
}

export type Category = {
  id: number;
  name: string;
};

export type Stage = {
  id: number;
  name: string;
};

export type Artist = {
  name: string;
  description: string;
  image: string;
  details_url: string;
  url: string;
};

export type Show = {
  category: Category;
  stage: Stage;
  date_timestamp: string;
  date_start: string;
  time_start: string;
  time_end: string;
  artist: Artist;
  teasertype: number;
};

export type FestivalPlan = {
  shows: Show[];
};

export type FetchFestivalFn = () => Promise<FestivalPlan>;

export type FestivalDateRange = {
  start: string;
  end: string;
};

export type LineupParseWarning = {
  code: "missing" | "invalid";
  message: string;
};

export type SharedSchedule = {
  id: string;
  artists: string[];
  createdAt: string;
  updatedAt: string;
};

export type PersistedUser = {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  sessionVersion: number;
  tokenIssuedAt: number;
  createdAt: string;
  updatedAt: string;
};

export type UserSchedule = {
  id: string;
  userId: string;
  name: string | null;
  artists: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type UserScheduleLookupStatus = "ok" | "missing" | "deleted";

export type UserScheduleLookupResult = {
  status: UserScheduleLookupStatus;
  schedule?: UserSchedule;
  reason?: string;
};

export type ScheduleLookupStatus =
  | "ok"
  | "malformed"
  | "invalid_signature"
  | "invalid_payload"
  | "expired"
  | "unsupported_version";

export type ScheduleLookupResult = {
  status: ScheduleLookupStatus;
  schedule?: SharedSchedule;
  reason?: string;
};

export type ScheduleStore = {
  createOrGet: (artists: string[]) => SharedSchedule;
  get: (id: string) => ScheduleLookupResult;
};

export type AuthStore = {
  createUser: (email: string, passwordHash: string, passwordSalt: string) => Promise<PersistedUser>;
  getUserByEmail: (email: string) => Promise<PersistedUser | null>;
  getUserById: (id: string) => Promise<PersistedUser | null>;
  revokeAllSessions: (userId: string) => Promise<{ sessionVersion: number; tokenIssuedAt: number }>;
  updatePassword: (
    userId: string,
    passwordHash: string,
    passwordSalt: string,
  ) => Promise<PersistedUser | null>;
};

export type UserScheduleStore = {
  create: (
    userId: string,
    artists: string[],
    name?: string | null,
  ) => Promise<UserSchedule>;
  list: (userId: string) => Promise<UserSchedule[]>;
  get: (userId: string, scheduleId: string) => Promise<UserScheduleLookupResult>;
  getPublic: (scheduleId: string) => Promise<UserScheduleLookupResult>;
  delete: (userId: string, scheduleId: string) => Promise<boolean>;
  update: (
    userId: string,
    scheduleId: string,
    patch: { name?: string | null; artists?: string[] },
  ) => Promise<UserScheduleLookupResult>;
};

export type AppUser = {
  id: string;
  email: string;
  createdAt: string;
};

export type UpstreamLineupHealth = {
  url: string;
  sourceMarker: string | null;
  lineupTimestamp: string | null;
  etag: string | null;
  lastModified: string | null;
  parsedShowCount: number;
  requiredMarkers: string[];
  missingMarkers: string[];
  parseWarnings: LineupParseWarning[];
};

export type FestivalFetchStatus = {
  cacheAvailable: boolean;
  stale: boolean;
  staleReason: string | null;
  lastSuccessfulFetch: string | null;
  lastAttemptedFetch: string | null;
  showCount: number;
  lineupDateRange: FestivalDateRange | null;
  lastError: string | null;
  health: UpstreamLineupHealth | null;
};

export type ConcertsApiResponse = {
  shows: Show[];
  stale: boolean;
  staleReason: string | null;
  cacheAvailable: boolean;
  lastUpdated: string | null;
  health: UpstreamLineupHealth | null;
};

export type GetFestivalStatusFn = () => FestivalFetchStatus;
