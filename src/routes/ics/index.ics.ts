import { Request, Response } from "express";
import ical from "ical-generator";
import { FetchFestivalFn } from "../../types";
import { eventFactory } from "../../utils";

export const handleGetIndexIcsFactory = (fetchFestival: FetchFestivalFn) => {
  return async (_req: Request, res: Response) => {
    const calendar = ical({ name: "Hurricane Calendar" });
    const festival = await fetchFestival();
    const concerts = festival.shows.map((show) => eventFactory(show));
    calendar.events(concerts);
    calendar.serve(res);
  };
};
