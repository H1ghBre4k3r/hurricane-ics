import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { Request, Response } from "express";
import { handleGetConcertsApiFactory } from "./routes/api/concerts.api";
import { handleGetStatusApiFactory } from "./routes/api/status.api";
import { handleHealthCheck } from "./routes/health";
import { handleGetArtistIcsFactory } from "./routes/ics/artist.ics";
import { handleGetDayIcsFactory } from "./routes/ics/day.ics";
import { handleGetIndexIcsFactory } from "./routes/ics/index.ics";
import {
  FestivalFetchStatus,
  FestivalPlan,
  SharedSchedule,
} from "./types";
import { createScheduleStore } from "./scheduleStore";
import {
  handleCreateScheduleFactory,
  handleGetScheduleFactory,
} from "./routes/api/schedule.api";
import { handleGetScheduleIcsFactory } from "./routes/ics/schedule.ics";
import { createInMemoryAppStore } from "./appStore";
import {
  handleRegisterFactory,
  handleLoginFactory,
  handleMeFactory,
  handleLogoutAllFactory,
  handleSessionsFactory,
  handleChangePasswordFactory,
} from "./routes/api/auth.api";
import {
  handleCreateMyScheduleFactory,
  handleDeleteMyScheduleFactory,
  handleListMySchedulesFactory,
} from "./routes/api/me-schedules.api";
import { getShowStart } from "./utils";
import {
  createAuthMiddleware,
  hashPassword,
  requireCsrfProtection,
} from "./auth";

const festival: FestivalPlan = {
  shows: [
    {
      category: { id: 33, name: "Warm-Up Party" },
      stage: { id: 533, name: "Wild Coast Stage" },
      date_timestamp: "2606181730",
      date_start: "260618",
      time_start: "17:30",
      time_end: "18:30",
      artist: {
        name: "HANSEMÄDCHEN",
        description: "",
        image: "/fileadmin/hanse.jpg",
        details_url: "/line-up/act/massenkaraoke-mit-den-hansemaedchen/",
        url: "/line-up/act/massenkaraoke-mit-den-hansemaedchen/",
      },
      teasertype: 0,
    },
    {
      category: { id: 33, name: "Warm-Up Party" },
      stage: { id: 533, name: "Wild Coast Stage" },
      date_timestamp: "2606182300",
      date_start: "260618",
      time_start: "23:00",
      time_end: "00:15",
      artist: {
        name: "JULI",
        description: "",
        image: "/fileadmin/juli.jpg",
        details_url: "/line-up/act/juli/",
        url: "/line-up/act/juli/",
      },
      teasertype: 0,
    },
    {
      category: { id: 6, name: "Konzert" },
      stage: { id: 545, name: "Forest Stage" },
      date_timestamp: "2606192300",
      date_start: "260619",
      time_start: "23:00",
      time_end: "00:30",
      artist: {
        name: "KRAFTKLUB",
        description: "",
        image: "/fileadmin/kraftklub.jpg",
        details_url: "/line-up/act/kraftklub/",
        url: "/line-up/act/kraftklub/",
      },
      teasertype: 0,
    },
    {
      category: { id: 38, name: "Electric Wave x Wild Coast Stage" },
      stage: { id: 533, name: "Wild Coast Stage" },
      date_timestamp: "2606190045",
      date_start: "260619",
      time_start: "00:45",
      time_end: "02:00",
      artist: {
        name: "MODESTEP (LIVE)",
        description: "",
        image: "/fileadmin/modestep.jpg",
        details_url: "/line-up/act/modestep-live/",
        url: "/line-up/act/modestep-live/",
      },
      teasertype: 0,
    },
  ],
};

