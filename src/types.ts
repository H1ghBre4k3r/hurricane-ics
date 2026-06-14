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

export type UpstreamLineupHealth = {
  url: string;
  sourceMarker: string | null;
  etag: string | null;
  lastModified: string | null;
  requiredMarkers: string[];
  missingMarkers: string[];
  parseWarnings: LineupParseWarning[];
};

export type FestivalFetchStatus = {
  cacheAvailable: boolean;
  stale: boolean;
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
  cacheAvailable: boolean;
  lastUpdated: string | null;
  health: UpstreamLineupHealth | null;
};

export type GetFestivalStatusFn = () => FestivalFetchStatus;
