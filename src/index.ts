import express from "express";
import fetch from "node-fetch";
import ical, { ICalEventData } from "ical-generator";

const calendar = ical({ name: "Hurricane Calendar" });

enum Day {
    thursday = 0,
    friday = 1,
    saturday = 2,
    sunday = 3,
    monday = 4,
}

enum Location {
    WildCoastStage = "Wild Coast Stage",
    CoastStage = "Coast Stage",
    ForestStage = "Forest Stage",
    RiverStage = "River Stage",
    MountainStage = "Mountain Stage",
}

function event(day: Day, hour: number, minutes = 0): Date {
    return new Date(2022, 5, 16 + day, hour, minutes);
}

type ConcertDate = {
    hours: number;
    minutes: number;
};

function date(hours: number, minutes = 0): ConcertDate {
    return {
        hours,
        minutes,
    };
}

type Category = {
    id: number;
    name: string;
};

type Stage = {
    id: number;
    name: string;
};

type Artist = {
    name: string;
    description: string;
    image: string;
    details_url: string;
    url: string;
};

type Show = {
    category: Category;
    stage: Stage;
    date_timestamp: string;
    date_start: string;
    time_start: string;
    time_end: string;
    artist: Artist;
    teasertype: number;
};

type FestivalPlan = {
    shows: Show[];
};

(async () => {
    const response = await fetch("https://hurricane.de/de/line-up");
    const raw = await response.text();
    const match = /var\s+timetableEvents\s*=\s*(\{.+?\});/.exec(raw);
    const festival: FestivalPlan = match ? JSON.parse(match[1]) : { shows: [] };

    const concerts = festival.shows.map<ICalEventData>(show => {
        return {
            summary: show.artist.name,
            location: show.stage.name,
            // start: event(parseInt(day, 10), concert.start.hours, concert.start.minutes),
            // end: event(parseInt(day, 10), concert.end.hours, concert.end.minutes),
            // categories: [
            //     {
            //         name: concert.location,
            //     },
            // ],
            timezone: "Europe/Berlin",
        };
    });

    calendar.events(concerts);

    const server = express();

    server.get("/ics/2022", (_req, res) => calendar.serve(res));

    server.listen(3000, () => {
        console.log(`Started listening on port :3000`);
    });
})();
