import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConcertsApiResponse,
  Show,
  UpstreamLineupHealth,
} from "./../../src/types";
import "./App.css";
import { Artist } from "./Artist";
import { MySchedule } from "./MySchedule";
import {
  FestivalDay,
  buildConflictMap,
  formatDayLabel,
  groupSelectedShowsByDay,
  normalize,
  sortShowsByStart,
} from "./schedule";
import {
  getSharedArtistsFromSearch,
  getSharedScheduleFromSearch,
  makeCalendarUrl,
  makeSelectionMap,
  makeShareUrl,
  makeScheduleCalendarUrl,
} from "./share";
import { parseDate } from "./utils";

type FetchState = "loading" | "ready" | "empty" | "error";
type CopyState =
  | "idle"
  | "calendar-copied"
  | "share-copied"
  | "failed";
type CopySuccessState = Exclude<CopyState, "idle" | "failed">;
type ScheduleView = "lineup" | "my-schedule";

const SELECTIONS_STORAGE_KEY = "hurricane-ics:selected-artists";

const parseViewFromSearch = (search: string): ScheduleView => {
  const params = new URLSearchParams(search);
  const view = params.get("view");

  if (view === "lineup" || view === "my-schedule") {
    return view;
  }

  return "lineup";
};

const GITHUB_REPO_URL = "https://github.com/H1ghBre4k3r/hurricane-ics";

const getCsrfToken = (): string | null => {
  const raw = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("XSRF-TOKEN="));

  if (!raw) {
    return null;
  }

  return decodeURIComponent(raw.replace("XSRF-TOKEN=", ""));
};

const withCsrfHeader = (
  headers: Record<string, string> = {},
): Record<string, string> => {
  const token = getCsrfToken();
  if (!token) {
    return headers;
  }

  return {
    ...headers,
    "X-CSRF-Token": token,
  };
};

const updateViewInQuery = (view: ScheduleView) => {
  const params = new URLSearchParams(window.location.search);
  if (view === "lineup") {
    params.delete("view");
  } else {
    params.set("view", view);
  }

  const query = params.toString();
  const next = query ? `?${query}` : "";
  window.history.replaceState(null, "", `${window.location.pathname}${next}`);
};

const formatDateRange = (days: FestivalDay[]): string => {
  if (!days.length) {
    return "Lineup calendar";
  }

  const first = parseDate(days[0].day, "00:00");
  const last = parseDate(days[days.length - 1].day, "00:00");
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  if (first.toDateString() === last.toDateString()) {
    return formatter.format(first);
  }

  return `${formatter.format(first)} - ${formatter.format(last)}`;
};

const formatFestivalTitle = (days: FestivalDay[]): string => {
  const years = Array.from(
    new Set(days.map((day) => parseDate(day.day, "00:00").getFullYear())),
  ).sort();

  if (!years.length) {
    return "Hurricane";
  }

  return `Hurricane ${years.join("/")}`;
};

const formatLastUpdated = (lastUpdated: string | null): string => {
  if (!lastUpdated) {
    return "never";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(lastUpdated));
};

const copyToClipboardFallback = (value: string): boolean => {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const copied = document.execCommand("copy");
    return copied;
  } finally {
    document.body.removeChild(textArea);
  }
};

const readStoredSelections = (): { [key: string]: boolean } => {
  try {
    const raw = window.localStorage.getItem(SELECTIONS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {};
    }

    return parsed.reduce<{ [key: string]: boolean }>((memo, artist) => {
      if (typeof artist === "string") {
        memo[artist] = true;
      }
      return memo;
    }, {});
  } catch (error) {
    console.error(error);
    return {};
  }
};

