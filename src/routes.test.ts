import test from "node:test";
import assert from "node:assert/strict";
import { Request, Response } from "express";
import { handleGetConcertsApiFactory } from "./routes/api/concerts.api";
import { handleGetStatusApiFactory } from "./routes/api/status.api";
import { handleHealthCheck } from "./routes/health";
import { handleGetArtistIcsFactory } from "./routes/ics/artist.ics";
import { handleGetDayIcsFactory } from "./routes/ics/day.ics";
import { handleGetIndexIcsFactory } from "./routes/ics/index.ics";
import { FestivalFetchStatus, FestivalPlan } from "./types";

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
  ],
};

const status: FestivalFetchStatus = {
  cacheAvailable: true,
  lastSuccessfulFetch: "2026-06-13T12:00:00.000Z",
  lastAttemptedFetch: "2026-06-13T12:00:00.000Z",
  showCount: 3,
  lineupDateRange: { start: "260618", end: "260619" },
  lastError: null,
};

class MockResponse {
  statusCode = 200;
  headers: { [key: string]: string | number | string[] } = {};
  body = "";
  jsonBody: unknown = undefined;

  setHeader(name: string, value: string | number | string[]) {
    this.headers[name.toLowerCase()] = value;
  }

  end(value: string) {
    this.body = value;
  }

  json(value: unknown) {
    this.jsonBody = value;
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

const fetchFestival = async () => festival;

test("health handler returns ok", () => {
  const res = makeResponse();
  handleHealthCheck({} as Request, res);
  assert.equal(res.statusCode, 200);
});

test("api handlers expose concerts and scrape status", async () => {
  const concertsRes = makeResponse();
  await handleGetConcertsApiFactory(fetchFestival)({} as Request, concertsRes);
  assert.deepEqual(concertsRes.jsonBody, festival);

  const statusRes = makeResponse();
  handleGetStatusApiFactory(() => status)({} as Request, statusRes);
  assert.deepEqual(statusRes.jsonBody, status);
});

test("ics handlers emit full, day, and selected artist calendars", async () => {
  const fullRes = makeResponse();
  await handleGetIndexIcsFactory(fetchFestival)({} as Request, fullRes);
  assert.equal(countEvents(fullRes.body), 3);
  assert.match(fullRes.body, /KRAFTKLUB/);
  assert.equal(fullRes.headers["content-type"], "text/calendar; charset=utf-8");

  const thursdayRes = makeResponse();
  await handleGetDayIcsFactory(fetchFestival)(
    { params: { day: "thursday" } } as unknown as Request,
    thursdayRes,
  );
  assert.equal(countEvents(thursdayRes.body), 2);
  assert.match(thursdayRes.body, /JULI/);
  assert.doesNotMatch(thursdayRes.body, /KRAFTKLUB/);

  const artistRes = makeResponse();
  await handleGetArtistIcsFactory(fetchFestival)(
    { query: { q: encodeArtists(["HANSEMÄDCHEN"]) } } as unknown as Request,
    artistRes,
  );
  assert.equal(countEvents(artistRes.body), 1);
  assert.match(artistRes.body, /HANSEMÄDCHEN/);
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
