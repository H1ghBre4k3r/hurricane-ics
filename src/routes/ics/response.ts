import { Response } from "express";
import { ICalCalendar } from "ical-generator";

export const sendCalendar = (
  res: Response,
  calendar: ICalCalendar,
  filename: string,
) => {
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.setHeader("Cache-Control", "public, max-age=900");
  res.end(calendar.toString());
};
