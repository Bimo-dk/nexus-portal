import { Router, type Request, type Response } from 'express';
import type Database from 'better-sqlite3';
import {
  MIN_PASSWORD_LENGTH,
  createUser,
  deleteSessionsForUser,
  deleteUser,
  findUserById,
  findUserByUsername,
  listUsers,
  rowToPublic,
  updateUser,
  type Role,
} from './db.js';
import { requireRole } from './middleware.js';

const VALID_ROLES: ReadonlyArray<Role> = ['admin', 'developer'];

export function createUsersRouter(db: Database.Database): Router {
  const router = Router();
  router.use(requireRole('admin'));

  router.get('/', (_req: Request, res: Response) => {
    res.json(listUsers(db));
  });

  router.post('/', (req: Request, res: Response) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = req.body?.role as Role | undefined;

    if (!username || !password || !role) {
      res.status(400).json({ error: 'username, password and role required' });
      return;
    }
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of ${VALID_ROLES.join(', ')}` });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }
    if (findUserByUsername(db, username)) {
      res.status(409).json({ error: 'username already exists' });
      return;
    }

    res.json(createUser(db, username, password, role, true));
  });

  router.patch('/:id', (req: Request, res: Response) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const user = findUserById(db, id);
    if (!user) {
      res.status(404).json({ error: 'user not found' });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : undefined;
    const role = req.body?.role as Role | undefined;
    if (password !== undefined && password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }
    if (role !== undefined && !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of ${VALID_ROLES.join(', ')}` });
      return;
    }

    updateUser(db, id, { password, role });
    const updated = findUserById(db, id);
    if (!updated) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    res.json(rowToPublic(updated));
  });

  router.delete('/:id', (req: Request, res: Response) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    if (req.sessionUser?.id === id) {
      res.status(400).json({ error: 'cannot delete your own account' });
      return;
    }
    const user = findUserById(db, id);
    if (!user) {
      res.status(404).json({ error: 'user not found' });
      return;
    }

    deleteSessionsForUser(db, id);
    deleteUser(db, id);
    res.json({ status: 'ok' });
  });

  return router;
}
