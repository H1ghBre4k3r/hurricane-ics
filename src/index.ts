import express from "express";
import fetch from "node-fetch";
import ical, { ICalEventData } from "ical-generator";

const calendar = ical({ name: "Hurricane Calendar" });

function parseDate(rawDate: string, rawTime: string): Date {
    const [day, month, year] = /(\d\d)(\d\d)(\d\d)/.exec(rawDate)!.slice(1).map(d => parseInt(d, 10));
    const [hour, minute] = /(\d+):(\d+)/.exec(rawTime)!.slice(1).map(d => parseInt(d, 10));
    return new Date(year, month, day, hour, minute);
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
        const start = parseDate(show.date_start, show.time_start);
        const end = parseDate(show.date_start, show.time_end);
        // Handle case where event goes past midnight
        while (end < start) {
            end.setDate(end.getDate() + 1);
        }
        return {
            summary: show.artist.name,
            location: show.stage.name,
            start,
            end,
            description: show.artist.description,
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
