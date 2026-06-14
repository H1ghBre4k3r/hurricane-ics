import {
  randomBytes,
  timingSafeEqual,
  createHmac,
  pbkdf2Sync,
} from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { AuthStore, AppUser } from "./types";
import { toAppUser } from "./appStore";

export type AuthenticatedRequest = Request & {
  authUser: AppUser | null;
};

const AUTH_COOKIE_NAME = "hurricane_ics_session";

const parseTtlSeconds = (): number => {
  const raw = process.env.SESSION_TTL_SEC;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 7 * 24 * 60 * 60;
  }

  return Math.floor(parsed);
};

const parseBool = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const SESSION_TTL_SEC = parseTtlSeconds();
const SESSION_MAX_AGE = Math.max(1, SESSION_TTL_SEC);

const AUTH_SECRET_ENV = process.env.AUTH_SECRET;
const AUTH_SECRET = AUTH_SECRET_ENV && AUTH_SECRET_ENV.trim().length > 0
  ? AUTH_SECRET_ENV
  : process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("AUTH_SECRET must be set when NODE_ENV=production");
      })()
    : "hurricane-ics-auth-development-secret";

const toBase64Url = (value: string): string =>
  Buffer.from(value).toString("base64url");

const fromBase64Url = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf8");

const getAuthPayloadSignature = (payload: string): string =>
  createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const parseCookieHeader = (rawCookie?: string): Record<string, string> => {
  if (!rawCookie) {
    return {};
  }

  return rawCookie.split(";").reduce<Record<string, string>>((memo, part) => {
    const [rawKey, ...valueParts] = part.split("=");
    if (!rawKey) {
      return memo;
    }

    const key = rawKey.trim();
    const value = valueParts.join("=").trim();
    memo[key] = decodeURIComponent(value);
    return memo;
  }, {});
};

const readSessionCookie = (req: Request): string | null => {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[AUTH_COOKIE_NAME] || null;
};

const makeSessionPayload = (userId: string, email: string): string => {
  const payload = {
    userId,
    email,
    iat: nowSeconds(),
    exp: nowSeconds() + SESSION_MAX_AGE,
  };

  return JSON.stringify(payload);
};

const makeSessionToken = (userId: string, email: string): string => {
  const payloadJson = makeSessionPayload(userId, email);
  const payloadEncoded = toBase64Url(payloadJson);
  const signature = getAuthPayloadSignature(payloadJson);
  return `${payloadEncoded}.${signature}`;
};

const parseSessionPayload = (rawToken: string):
  | {
      status: "ok";
      userId: string;
      email: string;
      exp: number;
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

  const expected = getAuthPayloadSignature(payloadJson);
  const actual = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expected);
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
    userId?: unknown;
    email?: unknown;
    exp?: unknown;
  };

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

  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return {
      status: "invalid",
      reason: "Session payload missing expiry",
    };
  }

  return {
    status: "ok",
    userId: payload.userId,
    email: payload.email,
    exp: payload.exp,
  };
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

export const makeSessionTokenForUser = (user: AppUser): string =>
  makeSessionToken(user.id, user.email);

export const createAuthenticatedRequest = (
  req: Request,
): AuthenticatedRequest => req as AuthenticatedRequest;

export const clearSessionCookieHeader = (): string => {
  const secure = parseBool(process.env.AUTH_COOKIE_SECURE);
  const base = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly`;
  return `${base}; ${secure ? "Secure; " : ""}SameSite=Lax`;
};

export const makeSessionCookieHeader = (token: string): string => {
  const secure = parseBool(process.env.AUTH_COOKIE_SECURE);
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE}`,
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
  ];

  return parts.filter(Boolean).join("; ");
};

export const createAuthMiddleware = (authStore: AuthStore) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const authReq = createAuthenticatedRequest(req);
    authReq.authUser = null;

    const token = readSessionCookie(req);
    if (!token) {
      next();
      return;
    }

    const parsed = parseSessionPayload(token);
    if (parsed.status !== "ok") {
      next();
      return;
    }

    if (parsed.exp < nowSeconds()) {
      next();
      return;
    }

    const user = await authStore.getUserById(parsed.userId);
    if (!user) {
      next();
      return;
    }

    authReq.authUser = toAppUser(user);
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
