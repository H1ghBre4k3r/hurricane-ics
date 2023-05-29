import { FC } from "react";
import { Show } from "../../src/types";
import { parseDate } from "./utils";

type ArtistProps = {
  show: Show;
  selected: boolean;
  setSelected: (selected: boolean) => void;
};

export const Artist: FC<ArtistProps> = ({ show, selected, setSelected }) => {
  let name = show.artist.name;
  const start = parseDate(show.date_start, show.time_start);
  return (
    <div
      onClick={() => setSelected(!selected)}
      className={`inline-block bg-white dark:bg-slate-800 rounded-lg px-2 py-2 ring-1 m-2 w-fit ring-slate-900/5 shadow-xl ${
        selected ? "border-blue-400" : "border-white dark:border-slate-800"
      } border-4 `}
    >
      <h3 className="text-slate-900 dark:text-white text-base font-medium tracking-tight">
        {name}
      </h3>
      <p className="text-slate-500 dark:text-slate-400  text-sm">
        {start.toLocaleString()}
      </p>
      <p className="text-slate-500 dark:text-slate-400  text-sm">
        {show.stage.name}
      </p>
    </div>
  );
};
