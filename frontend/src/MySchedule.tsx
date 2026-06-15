import { FC } from "react";
import { Show } from "../../src/types";
import {
  FestivalDay,
  ShowConflictMap,
  formatDayLabel,
  formatShowTime,
} from "./schedule";

type MyScheduleProps = {
  selectedDays: FestivalDay[];
  selectedCount: number;
  calendarHref: string;
  copyCalendarLink: () => void;
  copyShareLink: () => void;
  showLineup: () => void;
  conflictMap: ShowConflictMap;
  showOnlyShareable: boolean;
  setShowOnlyShareable: (value: boolean) => void;
};

const getInitial = (show: Show): string => {
  return show.artist.name.charAt(0);
};

export const MySchedule: FC<MyScheduleProps> = ({
  selectedDays,
  selectedCount,
  calendarHref,
  copyCalendarLink,
  copyShareLink,
  showLineup,
  conflictMap,
  showOnlyShareable,
  setShowOnlyShareable,
}) => {
  const isShareable = (show: Show): boolean => show.artist.details_url !== "/line-up/";

  const filteredDays = selectedDays
    .map((day) => ({
      ...day,
      events: day.events.filter((show) =>
        showOnlyShareable ? isShareable(show) : true),
    }))
    .filter((day) => day.events.length > 0);

  const visiblePickCount = filteredDays.reduce((memo, day) => memo + day.events.length, 0);

  if (!selectedCount || !visiblePickCount) {
    const emptyMessage =
      selectedCount === 0
        ? "Select artists from the lineup to build a festival timeline and create your personal calendar feed."
        : "No shareable picks match your filter. Toggle off shareable-only to show all selections.";

    return (
      <div className="itinerary-empty state-panel">
        <p className="section-kicker">My Schedule</p>
        <h2>{selectedCount === 0 ? "No picks yet" : "No matching picks"}</h2>
        <p>{emptyMessage}</p>
        <button className="calendar-button" type="button" onClick={showLineup}>
          Browse lineup
        </button>
      </div>
    );
  }

  return (
    <div className="itinerary">
      <div className="itinerary__toolbar">
        <div>
          <p className="section-kicker">Ready to subscribe</p>
          <h3>
            {selectedCount}
            {" "}
            selected
            {" "}
            {selectedCount === 1 ? "act" : "acts"}
          </h3>
        </div>
        <div className="itinerary__actions">
          <a className="calendar-button" href={calendarHref}>
            Add selected
          </a>
          <button
            className="ghost-button"
            type="button"
            onClick={copyCalendarLink}
          >
            Copy selected link
          </button>
          <button className="ghost-button" type="button" onClick={copyShareLink}>
            Share picks
          </button>
          <button
            className="toggle-button"
            type="button"
            aria-pressed={showOnlyShareable}
            onClick={() => setShowOnlyShareable(!showOnlyShareable)}
          >
            {showOnlyShareable ? "Show unavailable shares" : "Only shareable picks"}
          </button>
        </div>
      </div>

      <div className="itinerary__days">
        {filteredDays.map((day) => (
          <section className="itinerary-day" key={day.day}>
            <div className="itinerary-day__header">
              <p className="section-kicker">Festival day</p>
              <h3>{formatDayLabel(day.day)}</h3>
              <span>{day.events.length} picks</span>
            </div>

            <div className="timeline">
              {day.events.map((show) => {
                const conflicts = conflictMap[show.artist.name] || [];
                return (
                  <article
                    className={`timeline-item ${
                      conflicts.length ? "timeline-item--conflict" : ""
                    }`}
                    key={`${show.artist.name}-${show.date_start}-${show.time_start}`}
                  >
                    <div className="timeline-item__time">
                      <span>{formatShowTime(show)}</span>
                    </div>
                    <div className="timeline-item__card">
                      <div className="timeline-item__media" aria-hidden="true">
                        <span>{getInitial(show)}</span>
                      </div>
                      <div className="timeline-item__body">
                        {conflicts.length > 0 && (
                          <span className="timeline-item__conflict-count">
                            {conflicts.length}
                            {" "}
                            overlap
                            {conflicts.length === 1 ? "" : "s"}
                          </span>
                        )}
                        <div className="timeline-item__meta">
                          <span>{show.stage.name}</span>
                          <span>{show.category.name}</span>
                        </div>
                        <h4>{show.artist.name}</h4>
                        {conflicts.length > 0 && (
                          <div className="timeline-item__conflicts">
                            <strong>Time conflict</strong>
                            {conflicts.map((conflict) => (
                              <span
                                key={`${conflict.artist}-${conflict.overlap}`}
                              >
                                {conflict.artist} overlaps {conflict.overlap}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
