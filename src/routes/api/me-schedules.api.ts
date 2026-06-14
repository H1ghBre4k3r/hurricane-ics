import { Request, Response } from "express";
import { UserScheduleStore } from "../../types";
import { AuthenticatedRequest } from "../../auth";
import { readArtistsFromBody } from "./schedule.api";

export const handleCreateMyScheduleFactory = (
  userScheduleStore: UserScheduleStore,
) => {
  return async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const artists = readArtistsFromBody(req.body);
    const requestName = (() => {
      if (!req.body || typeof req.body !== "object") {
        return null;
      }
      const candidate = (req.body as { name?: unknown }).name;
      return typeof candidate === "string" ? candidate : null;
    })();

    if (!artists.length) {
      res
        .status(400)
        .json({ error: "No valid artists provided. Expect { artists: string[] }." });
      return;
    }

    if (!authReq.authUser) {
      res.sendStatus(401);
      return;
    }

    const created = await userScheduleStore.create(
      authReq.authUser.id,
      artists,
      requestName,
    );

    console.info(
      JSON.stringify({
        event: "user-schedule-create",
        userId: authReq.authUser.id,
        scheduleId: created.id,
        artists: created.artists.length,
      }),
    );

    res.status(201).json(created);
  };
};

export const handleListMySchedulesFactory = (
  userScheduleStore: UserScheduleStore,
) => {
  return async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.authUser) {
      res.sendStatus(401);
      return;
    }

    const schedules = await userScheduleStore.list(authReq.authUser.id);
    console.info(
      JSON.stringify({
        event: "user-schedule-list",
        userId: authReq.authUser.id,
        count: schedules.length,
      }),
    );
    res.json(schedules);
  };
};

export const handleGetMyScheduleFactory = (
  userScheduleStore: UserScheduleStore,
) => {
  return async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const scheduleId = req.params["id"];
    if (!scheduleId) {
      res.status(400).json({ error: "Missing schedule id." });
      return;
    }

    if (!authReq.authUser) {
      res.sendStatus(401);
      return;
    }

    const lookup = await userScheduleStore.get(authReq.authUser.id, scheduleId);
    if (lookup.status === "ok") {
      res.json(lookup.schedule);
      return;
    }

    const status = lookup.status === "deleted" ? 410 : 404;
    console.warn(
      JSON.stringify({
        event:
          lookup.status === "deleted"
            ? "user-schedule-get-deleted"
            : "user-schedule-get-miss",
        userId: authReq.authUser.id,
        scheduleId,
      }),
    );
    res.status(status).json({ error: lookup.reason || "Schedule not found." });
  };
};

export const handleDeleteMyScheduleFactory = (
  userScheduleStore: UserScheduleStore,
) => {
  return async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const scheduleId = req.params["id"];
    if (!scheduleId) {
      res.status(400).json({ error: "Missing schedule id." });
      return;
    }

    if (!authReq.authUser) {
      res.sendStatus(401);
      return;
    }

    const schedule = await userScheduleStore.delete(
      authReq.authUser.id,
      scheduleId,
    );
    if (!schedule) {
      const reason = await userScheduleStore.get(authReq.authUser.id, scheduleId);
      const status = reason.status === "deleted" ? 410 : 404;

      console.warn(
        JSON.stringify({
          event:
            reason.status === "deleted"
              ? "user-schedule-delete-missed-deleted"
              : "user-schedule-delete-miss",
          userId: authReq.authUser.id,
          scheduleId,
        }),
      );
      res.status(status).json({ error: reason.reason || "Schedule not found." });
      return;
    }

    console.info(
      JSON.stringify({
        event: "user-schedule-delete",
        userId: authReq.authUser.id,
        scheduleId,
      }),
    );

    res.sendStatus(204);
  };
};

export const handleUpdateMyScheduleFactory = (
  userScheduleStore: UserScheduleStore,
) => {
  return async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const scheduleId = req.params["id"];
    if (!scheduleId) {
      res.status(400).json({ error: "Missing schedule id." });
      return;
    }

    if (!authReq.authUser) {
      res.sendStatus(401);
      return;
    }

    const patchName = (() => {
      if (!req.body || typeof req.body !== "object") {
        return undefined;
      }
      const candidate = (req.body as { name?: unknown }).name;
      if (typeof candidate === "string") {
        return candidate;
      }
      if (candidate === null) {
        return null;
      }
      return undefined;
    })();

    const patchArtists = readArtistsFromBody(req.body);
    const patch: { name?: string | null; artists?: string[] } = {};
    if (typeof patchName !== "undefined") {
      patch.name = patchName;
    }
    if (patchArtists.length) {
      patch.artists = patchArtists;
    }

    if (!Object.prototype.hasOwnProperty.call(patch, "name") && !patch.artists) {
      res.status(400).json({ error: "No valid update fields provided." });
      return;
    }

    const lookup = await userScheduleStore.update(
      authReq.authUser.id,
      scheduleId,
      patch,
    );

    if (lookup.status === "ok") {
      console.info(
        JSON.stringify({
          event: "user-schedule-update",
          userId: authReq.authUser.id,
          scheduleId,
          updatedFields: Object.keys(patch),
        }),
      );
      res.json(lookup.schedule);
      return;
    }

    const status = lookup.status === "deleted" ? 410 : 404;
    console.warn(
      JSON.stringify({
        event:
          lookup.status === "deleted"
            ? "user-schedule-update-deleted"
            : "user-schedule-update-miss",
        userId: authReq.authUser.id,
        scheduleId,
        reason: lookup.reason,
      }),
    );
    res.status(status).json({ error: lookup.reason || "Schedule not found." });
  };
};
