import { Request, Response } from "express";
import { AuthStore, AppUser } from "../../types";
import {
  clearSessionCookieHeader,
  makeSessionCookieHeader,
  makeSessionTokenForUser,
} from "../../auth";
import { toAppUser } from "../../appStore";
import { hashPassword, verifyPassword } from "../../auth";
import { createAuthenticatedRequest, AuthenticatedRequest } from "../../auth";

type SignInPayload = {
  email: string | null;
  password: string | null;
};

const normalizeAuthPayload = (body: unknown): SignInPayload => {
  if (!body || typeof body !== "object") {
    return { email: null, password: null };
  }

  const candidate = body as {
    email?: unknown;
    password?: unknown;
  };

  return {
    email: typeof candidate.email === "string" ? candidate.email.trim() : null,
    password: typeof candidate.password === "string" ? candidate.password : null,
  };
};

const isValidEmail = (value: string): boolean => {
  return /.+@.+\..+/.test(value);
};

const isStrongPassword = (value: string): boolean => {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
};

const buildAuthSessionPayload = (user: AppUser) => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt,
});

export const handleRegisterFactory = (authStore: AuthStore) => {
  return async (req: Request, res: Response) => {
    const { email, password } = normalizeAuthPayload(req.body);
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ error: "Invalid email address." });
      return;
    }

    if (!isStrongPassword(password)) {
      res
        .status(400)
        .json({ error: "Password must be at least 8 chars with letters and numbers." });
      return;
    }

    const existing = await authStore.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "Email already registered." });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const persisted = await authStore.createUser(email, hash, salt);
    const appUser = toAppUser(persisted);
    const token = makeSessionTokenForUser(appUser);

    res
      .setHeader("Set-Cookie", makeSessionCookieHeader(token))
      .status(201)
      .json(buildAuthSessionPayload(appUser));
  };
};

export const handleLoginFactory = (authStore: AuthStore) => {
  return async (req: Request, res: Response) => {
    const { email, password } = normalizeAuthPayload(req.body);
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const persisted = await authStore.getUserByEmail(email);
    if (!persisted || !verifyPassword(password, persisted.passwordHash, persisted.passwordSalt)) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const appUser = toAppUser(persisted);
    const token = makeSessionTokenForUser(appUser);
    res
      .setHeader("Set-Cookie", makeSessionCookieHeader(token))
      .json(buildAuthSessionPayload(appUser));
  };
};

export const handleLogoutFactory = () => {
  return (_req: Request, res: Response) => {
    res.setHeader("Set-Cookie", clearSessionCookieHeader());
    res.json({ ok: true });
  };
};

export const handleMeFactory = () => {
  return (req: Request, res: Response) => {
    const authReq = createAuthenticatedRequest(req) as AuthenticatedRequest;
    if (!authReq.authUser) {
      res.sendStatus(401);
      return;
    }

    res.json(buildAuthSessionPayload(authReq.authUser));
  };
};
