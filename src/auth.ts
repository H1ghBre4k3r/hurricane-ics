import {
  randomBytes,
  timingSafeEqual,
  createHmac,
  pbkdf2Sync,
} from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { AuthStore, AppUser, PersistedUser } from "./types";
import { toAppUser } from "./appStore";

export type AuthenticatedRequest = Request & {
  authUser: AppUser | null;
  authSession: {
    issuedAt: number;
    expiresAt: number;
    sessionVersion: number;
    tokenIssuedAt: number;
  } | null;
};

type ParsedCookies = Record<string, string>;
type RateLimitState = {
  bucketResetMs: number;
  hits: number;
};
type RateKeyProvider = (req: Request) => string[];

type SessionPayload = {
  v: 1;
  userId: string;
  email: string;
  exp: number;
  iat: number;
  sv: number;
  ta: number;
};

const AUTH_COOKIE_NAME = "hurricane_ics_session";
const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const CSRF_HEADER_NAME = "x-csrf-token";
const SESSION_PAYLOAD_VERSION = 1;

const parseBooleanEnv = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const parseIntWithBounds = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const bounded = Math.floor(parsed);
  if (bounded < min) {
    return min;
  }

  if (bounded > max) {
    return max;
  }

  return bounded;
};

const parseSameSite = (): "Strict" | "Lax" => {
  const raw = process.env.AUTH_COOKIE_SAMESITE?.trim().toLowerCase();
  if (raw === "lax") {
    return "Lax";
  }
  if (raw === "strict") {
    return "Strict";
  }

  return process.env.NODE_ENV === "production" ? "Strict" : "Lax";
};

const isProduction = process.env.NODE_ENV === "production";
const toBase64Url = (value: string): string =>
  Buffer.from(value).toString("base64url");
const fromBase64Url = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf8");

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const parseSessionSecret = (): string => {
  const raw = process.env.AUTH_SECRET;
  if (raw && raw.trim().length > 0) {
    if (raw.trim().length < 32) {
      throw new Error("AUTH_SECRET must be at least 32 characters");
    }
    return raw;
  }

  return isProduction
    ? (() => {
        throw new Error("AUTH_SECRET must be set when NODE_ENV=production");
      })()
    : "hurricane-ics-auth-development-secret";
};

const parseCsrfSecret = (): string => {
  const raw = process.env.AUTH_CSRF_SECRET;
  if (raw && raw.trim().length > 0) {
    if (raw.trim().length < 32) {
      throw new Error("AUTH_CSRF_SECRET must be at least 32 characters");
    }
    return raw;
  }

  return isProduction
    ? (() => {
        throw new Error("AUTH_CSRF_SECRET must be set when NODE_ENV=production");
      })()
    : "hurricane-ics-csrf-development-secret";
};

const AUTH_SECRET = parseSessionSecret();
const CSRF_SECRET = parseCsrfSecret();

const sessionTtlMin = parseIntWithBounds(
  process.env.SESSION_TTL_MIN_SEC,
  60,
  30,
  30 * 24 * 60 * 60,
);
const sessionTtlMax = parseIntWithBounds(
  process.env.SESSION_TTL_MAX_SEC,
  30 * 24 * 60 * 60,
  sessionTtlMin,
  365 * 24 * 60 * 60,
);
const SESSION_TTL_SECONDS = parseIntWithBounds(
  process.env.SESSION_TTL_SEC,
  7 * 24 * 60 * 60,
  sessionTtlMin,
  sessionTtlMax,
);
const SESSION_REFRESH_WINDOW_SECONDS = Math.max(
  0,
  parseIntWithBounds(process.env.SESSION_REFRESH_WINDOW_SEC, 0, 0, SESSION_TTL_SECONDS),
);
const SESSION_COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE
  ? parseBooleanEnv(process.env.AUTH_COOKIE_SECURE)
  : isProduction;
const SESSION_COOKIE_SAME_SITE = parseSameSite();
const SESSION_MAX_AGE = Math.max(1, SESSION_TTL_SECONDS);