const status: FestivalFetchStatus = {
  cacheAvailable: true,
  stale: false,
  staleReason: null,
  lastSuccessfulFetch: "2026-06-13T12:00:00.000Z",
  lastAttemptedFetch: "2026-06-13T12:00:00.000Z",
  showCount: 4,
  lineupDateRange: { start: "260618", end: "260619" },
  lastError: null,
  health: {
    url: "https://hurricane.de/line-up/",
    sourceMarker: "abc123",
    lineupTimestamp: "2026-06-13T12:00:00.000Z",
    etag: null,
    lastModified: null,
    parsedShowCount: 4,
    requiredMarkers: [
      "m0132_lineupv2",
      "m0132_lineupv2__day",
      "m0132_lineupv2__show",
      "m0132_lineupv2__artist",
      "m0132_lineupv2__time",
      "m0132_lineupv2__stage",
      "m0132_lineupv2__category",
    ],
    missingMarkers: [],
    parseWarnings: [],
  },
};

class MockResponse {
  statusCode = 200;
  headers: { [key: string]: string | number | string[] } = {};
  body = "";
  jsonBody: unknown = undefined;

  setHeader(name: string, value: string | number | string[]) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  end(value: string) {
    this.body = value;
  }

  json(value: unknown) {
    this.jsonBody = value;
  }

  status(statusCode: number) {
    this.statusCode = statusCode;
    return this;
  }

  sendStatus(statusCode: number) {
    this.statusCode = statusCode;
  }
}

const makeResponse = (): Response & MockResponse => {
  return new MockResponse() as Response & MockResponse;
};

const countEvents = (ics: string): number => {
  return (ics.match(/BEGIN:VEVENT/g) || []).length;
};

const encodeArtists = (artists: string[]): string => {
  return Buffer.from(JSON.stringify(artists)).toString("base64");
};

