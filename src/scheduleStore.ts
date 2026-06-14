import { createHmac, timingSafeEqual } from "crypto";
import {
  SharedSchedule,
  ScheduleLookupResult,
  ScheduleStore,
} from "./types";

const parseTtlDays = (): number => {
  const raw = process.env.SCHEDULE_TTL_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 7;
  }

  return Math.max(1, Math.floor(parsed));
};

const DEFAULT_TTL_DAYS = parseTtlDays();
const SIGNING_SECRET_ENV = process.env.SCHEDULE_SIGNING_SECRET;
const SIGNING_SECRET =
  SIGNING_SECRET_ENV && SIGNING_SECRET_ENV.trim().length > 0
    ? SIGNING_SECRET_ENV
    : process.env.NODE_ENV === "production"
      ? (() => {
          throw new Error(
            "SCHEDULE_SIGNING_SECRET must be set when NODE_ENV=production",
          );
        })()
      : "hurricane-ics-development-secret";

type ScheduleTokenPayload = {
  v: 1;
  artists: string[];
  issuedAt: number;
  exp: number;
};

type ScheduleLookupStatus = ScheduleLookupResult["status"];

type DecodeResult =
  | ({ status: "ok"; payload: ScheduleTokenPayload })
  | ({ status: Exclude<ScheduleLookupStatus, "ok">; reason: string });

const normalizeArtists = (artists: string[]): string[] => {
  return Array.from(
    new Set(
      artists
        .map((artist) => (artist || "").trim())
        .filter((artist) => artist.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
};

const toBase64Url = (value: string): string =>
  Buffer.from(value).toString("base64url");

const fromBase64Url = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf8");

const makeSignature = (payloadJson: string): string =>
  createHmac("sha256", SIGNING_SECRET).update(payloadJson).digest("base64url");

const signToken = (payload: ScheduleTokenPayload): string => {
  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = toBase64Url(payloadJson);
  const signature = makeSignature(payloadJson);
  return `${payloadEncoded}.${signature}`;
};

const decodeBase64Segment = (value: string): string | null => {
  try {
    return fromBase64Url(value);
  } catch {
    return null;
  }
};

type PayloadDecodeResult =
  | { status: "ok"; payload: ScheduleTokenPayload }
  | {
      status: "invalid_payload" | "unsupported_version";
      reason: string;
    };

const decodePayload = (payloadJson: string): PayloadDecodeResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    return {
      status: "invalid_payload",
      reason: "Schedule token payload is not valid JSON",
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      status: "invalid_payload",
      reason: "Schedule token payload is not an object",
    };
  }

  const candidate = parsed as {
    v?: unknown;
    artists?: unknown;
    issuedAt?: unknown;
    exp?: unknown;
  };

  if (typeof candidate.v !== "number") {
    return {
      status: "invalid_payload",
      reason: "Schedule token payload is missing version",
    };
  }

  if (candidate.v !== 1) {
    return {
      status: "unsupported_version",
      reason: "Schedule token version is unsupported",
    };
  }

  if (!Array.isArray(candidate.artists)) {
    return {
      status: "invalid_payload",
      reason: "Schedule token payload is missing artists",
    };
  }

  const artists = candidate.artists
    .filter((artist): artist is string => typeof artist === "string")
    .map((artist) => artist.trim())
    .filter((artist) => artist.length > 0);

  if (!artists.length) {
    return {
      status: "invalid_payload",
      reason: "Schedule token payload has no valid artists",
    };
  }

  if (typeof candidate.issuedAt !== "number" || !Number.isFinite(candidate.issuedAt)) {
    return {
      status: "invalid_payload",
      reason: "Schedule token payload has invalid issue time",
    };
  }

  if (typeof candidate.exp !== "number" || !Number.isFinite(candidate.exp)) {
    return {
      status: "invalid_payload",
      reason: "Schedule token payload has invalid expiry time",
    };
  }

  return {
    status: "ok",
    payload: {
      v: 1,
      artists: normalizeArtists(artists),
      issuedAt: Math.floor(candidate.issuedAt),
      exp: Math.floor(candidate.exp),
    },
  };
};

const decodeToken = (scheduleId: string): DecodeResult => {
  const parts = scheduleId.split(".");
  if (parts.length !== 2) {
    return {
      status: "malformed",
      reason: "Schedule id is not a valid token format",
    };
  }

  const [payloadPart, signaturePart] = parts;
  const payloadJson = decodeBase64Segment(payloadPart);
  if (!payloadJson) {
    return {
      status: "malformed",
      reason: "Schedule token payload is not valid base64url",
    };
  }

  const decodedPayload = decodePayload(payloadJson);
  if (decodedPayload.status !== "ok") {
    return {
      status: decodedPayload.status,
      reason: decodedPayload.reason,
    };
  }

  const { payload } = decodedPayload;

  if (payload.v !== 1) {
    return {
      status: "unsupported_version",
      reason: "Schedule token version is unsupported",
    };
  }

  const expectedSignature = makeSignature(payloadJson);
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signaturePart);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return {
      status: "invalid_signature",
      reason: "Schedule token signature is invalid",
    };
  }

  return { status: "ok", payload };
};

const makeSharedSchedule = (payload: ScheduleTokenPayload): SharedSchedule => {
  const createdAt = new Date(payload.issuedAt).toISOString();
  return {
    id: signToken(payload),
    artists: payload.artists,
    createdAt,
    updatedAt: createdAt,
  };
};

const buildLookup = (status: ScheduleLookupStatus, reason?: string): ScheduleLookupResult => ({
  status,
  reason,
});

export const createScheduleStore = (ttlDays = DEFAULT_TTL_DAYS): ScheduleStore => {
  const ttlMs = Math.max(1, Math.floor(ttlDays) * 24 * 60 * 60 * 1000);

  const bucketTimeNow = (): number => {
    return Math.floor(Date.now() / ttlMs) * ttlMs;
  };

  const createOrGet = (artists: string[]): SharedSchedule => {
    const normalizedArtists = normalizeArtists(artists);
    const issuedAt = bucketTimeNow();
    const payload: ScheduleTokenPayload = {
      v: 1,
      artists: normalizedArtists,
      issuedAt,
      exp: issuedAt + ttlMs,
    };
    return makeSharedSchedule(payload);
  };

  const get = (id: string): ScheduleLookupResult => {
    const decoded = decodeToken(id);
    if (decoded.status !== "ok") {
      return buildLookup(
        decoded.status,
        decoded.reason,
      );
    }

    const payload = decoded.payload;
    if (payload.exp < Date.now()) {
      return buildLookup("expired", "Schedule token has expired");
    }

    return {
      status: "ok",
      schedule: makeSharedSchedule(payload),
    };
  };

  return {
    createOrGet,
    get,
  };
};

export const lookupScheduleFromToken = (id: string): ScheduleLookupResult => {
  const store = createScheduleStore(DEFAULT_TTL_DAYS);
  return store.get(id);
};

export const isSignedScheduleId = (id: string): boolean => {
  const parts = id.split(".");
  return parts.length === 2 && parts.every((part) => part.length > 0);
};

export const getSignedScheduleLookup = (id: string): ScheduleLookupResult => {
  return lookupScheduleFromToken(id);
};
