import { FC } from "react";
import { Show } from "../../src/types";
import {
  FestivalDay,
  ShowConflictMap,
  formatDayLabel,
  formatShowTime,
  getImageUrl,
} from "./schedule";

type MyScheduleProps = {
  selectedDays: FestivalDay[];
  selectedCount: number;
  calendarHref: string;
  copyCalendarUrl: string;
  copyLink: (url: string) => void;
  showLineup: () => void;
  conflictMap: ShowConflictMap;
};

const getInitial = (show: Show): string => {
  return show.artist.name.charAt(0);
};

export const MySchedule: FC<MyScheduleProps> = ({
  selectedDays,
  selectedCount,
  calendarHref,
  copyCalendarUrl,
  copyLink,
  showLineup,
  conflictMap,
}) => {
  if (!selectedCount) {
    return (
      <div className="itinerary-empty state-panel">
        <p className="section-kicker">My Schedule</p>
        <h2>No picks yet</h2>
        <p>
          Select artists from the lineup to build a festival timeline and create
          your personal calendar feed.
        </p>
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
            onClick={() => copyLink(copyCalendarUrl)}
          >
            Copy selected link
          </button>
        </div>
      </div>

      <div className="itinerary__days">
        {selectedDays.map((day) => (
          <section className="itinerary-day" key={day.day}>
            <div className="itinerary-day__header">
              <p className="section-kicker">Festival day</p>
              <h3>{formatDayLabel(day.day)}</h3>
              <span>{day.events.length} picks</span>
            </div>

            <div className="timeline">
              {day.events.map((show) => {
                const conflicts = conflictMap[show.artist.name] || [];
                const imageUrl = getImageUrl(show.artist.image);

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
                        {imageUrl ? (
                          <img src={imageUrl} alt="" loading="lazy" />
                        ) : (
                          <span>{getInitial(show)}</span>
                        )}
                      </div>
                      <div className="timeline-item__body">
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