const normalizeArtists = (artists: string[]): string[] => {
  return Array.from(new Set(artists.map((artist) => artist.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
};

const buildExpiredScheduleToken = (artists: string[], secret: string): string => {
  const now = Date.now();
  const issuedAt = Math.floor((now - 2 * 24 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000)) *
    24 * 60 * 60 * 1000;
  const exp = now - 1000;
  const payload = {
    v: 1,
    artists: normalizeArtists(artists),
    issuedAt,
    exp,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = Buffer.from(payloadJson).toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadJson).digest("base64url");
  return `${payloadEncoded}.${signature}`;
};

const buildSignedScheduleToken = (
  artists: string[],
  secret: string,
  now: number = Date.now(),
): string => {
  const ttlMs = 7 * 24 * 60 * 60 * 1000;
  const issuedAt = now;
  const exp = now + ttlMs;
  const payload = {
    v: 1,
    artists,
    issuedAt,
    exp,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = Buffer.from(payloadJson).toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadJson).digest("base64url");
  return `${payloadEncoded}.${signature}`;
};

const fetchFestival = async () => festival;
process.env.SCHEDULE_SIGNING_SECRET ||= "hurricane-ics-development-secret";
const scheduleStore = createScheduleStore(1);
const { authStore, userScheduleStore } = createInMemoryAppStore();

const fetchFestivalWithStatus = Object.assign(fetchFestival, {
  getStatus: () => status,
}) as {
  (): Promise<FestivalPlan>;
  getStatus: () => FestivalFetchStatus;
};

test("health handler returns ok", () => {
  const res = makeResponse();
  handleHealthCheck({} as Request, res);
  assert.equal(res.statusCode, 200);
});

test("api handlers expose concerts and scrape status", async () => {
  const concertsRes = makeResponse();
  await handleGetConcertsApiFactory(fetchFestivalWithStatus)({} as Request, concertsRes);
  assert.equal((concertsRes.jsonBody as { stale: boolean }).stale, false);
  assert.equal(
    (concertsRes.jsonBody as { lastUpdated: string | null }).lastUpdated,
    status.lastSuccessfulFetch,
  );
  assert.equal((concertsRes.jsonBody as { shows: unknown[] }).shows.length, festival.shows.length);
  assert.deepEqual((concertsRes.jsonBody as { health: unknown }).health, status.health);

  const statusRes = makeResponse();
  handleGetStatusApiFactory(() => status)({} as Request, statusRes);
  assert.deepEqual(statusRes.jsonBody, status);
});

test("api concerts reports stale-cache responses", async () => {
  const staleStatus = { ...status, stale: true };
  staleStatus.staleReason = "upstream temporary issue";
  const fetchFestivalWithStale = Object.assign(fetchFestival, {
    getStatus: () => staleStatus,
  }) as {
    (): Promise<FestivalPlan>;
    getStatus: () => typeof staleStatus;
  };

  const concertsRes = makeResponse();
  await handleGetConcertsApiFactory(fetchFestivalWithStale)({} as Request, concertsRes);
  assert.equal((concertsRes.jsonBody as { stale: boolean }).stale, true);
  assert.equal(
    (concertsRes.jsonBody as { staleReason: string | null }).staleReason,
    staleStatus.staleReason,
  );
  assert.equal(
    (concertsRes.jsonBody as { cacheAvailable: boolean }).cacheAvailable,
    true,
  );
});

test("ics handlers emit full, day, and selected artist calendars", async () => {
  const fullRes = makeResponse();
  await handleGetIndexIcsFactory(fetchFestival)({} as Request, fullRes);
  assert.equal(countEvents(fullRes.body), 4);
  assert.match(fullRes.body, /KRAFTKLUB/);
  assert.match(fullRes.body, /DTSTART;TZID=Europe\/Berlin:20260620T004500/);
  assert.match(fullRes.body, /DTEND;TZID=Europe\/Berlin:20260620T020000/);
  assert.equal(fullRes.headers["content-type"], "text/calendar; charset=utf-8");

  const thursdayRes = makeResponse();
  await handleGetDayIcsFactory(fetchFestival)(
    { params: { day: "thursday" } } as unknown as Request,
    thursdayRes,
  );
  assert.equal(countEvents(thursdayRes.body), 2);
  assert.match(thursdayRes.body, /JULI/);
  assert.doesNotMatch(thursdayRes.body, /KRAFTKLUB/);

  const fridayRes = makeResponse();
  await handleGetDayIcsFactory(fetchFestival)(
    { params: { day: "friday" } } as unknown as Request,
    fridayRes,
  );
  assert.equal(countEvents(fridayRes.body), 2);
  assert.match(fridayRes.body, /KRAFTKLUB/);
  assert.match(fridayRes.body, /MODESTEP/);

  const artistRes = makeResponse();
  await handleGetArtistIcsFactory(fetchFestival)(
    { query: { q: encodeArtists(["HANSEMÄDCHEN"]) } } as unknown as Request,
    artistRes,
  );
  assert.equal(countEvents(artistRes.body), 1);
  assert.match(artistRes.body, /HANSEMÄDCHEN/);
});

test("festival-night rollover uses the next calendar day", () => {
  const postMidnightShow = festival.shows.find(
    (show) => show.artist.name === "MODESTEP (LIVE)",
  );

  assert.ok(postMidnightShow);
  assert.equal(postMidnightShow.date_start, "260619");
  const actualStart = getShowStart(postMidnightShow);
  assert.equal(actualStart.getFullYear(), 2026);
  assert.equal(actualStart.getMonth(), 5);
  assert.equal(actualStart.getDate(), 20);
  assert.equal(actualStart.getHours(), 0);
  assert.equal(actualStart.getMinutes(), 45);
});

  test("day and artist calendar handlers reject invalid requests", async () => {
  const invalidDayRes = makeResponse();
  await handleGetDayIcsFactory(fetchFestival)(
    { params: { day: "wednesday" } } as unknown as Request,
    invalidDayRes,
  );
  assert.equal(invalidDayRes.statusCode, 400);

  const invalidArtistRes = makeResponse();
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    await handleGetArtistIcsFactory(fetchFestival)(
      { query: { q: "not-json" } } as unknown as Request,
      invalidArtistRes,
    );
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(invalidArtistRes.statusCode, 400);
});

test("schedule api creates and retrieves shared selections", async () => {
  const createResponse = makeResponse();
  await handleCreateScheduleFactory(scheduleStore)(
    {
      body: {
        artists: ["JULI", "HANSEMÄDCHEN", "JULI", ""],
      },
    } as Request,
    createResponse,
  );
  assert.equal(createResponse.statusCode, 201);
  assert.ok((createResponse.jsonBody as SharedSchedule).id);

  const scheduleId = (createResponse.jsonBody as SharedSchedule).id;

  const stableResponse = makeResponse();
  await handleCreateScheduleFactory(scheduleStore)(
    {
      body: {
        artists: ["HANSEMÄDCHEN", "JULI"],
      },
    } as Request,
    stableResponse,
  );
  assert.equal(stableResponse.statusCode, 201);
  assert.equal(
    (stableResponse.jsonBody as SharedSchedule).id,
    scheduleId,
  );

  const getResponse = makeResponse();
  await handleGetScheduleFactory(scheduleStore)(
    { params: { scheduleId } } as unknown as Request,
    getResponse,
  );
  assert.equal(getResponse.statusCode, 200);
  assert.equal(
    (getResponse.jsonBody as SharedSchedule).artists.length,
    2,
  );
});

test("schedule api returns 404 for invalid signature", async () => {
  const getResponse = makeResponse();
  const secret = process.env.SCHEDULE_SIGNING_SECRET || "hurricane-ics-development-secret";
  const scheduleId = buildSignedScheduleToken(["UNKNOWN_ARTIST"], secret).replace(/.$/, "x");
  await handleGetScheduleFactory(scheduleStore)(
    { params: { scheduleId } } as unknown as Request,
    getResponse,
  );
  assert.equal(getResponse.statusCode, 404);
});

test("schedule api returns 400 for malformed ids", async () => {
  const getResponse = makeResponse();
  await handleGetScheduleFactory(scheduleStore)(
    { params: { scheduleId: "bad-token" } } as unknown as Request,
    getResponse,
  );
  assert.equal(getResponse.statusCode, 400);
});

test("schedule api returns 404 for expired and unsigned ids", async () => {
  const getResponse = makeResponse();
  const expiredSecret =
    process.env.SCHEDULE_SIGNING_SECRET || "hurricane-ics-development-secret";
  const expiredToken = buildExpiredScheduleToken(["HANSEMÄDCHEN"], expiredSecret);
  await handleGetScheduleFactory(scheduleStore)(
    { params: { scheduleId: expiredToken } } as unknown as Request,
    getResponse,
  );
  assert.equal(getResponse.statusCode, 404);

  const invalidSigResponse = makeResponse();
  await handleGetScheduleFactory(scheduleStore)(
    {
      params: {
        scheduleId: `${expiredToken.split(".").slice(0, 1).join(".")}.invalid`,
      },
    } as unknown as Request,
    invalidSigResponse,
  );
  assert.equal(invalidSigResponse.statusCode, 404);
});

test("schedule api rejects missing artist payload", async () => {
  const badResponse = makeResponse();
  await handleCreateScheduleFactory(scheduleStore)(
    { body: {} } as Request,
    badResponse,
  );
  assert.equal(badResponse.statusCode, 400);
});

test("schedule calendar endpoint emits events for shared IDs", async () => {
  const schedule = scheduleStore.createOrGet(["HANSEMÄDCHEN"]);
  const res = makeResponse();
  const handleScheduleIcs = handleGetScheduleIcsFactory(
    fetchFestival,
    scheduleStore,
    userScheduleStore,
  );

  await handleScheduleIcs(
    { params: { scheduleId: schedule.id } } as unknown as Request,
    res,
  );

  assert.equal(countEvents(res.body), 1);
  assert.match(res.body, /HANSEMÄDCHEN/);
});

test("schedule calendar rejects malformed ids", async () => {
  const handleScheduleIcs = handleGetScheduleIcsFactory(
    fetchFestival,
    scheduleStore,
    userScheduleStore,
  );

  const malformedRes = makeResponse();
  await handleScheduleIcs(
    { params: { scheduleId: "bad-token" } } as unknown as Request,
    malformedRes,
  );
  assert.equal(malformedRes.statusCode, 404);

  const unknownRes = makeResponse();
  await handleScheduleIcs(
    {
      params: {
        scheduleId: "eyJhIjoiYiJ9.invalid",
      },
    } as unknown as Request,
    unknownRes,
  );
  assert.equal(unknownRes.statusCode, 404);
});

test("auth register endpoint is temporarily disabled", async () => {
  const response = makeResponse();
  await handleRegisterFactory(authStore)(
    { body: { email: "test@example.com", password: "pass12345" } } as Request,
    response,
  );
  assert.equal(response.statusCode, 503);
  const payload = response.jsonBody as { error: string; disabled: boolean };
  assert.equal(payload.error, "register is temporarily disabled");
  assert.equal(payload.disabled, true);
});

test("auth login endpoint is temporarily disabled", async () => {
  const response = makeResponse();
  await handleLoginFactory(authStore)(
    { body: { email: "test@example.com", password: "pass12345" } } as Request,
    response,
  );
  assert.equal(response.statusCode, 503);
  const payload = response.jsonBody as { error: string; disabled: boolean };
  assert.equal(payload.error, "login is temporarily disabled");
  assert.equal(payload.disabled, true);
});

test("auth routes expose session metadata and enforce password change flow", async () => {
  const createdCredentials = hashPassword("pass12345");
  const created = await authStore.createUser(
    "change@example.com",
    createdCredentials.hash,
    createdCredentials.salt,
  );

  const authUser = {
    id: created.id,
    email: created.email,
    createdAt: created.createdAt,
  };

  const sessionsResponse = makeResponse();
  await handleSessionsFactory()(
    { authUser } as unknown as Request,
    sessionsResponse,
  );
  assert.equal(sessionsResponse.statusCode, 200);
  assert.equal((sessionsResponse.jsonBody as { userId: string }).userId, created.id);

  const weakPasswordResponse = makeResponse();
  await handleChangePasswordFactory(authStore)(
    {
      authUser,
      body: {
        currentPassword: "wrong",
        newPassword: "short",
      },
    } as unknown as Request,
    weakPasswordResponse,
  );
  assert.equal(weakPasswordResponse.statusCode, 401);

  const strongPasswordResponse = makeResponse();
  await handleChangePasswordFactory(authStore)(
    {
      authUser,
      body: {
        currentPassword: "pass12345",
        newPassword: "newpass123",
      },
    } as unknown as Request,
    strongPasswordResponse,
  );
  assert.equal(strongPasswordResponse.statusCode, 200);

  const logoutAllResponse = makeResponse();
  await handleLogoutAllFactory(authStore)(
    {
      authUser,
      cookies: {
        "hurricane_ics_session": "old-token",
      },
    } as unknown as Request,
    logoutAllResponse,
  );
  assert.equal(logoutAllResponse.statusCode, 200);
  const logoutBody = logoutAllResponse.jsonBody as {
    ok: boolean;
    sessionVersion: number;
    tokenIssuedAt: number;
  };
  assert.equal(logoutBody.ok, true);
  assert.ok(logoutBody.sessionVersion > 0);
  assert.ok(logoutBody.tokenIssuedAt > 0);
});

test("auth register rejects weak credentials", async () => {
  const response = makeResponse();
  await handleRegisterFactory(authStore)(
    { body: { email: "weak@example.com", password: "weak" } } as Request,
    response,
  );
  assert.equal(response.statusCode, 503);
  const payload = response.jsonBody as { disabled: boolean };
  assert.equal(payload.disabled, true);
});

test("me auth endpoint returns session user when present", () => {
  const response = makeResponse();
  handleMeFactory()(
    {
      authUser: { id: "u1", email: "demo@hurricane.test", createdAt: "2026-01-01T00:00:00.000Z" },
    } as unknown as Request,
    response,
  );
  assert.equal(response.statusCode, 200);
  assert.equal((response.jsonBody as { id: string }).id, "u1");
});

test("user schedule routes and public resolver support persisted IDs", async () => {
  const createScheduleResponse = makeResponse();
  await handleCreateMyScheduleFactory(userScheduleStore)(
    {
      authUser: { id: "u-calendar", email: "calendar@hurricane.test", createdAt: "2026-01-01T00:00:00.000Z" },
      body: { artists: ["HANSEMÄDCHEN", "JULI"] },
    } as unknown as Request,
    createScheduleResponse,
  );
  assert.equal(createScheduleResponse.statusCode, 201);

  const created = createScheduleResponse.jsonBody as {
    id: string;
    artists: string[];
  };
  assert.equal(created.artists.length, 2);

  const resolvedResponse = makeResponse();
  await handleGetScheduleFactory(scheduleStore, userScheduleStore)(
    { params: { scheduleId: created.id } } as unknown as Request,
    resolvedResponse,
  );
  assert.equal(resolvedResponse.statusCode, 200);
  assert.deepEqual(
    (resolvedResponse.jsonBody as SharedSchedule).artists.sort(),
    ["HANSEMÄDCHEN", "JULI"].sort(),
  );

  const listResponse = makeResponse();
  await handleListMySchedulesFactory(userScheduleStore)(
    {
      authUser: { id: "u-calendar", email: "calendar@hurricane.test", createdAt: "2026-01-01T00:00:00.000Z" },
    } as unknown as Request,
    listResponse,
  );
  assert.equal(listResponse.statusCode, 200);
  const list = listResponse.jsonBody as Array<{ id: string }>;
  assert.equal(list.length, 1);

  const deleteResponse = makeResponse();
  await handleDeleteMyScheduleFactory(userScheduleStore)(
    {
      authUser: { id: "u-calendar", email: "calendar@hurricane.test", createdAt: "2026-01-01T00:00:00.000Z" },
      params: { id: created.id },
    } as unknown as Request,
    deleteResponse,
  );
  assert.equal(deleteResponse.statusCode, 204);

  const removedResponse = makeResponse();
  await handleGetScheduleFactory(scheduleStore, userScheduleStore)(
    { params: { scheduleId: created.id } } as unknown as Request,
    removedResponse,
  );
  assert.equal(removedResponse.statusCode, 410);
});

test("auth middleware clears invalid session cookies", async () => {
  const response = makeResponse();
  let called = false;

  const middleware = createAuthMiddleware(authStore);
  await middleware(
    {
      headers: {
        cookie: "hurricane_ics_session=bad-token",
      },
    } as Request,
    response,
    () => {
      called = true;
    },
  );

  assert.equal(called, true);
  const setCookie = response.headers["set-cookie"];
  const cookieLine = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(typeof cookieLine === "string");
  assert.match(cookieLine, /hurricane_ics_session=;/);
  assert.match(cookieLine, /Max-Age=0/);
  assert.match(cookieLine, /HttpOnly/);
});

test("CSRF middleware requires a matching request token", () => {
  const response = makeResponse();
  let called = false;

  requireCsrfProtection(
    {
      headers: {
        cookie: "XSRF-TOKEN=valid-token",
      },
    } as unknown as Request,
    response,
    () => {
      called = true;
    },
  );

  assert.equal(response.statusCode, 403);
  assert.equal(called, false);

  called = false;
  const allowed = makeResponse();
  requireCsrfProtection(
    {
      headers: {
        cookie: "XSRF-TOKEN=valid-token",
        "x-csrf-token": "valid-token",
      },
    } as unknown as Request,
    allowed,
    () => {
      called = true;
    },
  );
  assert.equal(allowed.statusCode, 200);
  assert.equal(called, true);
});
