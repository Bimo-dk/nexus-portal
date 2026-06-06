import { Router, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import {
  MIN_PASSWORD_LENGTH,
  createSession,
  deleteSession,
  findUserByUsername,
  markPasswordChanged,
  touchLogin,
  verifyPassword,
} from './db.js';
import { SESSION_COOKIE } from './middleware.js';

export interface AuthOptions {
  sessionTtlSeconds: number;
  cookieSecure: boolean;
}

export function createAuthRouter(db: Knex, opts: AuthOptions): Router {
  const router = Router();

  router.post('/login', async (req: Request, res: Response) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || !password) {
      res.status(400).json({ error: 'username and password required' });
      return;
    }

    const user = await findUserByUsername(db, username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'invalid credentials' });
      return;
    }

    const sessionId = await createSession(db, user.id, opts.sessionTtlSeconds);
    await touchLogin(db, user.id);

    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.cookieSecure,
      signed: true,
      path: '/',
      maxAge: opts.sessionTtlSeconds * 1000,
    });

    res.json({
      username: user.username,
      role: user.role,
      must_change_password: user.must_change_password,
    });
  });

  router.post('/logout', async (req: Request, res: Response) => {
    const cookie = req.signedCookies?.[SESSION_COOKIE];
    if (cookie) await deleteSession(db, cookie);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ status: 'ok' });
  });

  router.get('/me', (req: Request, res: Response) => {
    if (!req.sessionUser) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    res.json({
      username: req.sessionUser.username,
      role: req.sessionUser.role,
      must_change_password: req.sessionUser.mustChangePassword,
    });
  });

  router.post('/change-password', async (req: Request, res: Response) => {
    if (!req.sessionUser) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const current = typeof req.body?.current_password === 'string' ? req.body.current_password : '';
    const next = typeof req.body?.new_password === 'string' ? req.body.new_password : '';
    if (!current || !next) {
      res.status(400).json({ error: 'current_password and new_password required' });
      return;
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `new password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    const user = await findUserByUsername(db, req.sessionUser.username);
    if (!user || !verifyPassword(current, user.password_hash)) {
      res.status(401).json({ error: 'current password incorrect' });
      return;
    }

    await markPasswordChanged(db, user.id, next);
    res.json({ status: 'ok' });
  });

  return router;
}
