import { Buffer } from "buffer";
import React, { useEffect, useMemo, useState } from "react";
import { FestivalPlan } from "./../../src/types";
import "./App.css";
import { Artist } from "./Artist";
import { MySchedule } from "./MySchedule";
import {
  FestivalDay,
  buildConflictMap,
  formatDayLabel,
  groupSelectedShowsByDay,
  normalize,
} from "./schedule";
import { parseDate } from "./utils";

type FetchState = "loading" | "ready" | "empty" | "error";
type CopyState = "idle" | "copied" | "failed";
type ScheduleView = "lineup" | "my-schedule";

const SELECTIONS_STORAGE_KEY = "hurricane-ics:selected-artists";

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

const encodeArtists = (artists: string[]): string => {
  return encodeURIComponent(
    Buffer.from(JSON.stringify(artists)).toString("base64"),
  );
};

const makeCalendarUrl = (
  protocol: "https" | "webcal",
  host: string,
  artists: string[],
): string => {
  const base = `${protocol}://${host}/ics`;
  return artists.length ? `${base}/artist/?q=${encodeArtists(artists)}` : base;
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

const App = () => {
  const [festival, setFestival] = useState<FestivalDay[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [activeDay, setActiveDay] = useState<string>("");
  const [selections, setSelections] = useState<{ [key: string]: boolean }>(() =>
    typeof window === "undefined" ? {} : readStoredSelections(),
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
  const [scheduleView, setScheduleView] = useState<ScheduleView>("lineup");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/concerts")
      .then((val) => {
        if (!val.ok) {
          throw new Error(`Failed to load concerts: ${val.status}`);
        }
        return val.json();
      })
      .then((festival: FestivalPlan) => {
        if (cancelled) {
          return;
        }

        const days = [...festival.shows]
          .sort((a, b) => (a.date_timestamp > b.date_timestamp ? 1 : -1))
          .reduce<FestivalDay[]>((memo, cur) => {
            if (!memo.length || memo[memo.length - 1].day !== cur.date_start) {
              memo.push({ day: cur.date_start, events: [] });
            }
            memo[memo.length - 1].events.push(cur);
            return memo;
          }, []);

        setFestival(days);
        setActiveDay(days[0]?.day || "");
        setFetchState(days.length ? "ready" : "empty");
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setFetchState("error");
        }
      });

    return () => {
      cancelled = true;
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

    const artistNames = new Set(allShows.map((show) => show.artist.name));
    setSelections((curSelections) => {
      const cleanedSelections = Object.fromEntries(
        Object.entries(curSelections).filter(
          ([artist, selected]) => selected && artistNames.has(artist),
        ),
      );

      return cleanedSelections;
    });
  }, [allShows]);

  const selectedArtists = useMemo(
    () =>
      Object.entries(selections)
        .filter(([_, selected]) => selected)
        .map(([name]) => name)
        .sort((a, b) => a.localeCompare(b)),
    [selections],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SELECTIONS_STORAGE_KEY,
        JSON.stringify(selectedArtists),
      );
    } catch {
      // Browsers can reject storage writes in private or locked-down modes.
    }
  }, [selectedArtists]);

  const stageOptions = useMemo(
    () =>
      Array.from(new Set(allShows.map((show) => show.stage.name))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [allShows],
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(allShows.map((show) => show.category.name))).sort(
        (a, b) => a.localeCompare(b),
      ),
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

  const host = window.location.host;
  const calendarHref = selectedArtists.length
    ? makeCalendarUrl("webcal", host, selectedArtists)
    : "";
  const fullCalendarHref = makeCalendarUrl("webcal", host, []);
  const copyCalendarUrl = makeCalendarUrl("https", host, selectedArtists);
  const copyFullCalendarUrl = makeCalendarUrl("https", host, []);

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
  }, [
    activeCategoryFilters,
    activeDayShows,
    activeStageFilters,
    query,
    selectedOnly,
    selections,
  ]);

  const totalShows = allShows.length;
  const dateRange = formatDateRange(festival);
  const festivalTitle = formatFestivalTitle(festival);
  const hasFilters =
    !!search.trim() ||
    activeStageFilters.length > 0 ||
    activeCategoryFilters.length > 0 ||
    selectedOnly;

  const toggleFilter = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>,
  ) => {
    setter((current) => ({
      ...current,
      [value]: !current[value],
    }));
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedStages({});
    setSelectedCategories({});
    setSelectedOnly(false);
  };

  const clearSelections = () => {
    setSelections({});
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch (error) {
      console.error(error);
      setCopyState("failed");
    }

    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  return (
    <main className="festival-app">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Personal festival calendar</p>
          <div className="hero__headline-row">
            <div>
              <h1>{festivalTitle}</h1>
              <p className="hero__subtitle">{dateRange}</p>
            </div>
            <div className="hero__summary" aria-live="polite">
              <span>{selectedArtists.length}</span>
              {" "}
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
          </div>
          <div className="hero__actions">
            <a className="calendar-button calendar-button--light" href={fullCalendarHref}>
              Subscribe to full lineup
            </a>
            <button
              className="ghost-button ghost-button--light"
              type="button"
              onClick={() => copyLink(copyFullCalendarUrl)}
            >
              Copy full link
            </button>
          </div>
        </div>
      </section>

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
                  onClick={() => copyLink(copyCalendarUrl)}
                >
                  Copy selected link
                </button>
              </div>
            </div>

            <div className="view-switch" aria-label="Schedule view">
              <button
                className={`view-switch__button ${
                  scheduleView === "lineup" ? "view-switch__button--active" : ""
                }`}
                type="button"
                onClick={() => setScheduleView("lineup")}
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
                onClick={() => setScheduleView("my-schedule")}
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
                        onClick={() => toggleFilter(category, setSelectedCategories)}
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
                        setSelected={(selected) => {
                          setSelections((curSelections) => ({
                            ...curSelections,
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
                copyCalendarUrl={copyCalendarUrl}
                copyLink={copyLink}
                showLineup={() => setScheduleView("lineup")}
                conflictMap={conflictMap}
              />
            )}
          </>
        )}
      </section>

      <div className="mobile-action" aria-live="polite">
        <div>
          <strong>{selectedArtists.length} selected</strong>
          <span>
            {conflictingArtists.size
              ? `${conflictingArtists.size} conflicting picks`
              : selectedArtists.length
                ? "Ready for your calendar"
                : "Choose acts to create a feed"}
          </span>
          <span className="copy-state">
            {copyState === "copied" && "Link copied"}
            {copyState === "failed" && "Copy failed"}
          </span>
        </div>
        <div className="mobile-action__buttons">
          <button
            className={`ghost-button ${
              selectedArtists.length ? "" : "ghost-button--disabled"
            }`}
            type="button"
            disabled={!selectedArtists.length}
            onClick={() => copyLink(copyCalendarUrl)}
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
    </main>
  );
};

export default App;