const normalizeArtistList = (artists: string[]): string[] => {
  return Array.from(
    new Set(
      artists
        .map((artist) => artist.trim())
        .filter((artist) => artist.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
};

const mapShowsToDays = (shows: Show[]): FestivalDay[] => {
  return sortShowsByStart(shows).reduce<FestivalDay[]>((memo, show) => {
    if (!memo.length || memo[memo.length - 1].day !== show.date_start) {
      memo.push({ day: show.date_start, events: [] });
    }

    memo[memo.length - 1].events.push(show);
    return memo;
  }, []);
};

type HealthBannerInfo = {
  stale: boolean;
  cacheAvailable: boolean;
  lastUpdated: string | null;
  staleReason: string | null;
  health: UpstreamLineupHealth | null;
};

const App = () => {
  const [festival, setFestival] = useState<FestivalDay[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [fetchError, setFetchError] = useState<string>("");
  const [activeDay, setActiveDay] = useState<string>("");
  const [health, setHealth] = useState<HealthBannerInfo>({
    stale: false,
    cacheAvailable: false,
    lastUpdated: null,
    staleReason: null,
    health: null,
  });
  const [selectedArtistsRequestId, setSelectedArtistsRequestId] = useState(0);
  const [seedScheduleId, setSeedScheduleId] = useState<string | null>(() =>
    getSharedScheduleFromSearch(window.location.search),
  );
  const [sharedArtists, setSharedArtists] = useState<string[]>(() =>
    getSharedArtistsFromSearch(window.location.search),
  );
  const [scheduleId, setScheduleId] = useState<string | null>(seedScheduleId);
  const [sharedSelectionsApplied, setSharedSelectionsApplied] = useState(false);
  const [sharedPicksLoaded, setSharedPicksLoaded] = useState(false);
  const [selections, setSelections] = useState<{ [key: string]: boolean }>(() =>
    readStoredSelections(),
  );
  const [search, setSearch] = useState("");
  const [selectedStages, setSelectedStages] = useState<{ [key: string]: boolean }>(
    {},
  );
  const [selectedCategories, setSelectedCategories] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [scheduleView, setScheduleView] =
    useState<ScheduleView>(parseViewFromSearch(window.location.search));
  const [showOnlyShareable, setShowOnlyShareable] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const authUser = null;
  const [savedScheduleBusy, setSavedScheduleBusy] = useState(false);

  const syncScheduleView = (nextView: ScheduleView) => {
    setScheduleView(nextView);
    updateViewInQuery(nextView);
  };

  const copyStateMessage = useMemo(() => {
    switch (copyState) {
      case "calendar-copied":
        return "Calendar link copied";
      case "share-copied":
        return "Share link copied";
      case "failed":
        return "Copy failed";
      default:
        return "";
    }
  }, [copyState]);

  const loadLineup = useCallback(async () => {
    setFetchState((currentState) =>
      currentState === "ready" ? "ready" : "loading",
    );
    setFetchError("");

    try {
      const response = await fetch("/api/concerts");
      if (!response.ok) {
        throw new Error(`Failed to load concerts: ${response.status}`);
      }

      const payload = (await response.json()) as ConcertsApiResponse;
      const shows = payload.shows || [];
      const days = mapShowsToDays(shows);
      const sortedDays = days.map((day) => ({
        ...day,
        events: sortShowsByStart(day.events),
      }));

      setFestival(sortedDays);
      if (days[0]?.day) {
        setActiveDay((current) => current || days[0].day);
      }
      setFetchState(sortedDays.length ? "ready" : "empty");
      setHealth({
        stale: Boolean(payload.stale),
        cacheAvailable: Boolean(payload.cacheAvailable),
        staleReason: payload.staleReason || null,
        lastUpdated: payload.lastUpdated || null,
        health: payload.health || null,
      });
    } catch (error) {
      console.error(error);
      setFetchError(
        "Concert data is currently unavailable. Showing previously loaded data when available.",
      );

      if (!festival.length) {
        setFetchState("error");
      } else {
        setFetchState("ready");
      }
    }
  }, [festival.length]);

  const ensureScheduleId = useCallback(
    async (artists: string[]): Promise<string | null> => {
      if (!artists.length) {
        return null;
      }

      try {
        const response = await fetch("/api/schedule", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ artists }),
        });

        if (!response.ok) {
          return null;
        }

        const payload = (await response.json()) as { id: string };
        if (typeof payload?.id === "string" && payload.id.length > 0) {
          return payload.id;
        }
      } catch (error) {
        console.error(error);
      }

      return null;
    },
    [],
  );

  const persistLegacySchedule = useCallback(
    (artists: string[], id: string) => {
      const params = new URLSearchParams(window.location.search);
      params.delete("artists");
      params.set("schedule", id);
      const query = params.toString();
      const next = query ? `?${query}` : "";
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${next}`,
      );
      setSeedScheduleId(id);
      setScheduleId(id);
      setSharedSelectionsApplied(false);

      console.info(
        JSON.stringify({
          event: "legacy-share-migrated",
          artists: artists.length,
          scheduleId: id,
        }),
      );
    },
    [],
  );

  useEffect(() => {
    setSharedSelectionsApplied(false);
  }, [seedScheduleId]);

  const saveCurrentSchedule = async () => {
    if (!authUser || !selectedArtists.length) {
      return;
    }

    setSavedScheduleBusy(true);
    const name = `My schedule (${new Date().toLocaleDateString()})`;

    try {
      const response = await fetch("/api/me/schedules", {
        method: "POST",
        headers: withCsrfHeader({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          artists: selectedArtists,
          name,
        }),
      });

      if (!response.ok) {
        return;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSavedScheduleBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) {
        return;
      }

      await loadLineup();
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [loadLineup, selectedArtistsRequestId]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const allShows = useMemo(
    () => festival.flatMap((day) => day.events),
    [festival],
  );

  useEffect(() => {
    if (!allShows.length) {
      return;
    }

    const applySharedArtists = (artists: string[]) => {
      const artistNames = new Set(allShows.map((show) => show.artist.name));
      const currentSharedArtists = normalizeArtistList(artists).filter((artist) =>
        artistNames.has(artist),
      );

      if (currentSharedArtists.length) {
        setSelections(makeSelectionMap(currentSharedArtists));
        setSharedPicksLoaded(true);
      }

      setSharedSelectionsApplied(true);
    };

    if (sharedSelectionsApplied) {
      return;
    }

    const resolveFromLegacyArtists = async () => {
      if (!sharedArtists.length) {
        applySharedArtists([]);
        return;
      }

      try {
        const response = await fetch("/api/schedule", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ artists: sharedArtists }),
        });

        if (!response.ok) {
          throw new Error(`Failed to migrate legacy schedule: ${response.status}`);
        }

        const payload = (await response.json()) as { id?: unknown };
        if (typeof payload.id === "string" && payload.id.length > 0) {
          persistLegacySchedule(sharedArtists, payload.id);
          setSharedPicksLoaded(true);
          applySharedArtists(sharedArtists);
          return;
        }

        throw new Error("Invalid schedule response payload");
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: "legacy-share-migration-failed",
            artists: sharedArtists.length,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
        applySharedArtists(sharedArtists);
      }
    };

    if (!seedScheduleId) {
      void resolveFromLegacyArtists();
      return;
    }

    let cancelled = false;

    const applySharedSchedule = async () => {
      try {
        const response = await fetch(`/api/schedule/${encodeURIComponent(seedScheduleId)}`);
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          console.warn(
            JSON.stringify({
              event: "shared-schedule-load-failed",
              scheduleId: seedScheduleId,
              status: response.status,
            }),
          );
          applySharedArtists(sharedArtists);
          return;
        }

        const payload = (await response.json()) as { artists?: unknown; id?: string };
        if (!Array.isArray(payload.artists)) {
          applySharedArtists(sharedArtists);
          return;
        }

        const artists = normalizeArtistList(
          payload.artists.filter((value): value is string => typeof value === "string"),
        );
        if (!artists.length) {
          applySharedArtists([]);
          return;
        }

        setScheduleId(seedScheduleId);
        setSharedArtists(artists);
        setSharedPicksLoaded(true);
        applySharedArtists(artists);
      } catch {
        if (!cancelled) {
          applySharedArtists(sharedArtists);
        }
      }
    };

    void applySharedSchedule();

    return () => {
      cancelled = true;
    };
  }, [allShows, sharedArtists, seedScheduleId, sharedSelectionsApplied, persistLegacySchedule]);

  useEffect(() => {
    if (!allShows.length) {
      return;
    }

    const artistNames = new Set(allShows.map((show) => show.artist.name));
    setSelections((current) => {
      const filteredSelections = Object.entries(current).reduce<{
        [key: string]: boolean;
      }>((memo, [artist, selected]) => {
        if (selected && artistNames.has(artist)) {
          memo[artist] = true;
        }
        return memo;
      }, {});
      return filteredSelections;
    });
  }, [allShows]);

  useEffect(() => {
    if (festival.length === 0) {
      return;
    }

    const dayExists = festival.some((day) => day.day === activeDay);
    if (!dayExists) {
      setActiveDay(festival[0]?.day || "");
    }
  }, [activeDay, festival]);

  useEffect(() => {
    const artists = normalizeArtistList(
      Object.entries(selections)
        .filter(([_, selected]) => selected)
        .map(([name]) => name),
    );

    if (!artists.length) {
      setScheduleId(seedScheduleId);
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      const nextId = await ensureScheduleId(artists);
      if (cancelled) {
        return;
      }

      if (nextId) {
        setScheduleId(nextId);
      }
    };

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [ensureScheduleId, selections, seedScheduleId]);

  useEffect(() => {
    try {
      const selectedList = Object.entries(selections)
        .filter(([_, selected]) => selected)
        .map(([name]) => name)
        .sort((a, b) => a.localeCompare(b));

      window.localStorage.setItem(
        SELECTIONS_STORAGE_KEY,
        JSON.stringify(selectedList),
      );
    } catch {
      // Browsers can reject storage writes in private or locked-down modes.
    }
  }, [selections]);

  const selectedArtists = useMemo(
    () =>
      Object.entries(selections)
        .filter(([_, selected]) => selected)
        .map(([name]) => name)
        .sort((a, b) => a.localeCompare(b)),
    [selections],
  );
  const stageOptions = useMemo(
    () =>
      Array.from(new Set(allShows.map((show) => show.stage.name))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [allShows],
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(allShows.map((show) => show.category.name)),
      ).sort((a, b) => a.localeCompare(b)),
    [allShows],
  );
  const activeStageFilters = useMemo(
    () =>
      Object.entries(selectedStages)
        .filter(([_, selected]) => selected)
        .map(([name]) => name),
    [selectedStages],
  );
  const activeCategoryFilters = useMemo(
    () =>
      Object.entries(selectedCategories)
        .filter(([_, selected]) => selected)
        .map(([name]) => name),
    [selectedCategories],
  );

  const activeFestivalDay = festival.find((day) => day.day === activeDay);
  const activeDayShows = useMemo(
    () => activeFestivalDay?.events || [],
    [activeFestivalDay],
  );
  const query = normalize(search.trim());

  const filteredShows = useMemo(() => {
    return activeDayShows.filter((show) => {
      if (query && !normalize(show.artist.name).includes(query)) {
        return false;
      }

      if (
        activeStageFilters.length &&
        !activeStageFilters.includes(show.stage.name)
      ) {
        return false;
      }

      if (
        activeCategoryFilters.length &&
        !activeCategoryFilters.includes(show.category.name)
      ) {
        return false;
      }

      if (selectedOnly && !selections[show.artist.name]) {
        return false;
      }

      return true;
    });
  }, [activeDayShows, query, activeStageFilters, activeCategoryFilters, selectedOnly, selections]);

  const selectedShows = useMemo(
    () => allShows.filter((show) => selections[show.artist.name]),
    [allShows, selections],
  );
  const selectedDays = useMemo(
    () => groupSelectedShowsByDay(festival, selections),
    [festival, selections],
  );
  const conflictMap = useMemo(
    () => buildConflictMap(selectedShows),
    [selectedShows],
  );
  const conflictingArtists = useMemo(
    () => new Set(Object.keys(conflictMap)),
    [conflictMap],
  );
  const conflictCount = conflictingArtists.size;

  const host = window.location.host;
  const fullCalendarHref = makeCalendarUrl("webcal", host, []);
  const scheduleCalendarHref =
    selectedArtists.length && scheduleId
      ? makeScheduleCalendarUrl("webcal", host, scheduleId)
      : "";
  const calendarHref = scheduleCalendarHref || (selectedArtists.length
    ? makeCalendarUrl("webcal", host, selectedArtists)
    : "");
  const copyCalendarUrl = scheduleId
    ? makeScheduleCalendarUrl("https", host, scheduleId)
    : makeCalendarUrl("https", host, selectedArtists);
  const copyFullCalendarUrl = makeCalendarUrl("https", host, []);
  const shareUrl = selectedArtists.length
    ? makeShareUrl(host, selectedArtists, scheduleId)
    : "";
  const canSaveSchedule = selectedArtists.length > 0 && authUser !== null;

  const clearFilters = () => {
    setSearch("");
    setSelectedStages({});
    setSelectedCategories({});
    setSelectedOnly(false);
  };

  const clearSelections = () => {
    setSelections({});
    setSharedPicksLoaded(false);
  };

  const toggleFilter = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>,
  ) => {
    setter((current) => ({
      ...current,
      [value]: !current[value],
    }));
  };

  const copyLink = async (url: string, successState: CopySuccessState) => {
    if (!url) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const copied = copyToClipboardFallback(url);
        if (!copied) {
          throw new Error("Clipboard copy failed");
        }
      }

      setCopyState(successState);
    } catch (error) {
      console.error(error);
      setCopyState("failed");
    }

    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  const retryFetch = () => {
    setSelectedArtistsRequestId((current) => current + 1);
  };

  const staleDataBanner = useMemo(() => {
    if (health.cacheAvailable && health.stale) {
      return {
        kind: "warning",
        title: "Lineup data is stale",
        message: `Using cached data from ${formatLastUpdated(
          health.lastUpdated,
        )}. ${health.staleReason || "Refresh when source is available."}`,
      };
    }

    if (!health.cacheAvailable && health.stale) {
      return {
        kind: "error",
        title: "Lineup data unavailable",
        message: "No cached lineup is available right now.",
      };
    }

    if (!isOnline) {
      return {
        kind: "warning",
        title: "Offline mode",
        message: `Network unavailable. Last successful data: ${formatLastUpdated(health.lastUpdated)}.`,
      };
    }

    return null;
  }, [health, isOnline]);

  const festivalTitle = formatFestivalTitle(festival);
  const dateRange = formatDateRange(festival);

  const totalShows = allShows.length;
  const hasFilters =
    !!search.trim() ||
    activeStageFilters.length > 0 ||
    activeCategoryFilters.length > 0 ||
    selectedOnly;

  return (
    <main className="festival-app">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Personal festival calendar</p>
          <div className="hero__headline-row">
            <div>
              <h1>{festivalTitle}</h1>
              <p className="hero__subtitle">{dateRange}</p>
              <p className="hero__disclaimer">
                Independent fan-made calendar tool for Hurricane Festival attendees. Not
                affiliated with the festival organizers.
              </p>
            </div>
            <div className="hero__summary" aria-live="polite">
              <span>{selectedArtists.length}</span>
              selected
            </div>
          </div>
          <p className="hero__copy">
            Pick the acts you do not want to miss and turn the lineup into a
            calendar feed that follows you through the weekend.
          </p>
          <div className="hero__stats">
            <span>{festival.length || "--"} days</span>
            <span>{totalShows || "--"} shows</span>
            <span>{selectedArtists.length} picks</span>
            <span>{conflictingArtists.size} conflicts</span>
            {health.lastUpdated && (
              <span>Updated {formatLastUpdated(health.lastUpdated)}</span>
            )}
          </div>
          <div className="hero__actions">
            <a
              className="calendar-button calendar-button--light"
              href={fullCalendarHref}
            >
              Subscribe to full lineup
            </a>
            <a
              className="ghost-button ghost-button--light"
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <button
              className="ghost-button ghost-button--light"
              type="button"
              onClick={() => copyLink(copyFullCalendarUrl, "calendar-copied")}
            >
              Copy full link
            </button>
          </div>
        </div>
      </section>

      {staleDataBanner && (
        <section className={`status-banner status-banner--${staleDataBanner.kind}`}>
          <div>
            <p>{staleDataBanner.title}</p>
            <span>{staleDataBanner.message}</span>
          </div>
          <button className="ghost-button" type="button" onClick={retryFetch}>
            Retry
          </button>
        </section>
      )}

      {fetchError && (
        <section className="status-banner status-banner--error">
          <div>
            <p>Load issue</p>
            <span>{fetchError}</span>
          </div>
        </section>
      )}

      <section className="schedule" aria-label="Festival schedule">
        {fetchState === "loading" && (
          <div className="state-panel">
            <span className="state-panel__mark" />
            <h2>Loading the lineup</h2>
            <p>Fetching the latest Hurricane schedule.</p>
          </div>
        )}

        {fetchState === "error" && (
          <div className="state-panel state-panel--error">
            <h2>Could not load concerts</h2>
            <p>Please try refreshing the page in a moment.</p>
          </div>
        )}

        {fetchState === "empty" && (
          <div className="state-panel">
            <h2>No concerts available</h2>
            <p>The API responded, but there are no shows to display yet.</p>
          </div>
        )}

        {fetchState === "ready" && activeFestivalDay && (
          <>
            <div className="schedule__header">
              <div>
                <p className="section-kicker">
                  {scheduleView === "lineup" ? "Lineup" : "My Schedule"}
                </p>
                <h2>
                  {scheduleView === "lineup"
                    ? formatDayLabel(activeFestivalDay.day)
                    : "My Schedule"}
                </h2>
              </div>
              <div className="schedule__actions">
                <a
                  className={`calendar-button calendar-button--desktop ${
                    selectedArtists.length ? "" : "calendar-button--disabled"
                  }`}
                  href={calendarHref || undefined}
                  aria-disabled={!selectedArtists.length}
                >
                  Add selected
                </a>
                <button
                  className={`ghost-button ghost-button--desktop ${
                    selectedArtists.length ? "" : "ghost-button--disabled"
                  }`}
                  type="button"
                  disabled={!selectedArtists.length}
                  onClick={() => copyLink(copyCalendarUrl, "calendar-copied")}
                >
                  Copy selected link
                </button>
                {authUser && (
                  <button
                    className={`ghost-button ghost-button--desktop ${
                      canSaveSchedule ? "" : "ghost-button--disabled"
                    }`}
                    type="button"
                    disabled={!canSaveSchedule || savedScheduleBusy}
                    onClick={() => void saveCurrentSchedule()}
                  >
                    {savedScheduleBusy ? "Saving..." : "Save this schedule"}
                  </button>
                )}
                <button
                  className={`ghost-button ghost-button--desktop ${
                    selectedArtists.length ? "" : "ghost-button--disabled"
                  }`}
                  type="button"
                  disabled={!selectedArtists.length}
                  onClick={() => copyLink(shareUrl, "share-copied")}
                >
                  Share picks
                </button>
              </div>
            </div>

            {sharedPicksLoaded && (
              <div className="shared-notice" role="status">
                Shared picks loaded
              </div>
            )}

            <div className="view-switch" aria-label="Schedule view">
              <button
                className={`view-switch__button ${
                  scheduleView === "lineup" ? "view-switch__button--active" : ""
                }`}
                type="button"
                onClick={() => syncScheduleView("lineup")}
              >
                Lineup
              </button>
              <button
                className={`view-switch__button ${
                  scheduleView === "my-schedule"
                    ? "view-switch__button--active"
                    : ""
                }`}
                type="button"
                onClick={() => syncScheduleView("my-schedule")}
              >
                My Schedule
              </button>
            </div>

            {scheduleView === "lineup" ? (
              <>
                <div className="planner-panel">
                  <label className="search-field">
                    <span>Search artist</span>
                    <input
                      type="search"
                      placeholder="Try Florence, Kraftklub, Hansemädchen..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>

                  <div className="filter-row" aria-label="Stage filters">
                    {stageOptions.map((stage) => (
                      <button
                        className={`filter-chip ${
                          selectedStages[stage] ? "filter-chip--active" : ""
                        }`}
                        key={stage}
                        type="button"
                        onClick={() => toggleFilter(stage, setSelectedStages)}
                      >
                        {stage}
                      </button>
                    ))}
                  </div>

                  <div className="filter-row" aria-label="Category filters">
                    {categoryOptions.map((category) => (
                      <button
                        className={`filter-chip ${
                          selectedCategories[category] ? "filter-chip--active" : ""
                        }`}
                        key={category}
                        type="button"
                        onClick={() =>
                          toggleFilter(category, setSelectedCategories)
                        }
                      >
                        {category}
                      </button>
                    ))}
                  </div>

                  <div className="planner-actions">
                    <button
                      className={`toggle-button ${
                        selectedOnly ? "toggle-button--active" : ""
                      }`}
                      type="button"
                      onClick={() => setSelectedOnly((current) => !current)}
                    >
                      Selected only
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={!hasFilters}
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={!selectedArtists.length}
                      onClick={clearSelections}
                    >
                      Clear selections
                    </button>
                  </div>
                </div>

                <nav className="day-tabs" aria-label="Festival days">
                  {festival.map((day) => (
                    <button
                      className={`day-tab ${
                        day.day === activeDay ? "day-tab--active" : ""
                      }`}
                      key={day.day}
                      type="button"
                      onClick={() => setActiveDay(day.day)}
                    >
                      <span>{formatDayLabel(day.day)}</span>
                      <small>{day.events.length} shows</small>
                    </button>
                  ))}
                </nav>

                {filteredShows.length ? (
                  <div className="artist-grid">
                    {filteredShows.map((show) => (
                      <Artist
                        show={show}
                        key={`${show.artist.name}-${show.date_start}-${show.time_start}`}
                        selected={!!selections[show.artist.name]}
                        hasConflict={conflictingArtists.has(show.artist.name)}
                        conflicts={conflictMap[show.artist.name] || []}
                        setSelected={(selected) => {
                          setSelections((current) => ({
                            ...current,
                            [show.artist.name]: selected,
                          }));
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="state-panel state-panel--compact">
                    <h2>No matches</h2>
                    <p>Try clearing filters or switching to another festival day.</p>
                  </div>
                )}
              </>
            ) : (
            <MySchedule
                selectedDays={selectedDays}
                selectedCount={selectedArtists.length}
                calendarHref={calendarHref}
                copyCalendarLink={() =>
                  copyLink(copyCalendarUrl, "calendar-copied")
                }
                copyShareLink={() => copyLink(shareUrl, "share-copied")}
                showLineup={() => syncScheduleView("lineup")}
                conflictMap={conflictMap}
                showOnlyShareable={showOnlyShareable}
                setShowOnlyShareable={setShowOnlyShareable}
              />
            )}
          </>
        )}
      </section>

      <div className="mobile-action" aria-live="polite">
        <div>
          <strong>{selectedArtists.length} selected</strong>
          <span>
            {conflictCount}
            {" "}
            conflicting act
            {conflictCount === 1 ? "" : "s"}
            {selectedArtists.length === 0
              ? " . Choose acts to create a feed"
              : ""}
          </span>
          <span className={`copy-state ${
            copyState === "failed" ? "copy-state--error" : ""
          }`}>
            {copyStateMessage}
          </span>
        </div>
        <div className="mobile-action__buttons">
                <button
                  className={`ghost-button ${
                    selectedArtists.length ? "" : "ghost-button--disabled"
                  }`}
                  type="button"
                  disabled={!selectedArtists.length}
                  onClick={() => copyLink(shareUrl, "share-copied")}
                >
                  Share
                </button>
                {authUser && (
                  <button
                    className={`ghost-button ${
                      canSaveSchedule ? "" : "ghost-button--disabled"
                    }`}
                    type="button"
                    disabled={!canSaveSchedule || savedScheduleBusy}
                    onClick={() => void saveCurrentSchedule()}
                  >
                    Save
                  </button>
                )}
                <button
                  className={`ghost-button ${
                    selectedArtists.length ? "" : "ghost-button--disabled"
                  }`}
                  type="button"
            disabled={!selectedArtists.length}
            onClick={() => copyLink(copyCalendarUrl, "calendar-copied")}
          >
            Copy
          </button>
          <a
            className={`calendar-button ${
              selectedArtists.length ? "" : "calendar-button--disabled"
            }`}
            href={calendarHref || undefined}
            aria-disabled={!selectedArtists.length}
          >
            Add
          </a>
        </div>
      </div>

      <footer className="site-footer" aria-label="Datenschutzerklärung">
        <h2>Datenschutzerklärung</h2>

        <section>
          <h3>1. Verantwortlicher</h3>
          <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
          <p>Louis Meyer<br />louis@lome.dev</p>
        </section>

        <section>
          <h3>2. Hosting und Bereitstellung der Website</h3>
          <p>Diese Website wird auf einem Server bei der Hetzner Online GmbH in Deutschland betrieben.</p>
          <p>
            Beim Aufruf der Website werden technisch erforderliche Informationen
            verarbeitet, um die Website und die bereitgestellten Kalenderfeeds
            auszuliefern. Hierzu können insbesondere folgende Daten gehören:
          </p>
          <ul>
            <li>IP-Adresse</li>
            <li>Datum und Uhrzeit des Zugriffs</li>
            <li>aufgerufene URL bzw. Ressource</li>
            <li>HTTP-Statuscode</li>
            <li>Informationen zum verwendeten Browser und Betriebssystem</li>
          </ul>
          <p>Die Verarbeitung erfolgt zur Bereitstellung, Sicherheit und Stabilität der Website.</p>
          <p>
            Rechtsgrundlage für die Verarbeitung ist Art. 6 Abs. 1 lit. f DSGVO
            (berechtigtes Interesse an einem sicheren und funktionsfähigen Betrieb
            der Website).
          </p>
        </section>

        <section>
          <h3>3. Hosting-Dienstleister</h3>
          <p>
            Für das Hosting dieser Website wird die Hetzner Online GmbH, Industriestraße 25, 91710
            Gunzenhausen, Deutschland, als technischer Infrastruktur-Dienstleister
            eingesetzt.
          </p>
          <p>
            Im Rahmen des Hostings können technisch erforderliche Daten verarbeitet werden,
            soweit dies für den Betrieb der Website notwendig ist.
          </p>
        </section>

        <section>
          <h3>4. Individuelle Kalenderfeeds</h3>
          <p>
            Diese Website ermöglicht die Erstellung individueller Kalenderfeeds für Besucher
            des Hurricane Festivals.
          </p>
          <p>
            Die Auswahl der gewünschten Acts wird nicht dauerhaft auf dem Server gespeichert.
            Stattdessen wird die Auswahl in der Feed-URL kodiert und bei Abruf des
            Kalenderfeeds verarbeitet, um die entsprechenden Kalendereinträge zu erzeugen.
          </p>
          <p>
            Die Feed-URL sollte wie ein persönlicher Link behandelt und nicht öffentlich
            weitergegeben werden.
          </p>
        </section>

        <section>
          <h3>5. Local Storage</h3>
          <p>
            Zur Verbesserung der Benutzerfreundlichkeit verwendet diese Website den Local
            Storage des Browsers.
          </p>
          <p>
            Dabei können Informationen wie ausgewählte Acts oder Einstellungen lokal auf
            dem Endgerät gespeichert werden. Diese Daten verbleiben ausschließlich im
            Browser des Nutzers und werden nicht an Dritte übermittelt.
          </p>
        </section>

        <section>
          <h3>6. Keine Cookies und kein Tracking</h3>
          <p>Diese Website verwendet keine Cookies zu Analyse-, Werbe- oder Trackingzwecken.</p>
          <p>Es werden keine Webanalyse-Dienste eingesetzt und keine Nutzerprofile erstellt.</p>
        </section>

        <section>
          <h3>7. Rechte betroffener Personen</h3>
          <p>Betroffene Personen haben im Rahmen der geltenden Datenschutzgesetze insbesondere folgende Rechte:</p>
          <ul>
            <li>Recht auf Auskunft über die verarbeiteten personenbezogenen Daten</li>
            <li>Recht auf Berichtigung unrichtiger Daten</li>
            <li>Recht auf Löschung personenbezogener Daten</li>
            <li>Recht auf Einschränkung der Verarbeitung</li>
            <li>Recht auf Widerspruch gegen die Verarbeitung</li>
            <li>Recht auf Beschwerde bei einer zuständigen Datenschutzaufsichtsbehörde</li>
          </ul>
        </section>

        <section>
          <h3>8. Kontakt</h3>
          <p>
            Bei Fragen zum Datenschutz kann der Verantwortliche unter der oben genannten
            E-Mail-Adresse kontaktiert werden.
          </p>
        </section>

        <p className="site-footer__meta">Stand: Juni 2026</p>
      </footer>
    </main>
  );
};

export default App;
