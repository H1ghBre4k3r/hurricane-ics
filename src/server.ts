import cors from "cors";
import express, { NextFunction, Request, Response, Router } from "express";
import { handleGetConcertsApiFactory } from "./routes/api/concerts.api";
import { handleGetStatusApiFactory } from "./routes/api/status.api";
import { handleHealthCheck } from "./routes/health";
import {
  handleCreateScheduleFactory,
  handleGetScheduleFactory,
} from "./routes/api/schedule.api";
import { handleGetArtistIcsFactory } from "./routes/ics/artist.ics";
import { handleGetDayIcsFactory } from "./routes/ics/day.ics";
import { handleGetIndexIcsFactory } from "./routes/ics/index.ics";
import { handleGetScheduleIcsFactory } from "./routes/ics/schedule.ics";
import { FetchFestivalFn, GetFestivalStatusFn } from "./types";
import { ScheduleStore } from "./types";
import { createScheduleStore } from "./scheduleStore";

type FetchFestivalWithStatus = FetchFestivalFn & {
  getStatus: GetFestivalStatusFn;
};

export const createServer = (fetchFestival: FetchFestivalWithStatus) => {
  const scheduleStore: ScheduleStore = createScheduleStore();
  const server = express();
  server.use(cors());
  server.use(express.json());

  const requestTimingMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const start = Date.now();
    const shouldTrack =
      req.path.startsWith("/api") ||
      req.path.startsWith("/ics") ||
      req.path === "/healthz";

    if (!shouldTrack) {
      next();
      return;
    }

    res.on("finish", () => {
      console.info(
        JSON.stringify({
          event: "http-request",
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Date.now() - start,
        }),
      );
    });

    next();
  };

  server.use(requestTimingMiddleware);

  server.get("/healthz", handleHealthCheck);

  server.use("/", express.static(`${__dirname}/../frontend/build`));

  const icsRouter = Router();

  icsRouter.get("/", handleGetIndexIcsFactory(fetchFestival));
  icsRouter.get("/day/:day", handleGetDayIcsFactory(fetchFestival));
  icsRouter.get("/artist", handleGetArtistIcsFactory(fetchFestival));
  icsRouter.get(
    "/schedule/:scheduleId",
    handleGetScheduleIcsFactory(fetchFestival, scheduleStore),
  );

  server.use(/^\/ics\/\d{4}/, icsRouter);
  server.use("/ics", icsRouter);

  const apiRouter = Router();
  apiRouter.post("/schedule", handleCreateScheduleFactory(scheduleStore));
  apiRouter.get("/schedule/:scheduleId", handleGetScheduleFactory(scheduleStore));
  apiRouter.get("/concerts", handleGetConcertsApiFactory(fetchFestival));
  apiRouter.get("/status", handleGetStatusApiFactory(fetchFestival.getStatus));
  server.use("/api", apiRouter);

  return server;
};
