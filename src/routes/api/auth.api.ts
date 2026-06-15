import { Request, Response } from "express";
import { AuthStore, AppUser } from "../../types";
import {
  clearSessionCookieHeader,
  makeSessionCookieHeader,
  makeSessionTokenForUser,
  createAuthenticatedRequest,
  AuthenticatedRequest,
} from "../../auth";
import { toAppUser } from "../../appStore";
import { hashPassword, verifyPassword } from "../../auth";

type SignInPayload = {
  email: string | null;
  password: string | null;
};

type ChangePasswordPayload = {
  currentPassword: string | null;
  newPassword: string | null;
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
    email:
      typeof candidate.email === "string"
        ? candidate.email.trim().toLowerCase()
        : null,
    password: typeof candidate.password === "string" ? candidate.password : null,
  };
};

const normalizeChangePasswordPayload = (body: unknown): ChangePasswordPayload => {
  if (!body || typeof body !== "object") {
    return { currentPassword: null, newPassword: null };
  }

  const candidate = body as {
    currentPassword?: unknown;
    newPassword?: unknown;
  };

  return {
    currentPassword:
      typeof candidate.currentPassword === "string" ? candidate.currentPassword : null,
    newPassword: typeof candidate.newPassword === "string" ? candidate.newPassword : null,
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

const emitStructuredAuthEvent = (event: string, extras?: Record<string, unknown>) => {
  console.info(JSON.stringify({ event, ...extras }));
};

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
      emitStructuredAuthEvent("auth-register-fail", { email, reason: "duplicate" });
      res.status(409).json({ error: "Email already registered." });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const persisted = await authStore.createUser(email, hash, salt);

    const token = makeSessionTokenForUser(persisted);
    const cookies = [makeSessionCookieHeader(token)];
    res.setHeader("Set-Cookie", cookies);

    emitStructuredAuthEvent("auth-register-success", {
      userId: persisted.id,
      email: persisted.email,
    });

    const appUser = toAppUser(persisted);
    res.status(201).json(buildAuthSessionPayload(appUser));
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
      emitStructuredAuthEvent("auth-login-fail", { email: email || "<missing>" });
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const rotated = await authStore.revokeAllSessions(persisted.id);
    const refreshed = {
      ...persisted,
      sessionVersion: rotated.sessionVersion,
      tokenIssuedAt: rotated.tokenIssuedAt,
    };

    const token = makeSessionTokenForUser(refreshed);
    res.setHeader("Set-Cookie", [makeSessionCookieHeader(token)]);

    emitStructuredAuthEvent("auth-login-success", {
      userId: persisted.id,
    });

    const appUser = toAppUser(refreshed);
    res.json(buildAuthSessionPayload(appUser));
  };
};

export const handleLogoutFactory = () => {
  return (_req: Request, res: Response) => {
    emitStructuredAuthEvent("auth-logout", {});
    res.setHeader("Set-Cookie", clearSessionCookieHeader());
    res.json({ ok: true });
  };
};

export const handleLogoutAllFactory = (authStore: AuthStore) => {
  return async (req: Request, res: Response) => {
    const authReq = createAuthenticatedRequest(req) as AuthenticatedRequest;
    if (!authReq.authUser) {
      res.sendStatus(401);
      return;
    }

    const rotated = await authStore.revokeAllSessions(authReq.authUser.id);
    emitStructuredAuthEvent("auth-logout-all", {
      userId: authReq.authUser.id,
      sessionVersion: rotated.sessionVersion,
    });

    res.setHeader("Set-Cookie", clearSessionCookieHeader());
    res.json({
      ok: true,
      sessionVersion: rotated.sessionVersion,
      tokenIssuedAt: rotated.tokenIssuedAt,
    });
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

export const handleSessionsFactory = () => {
  return (req: Request, res: Response) => {
    const authReq = createAuthenticatedRequest(req) as AuthenticatedRequest;
    if (!authReq.authUser) {
      res.sendStatus(401);
      return;
    }

    res.json({
      userId: authReq.authUser.id,
      email: authReq.authUser.email,
      createdAt: authReq.authUser.createdAt,
      session: authReq.authSession
        ? {
            issuedAt: authReq.authSession.issuedAt,
            expiresAt: authReq.authSession.expiresAt,
            sessionVersion: authReq.authSession.sessionVersion,
            tokenIssuedAt: authReq.authSession.tokenIssuedAt,
          }
        : null,
    });
  };
};

export const handleChangePasswordFactory = (authStore: AuthStore) => {
  return async (req: Request, res: Response) => {
    const authReq = createAuthenticatedRequest(req) as AuthenticatedRequest;
    if (!authReq.authUser) {
      res.sendStatus(401);
      return;
    }

    const { currentPassword, newPassword } = normalizeChangePasswordPayload(req.body);
    if (!currentPassword || !newPassword) {
      res
        .status(400)
        .json({ error: "Current password and new password are required." });
      return;
    }

    const persisted = await authStore.getUserById(authReq.authUser.id);
    if (!persisted || !verifyPassword(currentPassword, persisted.passwordHash, persisted.passwordSalt)) {
      emitStructuredAuthEvent("auth-change-password-fail", {
        userId: authReq.authUser.id,
      });
      res.status(401).json({ error: "Current password is incorrect." });
      return;
    }

    if (!isStrongPassword(newPassword)) {
      res
        .status(400)
        .json({ error: "Password must be at least 8 chars with letters and numbers." });
      return;
    }

    const nextHash = hashPassword(newPassword);
    const updated = await authStore.updatePassword(
      authReq.authUser.id,
      nextHash.hash,
      nextHash.salt,
    );

    if (!updated) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const rotated = await authStore.revokeAllSessions(authReq.authUser.id);
    const refreshed = {
      ...updated,
      sessionVersion: rotated.sessionVersion,
      tokenIssuedAt: rotated.tokenIssuedAt,
    };
    res.setHeader("Set-Cookie", [makeSessionCookieHeader(makeSessionTokenForUser(refreshed))]);

    emitStructuredAuthEvent("auth-change-password-success", {
      userId: authReq.authUser.id,
    });

    res.json({ ok: true });
  };
};
