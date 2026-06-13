import { Buffer } from "buffer";
import React, { useEffect, useMemo, useState } from "react";
import { FestivalPlan, Show } from "./../../src/types";
import "./App.css";
import { Artist } from "./Artist";
import { parseDate } from "./utils";

type FestivalDay = {
  day: string;
  events: Show[];
};

type FetchState = "loading" | "ready" | "empty" | "error";

const formatDayLabel = (rawDay: string): string => {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(parseDate(rawDay, "00:00"));
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

const App = () => {
  const [festival, setFestival] = useState<FestivalDay[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [activeDay, setActiveDay] = useState<string>("");
  const [selections, setSelections] = useState<{ [key: string]: boolean }>({});

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

  const selectedArtists = useMemo(
    () =>
      Object.entries(selections)
        .filter(([_, selected]) => selected)
        .map(([name]) => name),
    [selections],
  );

  const calendarHref = selectedArtists.length
    ? `webcal://${window.location.host}/ics/artist/?q=${Buffer.from(
        JSON.stringify(selectedArtists),
      ).toString("base64")}`
    : "";

  const activeFestivalDay = festival.find((day) => day.day === activeDay);
  const totalShows = festival.reduce((sum, day) => sum + day.events.length, 0);
  const dateRange = formatDateRange(festival);

  return (
    <main className="festival-app">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Personal festival calendar</p>
          <div className="hero__headline-row">
            <div>
              <h1>Hurricane 2026</h1>
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
                <p className="section-kicker">Lineup</p>
                <h2>{formatDayLabel(activeFestivalDay.day)}</h2>
              </div>
              <a
                className={`calendar-button calendar-button--desktop ${
                  selectedArtists.length ? "" : "calendar-button--disabled"
                }`}
                href={calendarHref || undefined}
                aria-disabled={!selectedArtists.length}
              >
                Add selected
              </a>
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

            <div className="artist-grid">
              {activeFestivalDay.events.map((show) => (
                <Artist
                  show={show}
                  key={`${show.artist.name}-${show.date_start}-${show.time_start}`}
                  selected={!!selections[show.artist.name]}
                  setSelected={(selected) => {
                    setSelections((curSelections) => ({
                      ...curSelections,
                      [show.artist.name]: selected,
                    }));
                  }}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <div className="mobile-action" aria-live="polite">
        <div>
          <strong>{selectedArtists.length} selected</strong>
          <span>
            {selectedArtists.length
              ? "Ready for your calendar"
              : "Choose acts to create a feed"}
          </span>
        </div>
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
    </main>
  );
};

export default App;