const AUTH_RATE_LIMIT_WINDOW_MS = parseIntWithBounds(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  10 * 60 * 1000,
  5 * 1000,
  120 * 60 * 1000,
);
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = parseIntWithBounds(
  process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  10,
  1,
  200,
);
const AUTH_RATE_LIMIT_ENABLED =
  parseBooleanEnv(process.env.AUTH_RATE_LIMIT_ENABLED) || isProduction;

const getSignature = (payloadJson: string): string =>
  createHmac("sha256", AUTH_SECRET).update(payloadJson).digest("base64url");

const normalizeCookieName = (name: string): string => name.toLowerCase();

const parseCookieHeader = (rawCookie?: string): ParsedCookies => {
  if (!rawCookie) {
    return {};
  }

  return rawCookie.split(";").reduce<ParsedCookies>((memo, part) => {
    const [rawKey, ...valueParts] = part.split("=");
    if (!rawKey) {
      return memo;
    }

    const key = rawKey.trim();
    const value = valueParts.join("=");
    if (!value.length) {
      memo[key] = "";
      return memo;
    }

    try {
      memo[key] = decodeURIComponent(value.trim());
    } catch {
      memo[key] = value.trim();
    }
    return memo;
  }, {});
};

const getCookieValue = (req: Request, name: string): string | null => {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[normalizeCookieName(name)] || cookies[name] || null;
};

const readSessionCookie = (req: Request): string | null => {
  return getCookieValue(req, AUTH_COOKIE_NAME);
};

const readCsrfCookie = (req: Request): string | null => {
  return getCookieValue(req, CSRF_COOKIE_NAME);
};

const readCsrfHeader = (req: Request): string | null => {
  const value = req.headers[CSRF_HEADER_NAME];
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value;
};

const parseSessionPayload = (
  rawToken: string,
):
  | {
      status: "ok";
      userId: string;
      email: string;
      exp: number;
      iat: number;
      sv: number;
      ta: number;
    }
  | {
      status: "invalid";
      reason: string;
    } => {
  const parts = rawToken.split(".");
  if (parts.length !== 2) {
    return {
      status: "invalid",
      reason: "Session token format invalid",
    };
  }

  const [payloadPart, signaturePart] = parts;
  const payloadJson = (() => {
    try {
      return fromBase64Url(payloadPart);
    } catch {
      return null;
    }
  })();

  if (!payloadJson) {
    return {
      status: "invalid",
      reason: "Session payload invalid",
    };
  }

  const expected = getSignature(payloadJson);
  const expectedBuffer = Buffer.from(expected);
  const actual = Buffer.from(signaturePart);
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) {
    return {
      status: "invalid",
      reason: "Session signature invalid",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    return {
      status: "invalid",
      reason: "Session payload invalid",
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      status: "invalid",
      reason: "Session payload invalid",
    };
  }

  const payload = parsed as {
    v?: unknown;
    userId?: unknown;
    email?: unknown;
    exp?: unknown;
    iat?: unknown;
    sv?: unknown;
    ta?: unknown;
  };

  if (payload.v !== SESSION_PAYLOAD_VERSION) {
    return {
      status: "invalid",
      reason: "Session payload version unsupported",
    };
  }

  if (typeof payload.userId !== "string" || !payload.userId) {
    return {
      status: "invalid",
      reason: "Session payload missing user id",
    };
  }

  if (typeof payload.email !== "string" || !payload.email) {
    return {
      status: "invalid",
      reason: "Session payload missing user email",
    };
  }

  if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) {
    return {
      status: "invalid",
      reason: "Session payload missing issue time",
    };
  }

  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return {
      status: "invalid",
      reason: "Session payload missing expiry",
    };
  }

  if (typeof payload.sv !== "number" || !Number.isFinite(payload.sv)) {
    return {
      status: "invalid",
      reason: "Session payload missing session version",
    };
  }

  if (typeof payload.ta !== "number" || !Number.isFinite(payload.ta)) {
    return {
      status: "invalid",
      reason: "Session payload missing token issue marker",
    };
  }

  return {
    status: "ok",
    userId: payload.userId,
    email: payload.email,
    iat: payload.iat,
    exp: payload.exp,
    sv: payload.sv,
    ta: payload.ta,
  };
};

const nowSigned = (): string => randomBytes(20).toString("hex");

