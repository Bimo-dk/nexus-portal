import type { NextFunction, Request, Response } from 'express';
import type { Knex } from 'knex';
import type { Role, UserRow } from './db.js';
import { findSession, findUserById } from './db.js';

export interface SessionUser {
  id: number;
  username: string;
  role: Role;
  mustChangePassword: boolean;
  sessionId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    sessionUser?: SessionUser;
  }
}

export const SESSION_COOKIE = 'nexus_session';

export function loadSessionUser(db: Knex) {
  return async function (req: Request, _res: Response, next: NextFunction): Promise<void> {
    const cookie = req.signedCookies?.[SESSION_COOKIE];
    if (!cookie) return next();

    const session = await findSession(db, cookie);
    if (!session) return next();

    const user = await findUserById(db, session.user_id);
    if (!user) return next();

    req.sessionUser = userToSession(user, session.id);
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.sessionUser) {
    res.status(401).json({ error: 'authentication required' });
    return;
  }
  next();
}

export function requireRole(role: Role) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.sessionUser) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    if (req.sessionUser.role !== role) {
      res.status(403).json({ error: 'insufficient permissions' });
      return;
    }
    next();
  };
}

const ALLOWED_DURING_PW_CHANGE = new Set([
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/change-password',
]);

export function blockWhilePasswordChangeRequired(req: Request, res: Response, next: NextFunction): void {
  if (!req.sessionUser) return next();
  if (!req.sessionUser.mustChangePassword) return next();

  const path = req.path;
  if (ALLOWED_DURING_PW_CHANGE.has(path)) return next();
  if (!path.startsWith('/api/')) return next();

  res.status(403).json({ error: 'password change required', code: 'must_change_password' });
}

export function userToSession(user: UserRow, sessionId: string): SessionUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: user.must_change_password,
    sessionId,
  };
}
