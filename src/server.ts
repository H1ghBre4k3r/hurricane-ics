import cors from "cors";
import express, { NextFunction, Request, Response, Router } from "express";
import { handleGetConcertsApiFactory } from "./routes/api/concerts.api";
import { handleGetStatusApiFactory } from "./routes/api/status.api";
import {
  handleCreateMyScheduleFactory,
  handleDeleteMyScheduleFactory,
  handleGetMyScheduleFactory,
  handleListMySchedulesFactory,
  handleUpdateMyScheduleFactory,
} from "./routes/api/me-schedules.api";
import { handleHealthCheck } from "./routes/health";
import {
  handleChangePasswordFactory,
  handleLoginFactory,
  handleLogoutAllFactory,
  handleLogoutFactory,
  handleMeFactory,
  handleRegisterFactory,
  handleSessionsFactory,
} from "./routes/api/auth.api";
import {
  handleCreateScheduleFactory,
  handleGetScheduleFactory,
} from "./routes/api/schedule.api";
import { handleGetArtistIcsFactory } from "./routes/ics/artist.ics";
import { handleGetDayIcsFactory } from "./routes/ics/day.ics";
import { handleGetIndexIcsFactory } from "./routes/ics/index.ics";
import { handleGetScheduleIcsFactory } from "./routes/ics/schedule.ics";
import { FetchFestivalFn, GetFestivalStatusFn } from "./types";
import { createAppStore } from "./appStore";
import { ScheduleStore } from "./types";
import { createScheduleStore } from "./scheduleStore";
import {
  createAuthMiddleware,
  createAuthRateLimiter,
  createCsrfBootstrapMiddleware,
  requireAuth,
  requireCsrfProtection,
} from "./auth";

type FetchFestivalWithStatus = FetchFestivalFn & {
  getStatus: GetFestivalStatusFn;
};

export const createServer = (fetchFestival: FetchFestivalWithStatus) => {
  const scheduleStore: ScheduleStore = createScheduleStore();
  const { authStore, userScheduleStore } = createAppStore();
  const server = express();
  server.use(cors());
  server.use(express.json());
  server.use(createAuthMiddleware(authStore));

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
  server.use((req, res, next) => {
    if (!req.path.startsWith("/api")) {
      next();
      return;
    }

    createCsrfBootstrapMiddleware(req, res, next);
  });

  server.get("/healthz", handleHealthCheck);

  server.use("/", express.static(`${__dirname}/../frontend/build`));

  const icsRouter = Router();

  icsRouter.get("/", handleGetIndexIcsFactory(fetchFestival));
  icsRouter.get("/day/:day", handleGetDayIcsFactory(fetchFestival));
  icsRouter.get("/artist", handleGetArtistIcsFactory(fetchFestival));
  icsRouter.get(
    "/schedule/:scheduleId",
    handleGetScheduleIcsFactory(fetchFestival, scheduleStore, userScheduleStore),
  );

  server.use(/^\/ics\/\d{4}/, icsRouter);
  server.use("/ics", icsRouter);

  const apiRouter = Router();
  apiRouter.post("/schedule", handleCreateScheduleFactory(scheduleStore));
  apiRouter.get("/schedule/:scheduleId", handleGetScheduleFactory(
    scheduleStore,
    userScheduleStore,
  ));
  apiRouter.get("/concerts", handleGetConcertsApiFactory(fetchFestival));
  apiRouter.get("/status", handleGetStatusApiFactory(fetchFestival.getStatus));

  apiRouter.post(
    "/auth/register",
    requireCsrfProtection,
    createAuthRateLimiter("register"),
    handleRegisterFactory(authStore),
  );
  apiRouter.post(
    "/auth/login",
    requireCsrfProtection,
    createAuthRateLimiter("login"),
    handleLoginFactory(authStore),
  );
  apiRouter.post("/auth/logout", requireAuth, requireCsrfProtection, handleLogoutFactory());
  apiRouter.get("/auth/me", requireAuth, handleMeFactory());
  apiRouter.get("/auth/sessions", requireAuth, handleSessionsFactory());
  apiRouter.post("/auth/logout-all", requireAuth, requireCsrfProtection, handleLogoutAllFactory(authStore));
  apiRouter.post(
    "/auth/change-password",
    requireAuth,
    requireCsrfProtection,
    handleChangePasswordFactory(authStore),
  );

  const myScheduleRouter = Router();
  myScheduleRouter.post(
    "/schedules",
    requireAuth,
    requireCsrfProtection,
    handleCreateMyScheduleFactory(userScheduleStore),
  );
  myScheduleRouter.get("/schedules", requireAuth, handleListMySchedulesFactory(userScheduleStore));
  myScheduleRouter.get(
    "/schedules/:id",
    requireAuth,
    handleGetMyScheduleFactory(userScheduleStore),
  );
  myScheduleRouter.patch(
    "/schedules/:id",
    requireAuth,
    requireCsrfProtection,
    handleUpdateMyScheduleFactory(userScheduleStore),
  );
  myScheduleRouter.delete(
    "/schedules/:id",
    requireAuth,
    requireCsrfProtection,
    handleDeleteMyScheduleFactory(userScheduleStore),
  );
  apiRouter.use("/me", myScheduleRouter);

  server.use("/api", apiRouter);

  return server;
};