const makeSessionPayload = (user: PersistedUser): string => {
  const now = nowSeconds();
  const payload: SessionPayload = {
    v: SESSION_PAYLOAD_VERSION,
    userId: user.id,
    email: user.email,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    sv: user.sessionVersion,
    ta: user.tokenIssuedAt,
  };

  return JSON.stringify(payload);
};

const makeSessionToken = (user: PersistedUser): string => {
  const payloadJson = makeSessionPayload(user);
  const payloadEncoded = toBase64Url(payloadJson);
  const signature = getSignature(payloadJson);
  return `${payloadEncoded}.${signature}`;
};

const constantCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const buildCsrfValue = (): string => {
  return createHmac("sha256", CSRF_SECRET)
    .update(nowSigned())
    .digest("base64url");
};

const getSetCookieHeader = (res: Response): string[] => {
  const getter = (res as { getHeader?: (name: string) => unknown }).getHeader;
  if (!getter) {
    return [];
  }

  const current = getter.call(res, "Set-Cookie");
  if (!current) {
    return [];
  }
  if (typeof current === "string") {
    return [current];
  }

  if (Array.isArray(current)) {
    return current.map((value) => String(value));
  }

  return [];
};

const appendSetCookieHeader = (res: Response, value: string): void => {
  const existing = getSetCookieHeader(res);
  if (!existing.length) {
    res.setHeader("Set-Cookie", value);
    return;
  }

  res.setHeader("Set-Cookie", [...existing, value]);
};

export const makeSessionCookieHeader = (token: string): string => {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE}`,
    "HttpOnly",
    `SameSite=${SESSION_COOKIE_SAME_SITE}`,
  ];

  if (SESSION_COOKIE_SECURE) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

export const clearSessionCookieHeader = (): string => {
  const parts = [
    `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0`,
    "HttpOnly",
    `SameSite=${SESSION_COOKIE_SAME_SITE}`,
  ];

  if (SESSION_COOKIE_SECURE) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

export const makeCsrfCookieHeader = (token: string): string => {
  const parts = [
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE}`,
    `SameSite=${SESSION_COOKIE_SAME_SITE}`,
  ];

  if (SESSION_COOKIE_SECURE) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

export const readCsrfTokenFromRequest = (req: Request): string | null =>
  readCsrfCookie(req);

export const makeSessionTokenForUser = (user: PersistedUser): string =>
  makeSessionToken(user);

export const createAuthenticatedRequest = (
  req: Request,
): AuthenticatedRequest => req as AuthenticatedRequest;

const getRequestIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(",")[0]?.trim() || "unknown";
  }

  return req.ip || "unknown";
};

const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
};

const hitRateLimit = (
  buckets: Map<string, RateLimitState>,
  windowMs: number,
  maxAttempts: number,
  key: string,
): boolean => {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.bucketResetMs < now) {
    buckets.set(key, {
      bucketResetMs: now + windowMs,
      hits: 1,
    });
    return false;
  }

  const nextHits = entry.hits + 1;
  entry.hits = nextHits;
  return nextHits > maxAttempts;
};

const makeRateLimitBuckets = () => new Map<string, RateLimitState>();

const makeRateLimitMiddleware = (
  name: string,
  maxAttempts: number,
  windowMs: number,
  getKeys: RateKeyProvider,
) => {
  const buckets = makeRateLimitBuckets();

  if (!AUTH_RATE_LIMIT_ENABLED || maxAttempts <= 0 || windowMs <= 0) {
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const keys = getKeys(req);
    const blocked = keys.some((key) => {
      return hitRateLimit(buckets, windowMs, maxAttempts, `${name}:${key}`);
    });

    if (!blocked) {
      next();
      return;
    }

    console.warn(
      JSON.stringify({
        event: "auth-rate-limit-hit",
        path: req.path,
        route: name,
        ip: getRequestIp(req),
      }),
    );

    res.status(429).json({ error: "Too many attempts. Please try again later." });
  };
};

export const createAuthRateLimiter = (route: "login" | "register") => {
  const getKeys: RateKeyProvider = (req) => {
    const body = req.body as { email?: unknown } | undefined;
    const identity = normalizeEmail(body?.email) || "anonymous";
    return [`ip:${getRequestIp(req)}`, `identity:${identity}`];
  };

  return makeRateLimitMiddleware(
    `auth-${route}`,
    AUTH_RATE_LIMIT_MAX_ATTEMPTS,
    AUTH_RATE_LIMIT_WINDOW_MS,
    getKeys,
  );
};

