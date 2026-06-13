import { Request, Response } from "express";
import ical, { ICalCalendarMethod } from "ical-generator";
import { FetchFestivalFn } from "../../types";
import { eventFactory } from "../../utils";
import { sendCalendar } from "./response";

export const handleGetArtistIcsFactory = (fetchFestival: FetchFestivalFn) => {
  return async (req: Request, res: Response) => {
    try {
      const artists: string[] = JSON.parse(
        Buffer.from(req.query["q"] as string, "base64").toString("utf8"),
      );
      const festival = await fetchFestival();
      const concerts = festival.shows
        .filter((show) => artists.includes(show.artist.name))
        .map((event) => eventFactory(event));

      const calendar = ical({
        method: ICalCalendarMethod.PUBLISH,
        name: `Hurricane (${artists.join("; ")})`,
      });
      calendar.events(concerts);
      sendCalendar(res, calendar, "hurricane-artists.ics");
    } catch (e) {
      console.error(e);
      res.sendStatus(400);
    }
  };
};
