import { Buffer } from "buffer";
import React, { useEffect, useState } from "react";
import { FestivalPlan, Show } from "./../../src/types";
import "./App.css";
import { Artist } from "./Artist";
import { parseDate } from "./utils";

type FestivalDay = {
    day: string;
    events: Show[];
};

const App = () => {
    const [festival, setFestival] = useState<FestivalDay[]>([]);

    const [selections, setSelections] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        fetch("/api/concerts")
            .then((val) => val.json())
            .then((festival: FestivalPlan) => {
                const days = festival.shows
                    .sort((a, b) => (a.date_timestamp > b.date_timestamp ? 1 : -1))
                    .reduce<FestivalDay[]>((memo, cur) => {
                        if (!memo.length || memo[memo.length - 1].day !== cur.date_start) {
                            memo.push({ day: cur.date_start, events: [] });
                        }
                        memo[memo.length - 1].events.push(cur);
                        return memo;
                    }, []);
                setFestival(days);
            });
    }, [setFestival]);

    return (
        <div>
            <form>
                {festival.map((day, i) => {
                    return (
                        <div key={day.day} className="mx-autorounded-md">
                            <details className=" duration-300" open={!i}>
                                <summary className="bg-inherit px-5 py-3 text-lg cursor-pointer">
                                    {parseDate(day.day, "00:00").toLocaleDateString()}
                                </summary>
                                <div className="bg-white px-5 py-3 text-sm font-light">
                                    {day.events.map((show) => {
                                        return (
                                            <Artist
                                                show={show}
                                                key={show.artist.name}
                                                selected={!!selections[show.artist.name]}
                                                setSelected={(selected) => {
                                                    setSelections((curSelections) => {
                                                        const newSelections = {
                                                            ...curSelections,
                                                        };
                                                        newSelections[show.artist.name] = selected;
                                                        return newSelections;
                                                    });
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            </details>
                        </div>
                    );
                })}
                <div>
                    {!!Object.entries(selections).filter(([_, selected]) => selected).length &&
                        `${window.location.href}ics/2022/artist/?q=${Buffer.from(
                            JSON.stringify(
                                Object.entries(selections)
                                    .filter(([_, selected]) => selected)
                                    .map(([name, _]) => name)
                            )
                        ).toString("base64")}`}
                </div>
            </form>
        </div>
    );
};

export default App;
