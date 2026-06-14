import cors from "cors";
import express, { NextFunction, Request, Response, Router } from "express";
import { handleGetConcertsApiFactory } from "./routes/api/concerts.api";
import { handleGetStatusApiFactory } from "./routes/api/status.api";
import { handleHealthCheck } from "./routes/health";
import { handleGetArtistIcsFactory } from "./routes/ics/artist.ics";
import { handleGetDayIcsFactory } from "./routes/ics/day.ics";
import { handleGetIndexIcsFactory } from "./routes/ics/index.ics";
import { FetchFestivalFn, GetFestivalStatusFn } from "./types";

type FetchFestivalWithStatus = FetchFestivalFn & {
  getStatus: GetFestivalStatusFn;
};

export const createServer = (fetchFestival: FetchFestivalWithStatus) => {
  const server = express();
  server.use(cors());

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

  server.use(/^\/ics\/\d{4}/, icsRouter);
  server.use("/ics", icsRouter);

  const apiRouter = Router();
  apiRouter.get("/concerts", handleGetConcertsApiFactory(fetchFestival));
  apiRouter.get("/status", handleGetStatusApiFactory(fetchFestival.getStatus));
  server.use("/api", apiRouter);

  return server;
};