export const createCsrfBootstrapMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!readCsrfCookie(req)) {
    appendSetCookieHeader(res, makeCsrfCookieHeader(buildCsrfValue()));
  }

  next();
};

export const requireCsrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authReq = createAuthenticatedRequest(req);
  const expected = readCsrfCookie(req);
  const provided = readCsrfHeader(req);
  const requiresCheck = Boolean(authReq.authUser) || Boolean(expected);

  if (!requiresCheck) {
    next();
    return;
  }

  if (!expected || !provided) {
    console.warn(
      JSON.stringify({
        event: "csrf-missing",
        path: req.path,
        method: req.method,
        hasSession: Boolean(authReq.authUser),
      }),
    );

    res.sendStatus(403);
    return;
  }

  if (!constantCompare(expected, provided)) {
    console.warn(
      JSON.stringify({
        event: "csrf-invalid",
        path: req.path,
        method: req.method,
      }),
    );

    res.sendStatus(403);
    return;
  }

  next();
};

export const hashPassword = (rawPassword: string): { hash: string; salt: string } => {
  const salt = randomBytes(16).toString("hex");
  return {
    hash: pbkdf2Sync(rawPassword, salt, 120000, 32, "sha256").toString("hex"),
    salt,
  };
};

export const verifyPassword = (
  rawPassword: string,
  hash: string,
  salt: string,
): boolean => {
  const candidate = pbkdf2Sync(rawPassword, salt, 120000, 32, "sha256").toString("hex");
  const expected = Buffer.from(hash, "hex");
  const provided = Buffer.from(candidate, "hex");

  return (
    expected.length === provided.length &&
    timingSafeEqual(expected, provided)
  );
};

export const createAuthMiddleware = (authStore: AuthStore) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = createAuthenticatedRequest(req);
    authReq.authUser = null;
    authReq.authSession = null;

    const token = readSessionCookie(req);
    if (!token) {
      next();
      return;
    }

    const parsed = parseSessionPayload(token);
    if (parsed.status !== "ok") {
      console.warn(
        JSON.stringify({
          event: "auth-session-invalid",
          reason: parsed.reason,
        }),
      );
      res.setHeader("Set-Cookie", clearSessionCookieHeader());
      next();
      return;
    }

    if (parsed.exp <= nowSeconds()) {
      res.setHeader("Set-Cookie", clearSessionCookieHeader());
      next();
      return;
    }

    const user = await authStore.getUserById(parsed.userId);
    if (!user) {
      res.setHeader("Set-Cookie", clearSessionCookieHeader());
      next();
      return;
    }

    if (user.sessionVersion !== parsed.sv || user.tokenIssuedAt !== parsed.ta) {
      console.warn(
        JSON.stringify({
          event: "auth-session-revoked",
          userId: user.id,
          parsedSessionVersion: parsed.sv,
          currentSessionVersion: user.sessionVersion,
        }),
      );
      res.setHeader("Set-Cookie", clearSessionCookieHeader());
      next();
      return;
    }

    if (user.email !== parsed.email) {
      res.setHeader("Set-Cookie", clearSessionCookieHeader());
      next();
      return;
    }

    authReq.authUser = toAppUser(user);
    authReq.authSession = {
      issuedAt: parsed.iat,
      expiresAt: parsed.exp,
      sessionVersion: parsed.sv,
      tokenIssuedAt: parsed.ta,
    };

    if (
      SESSION_REFRESH_WINDOW_SECONDS > 0 &&
      parsed.exp - nowSeconds() <= SESSION_REFRESH_WINDOW_SECONDS
    ) {
      const refreshedToken = makeSessionToken(user);
      appendSetCookieHeader(res, makeSessionCookieHeader(refreshedToken));
      console.info(
        JSON.stringify({
          event: "auth-session-refresh",
          userId: user.id,
        }),
      );
    }

    next();
  };
};

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.authUser) {
    res.sendStatus(401);
    return;
  }

  next();
};
