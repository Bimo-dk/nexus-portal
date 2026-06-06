import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

export type Role = 'admin' | 'developer';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  must_change_password: 0 | 1;
  created_at: string;
  last_login_at: string | null;
}

export interface SessionRow {
  id: string;
  user_id: number;
  expires_at: number;
  created_at: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);
`;

const SEED_ROLES = ['admin', 'developer'];

export function openDb(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });

  let db: Database.Database;
  try {
    db = new Database(path);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to open SQLite database at ${path}: ${message}`);
  }

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  const insertRole = db.prepare('INSERT OR IGNORE INTO roles (name) VALUES (?)');
  for (const role of SEED_ROLES) insertRole.run(role);

  return db;
}

const BCRYPT_COST = 10;

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function userCount(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
}

export function roleId(db: Database.Database, name: Role): number {
  const row = db.prepare('SELECT id FROM roles WHERE name = ?').get(name) as { id: number } | undefined;
  if (!row) throw new Error(`Role ${name} not found — schema not seeded`);
  return row.id;
}

export interface UserWithRole {
  id: number;
  username: string;
  role: Role;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

const SELECT_USER_BASE = `
SELECT u.id, u.username, u.password_hash, r.name AS role,
       u.must_change_password, u.created_at, u.last_login_at
FROM users u JOIN roles r ON r.id = u.role_id
`;

export function findUserByUsername(db: Database.Database, username: string): UserRow | null {
  const row = db.prepare(`${SELECT_USER_BASE} WHERE u.username = ?`).get(username) as UserRow | undefined;
  return row ?? null;
}

export function findUserById(db: Database.Database, id: number): UserRow | null {
  const row = db.prepare(`${SELECT_USER_BASE} WHERE u.id = ?`).get(id) as UserRow | undefined;
  return row ?? null;
}

export function listUsers(db: Database.Database): UserWithRole[] {
  const rows = db.prepare(`${SELECT_USER_BASE} ORDER BY u.username`).all() as UserRow[];
  return rows.map(rowToPublic);
}

export function rowToPublic(row: UserRow): UserWithRole {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    must_change_password: row.must_change_password === 1,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
  };
}

export function createUser(
  db: Database.Database,
  username: string,
  password: string,
  role: Role,
  mustChangePassword: boolean,
): UserWithRole {
  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, role_id, must_change_password)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(username, hashPassword(password), roleId(db, role), mustChangePassword ? 1 : 0);
  const created = findUserById(db, Number(result.lastInsertRowid));
  if (!created) throw new Error('User vanished immediately after insert');
  return rowToPublic(created);
}

export function updateUser(
  db: Database.Database,
  id: number,
  patch: { role?: Role; password?: string },
): void {
  if (patch.role) {
    db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(roleId(db, patch.role), id);
  }
  if (patch.password) {
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
      .run(hashPassword(patch.password), id);
  }
}

export function deleteUser(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function markPasswordChanged(db: Database.Database, id: number, newPassword: string): void {
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .run(hashPassword(newPassword), id);
}

export function touchLogin(db: Database.Database, id: number): void {
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
}

export function createSession(db: Database.Database, userId: number, ttlSeconds: number): string {
  const id = randomToken();
  const now = Date.now();
  const expires = now + ttlSeconds * 1000;
  db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(id, userId, expires, now);
  return id;
}

export function findSession(db: Database.Database, id: string): SessionRow | null {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    deleteSession(db, id);
    return null;
  }
  return row;
}

export function deleteSession(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function deleteSessionsForUser(db: Database.Database, userId: number): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function purgeExpiredSessions(db: Database.Database): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
