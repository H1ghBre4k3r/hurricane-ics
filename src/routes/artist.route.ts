import { Request, Response } from "express";
import ical from "ical-generator";
import { FetchFestivalFn } from "../types";
import { eventFactory } from "../utils";

export const handleGetArtistFactory = (fetchFestival: FetchFestivalFn) => {
    return async (req: Request, res: Response) => {
        try {
            const artists: string[] = JSON.parse(Buffer.from(req.query["q"] as string, "base64").toString("ascii"));
            const festival = await fetchFestival();
            const concerts = festival.shows
                .filter((show) => artists.includes(show.artist.name))
                .map((event) => eventFactory(event));

            const calendar = ical({ name: `Hurricane (${artists.join("; ")})` });
            calendar.events(concerts);
            calendar.serve(res);
        } catch (e) {
            res.sendStatus(400);
        }
    };
};
