import { FC } from "react";
import { Show } from "../../src/types";
import { formatShowTime, getImageUrl } from "./schedule";
import { ConflictDetail } from "./schedule";

type ArtistProps = {
  show: Show;
  selected: boolean;
  hasConflict: boolean;
  conflicts: ConflictDetail[];
  setSelected: (selected: boolean) => void;
};

export const Artist: FC<ArtistProps> = ({
  show,
  selected,
  hasConflict,
  conflicts,
  setSelected,
}) => {
  const name = show.artist.name;
  const imageUrl = getImageUrl(show.artist.image);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => setSelected(!selected)}
      className={`artist-card ${selected ? "artist-card--selected" : ""} ${
        hasConflict ? "artist-card--conflict" : ""
      }`}
      aria-label={`${selected ? "Unselect" : "Select"} ${name}`}
    >
      <span className="artist-card__media" aria-hidden="true">
        {imageUrl ? (
          <img src={imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="artist-card__fallback">{name.charAt(0)}</span>
        )}
        <span className="artist-card__time">{formatShowTime(show)}</span>
      </span>

      <span className="artist-card__body">
        <span className="artist-card__meta">
          <span>{show.stage.name}</span>
          <span>{show.category.name}</span>
        </span>
        <span className="artist-card__title">{name}</span>
        <span className="artist-card__select">
          {selected ? "Selected" : "Add to calendar"}
        </span>
        {hasConflict && (
          <span className="artist-card__conflict">Time conflict</span>
        )}
        {conflicts.length > 0 && (
          <div className="artist-card__conflicts" aria-live="polite">
            {conflicts.map((conflict) => (
              <span key={`${conflict.artist}-${conflict.overlap}`}>
                {conflict.artist}: {conflict.overlap}
              </span>
            ))}
          </div>
        )}
      </span>
    </button>
  );
};
