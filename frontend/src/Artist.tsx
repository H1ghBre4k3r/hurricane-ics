import { FC } from "react";
import { Show } from "../../src/types";
import { parseDate } from "./utils";

type ArtistProps = {
  show: Show;
  selected: boolean;
  setSelected: (selected: boolean) => void;
};

const formatTime = (show: Show): string => {
  const start = parseDate(show.date_start, show.time_start);
  const end = parseDate(show.date_start, show.time_end);

  while (end < start) {
    end.setDate(end.getDate() + 1);
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

const getImageUrl = (image: string): string => {
  if (!image) {
    return "";
  }

  return image.startsWith("http") ? image : `https://hurricane.de${image}`;
};

export const Artist: FC<ArtistProps> = ({ show, selected, setSelected }) => {
  const name = show.artist.name;
  const imageUrl = getImageUrl(show.artist.image);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => setSelected(!selected)}
      className={`artist-card ${selected ? "artist-card--selected" : ""}`}
    >
      <span className="artist-card__media" aria-hidden="true">
        {imageUrl ? (
          <img src={imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="artist-card__fallback">{name.charAt(0)}</span>
        )}
        <span className="artist-card__time">{formatTime(show)}</span>
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
      </span>
    </button>
  );
};
