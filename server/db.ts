import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import knex, { type Knex } from 'knex';
import bcrypt from 'bcryptjs';

export type Role = 'admin' | 'developer';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface SessionRow {
  id: string;
  user_id: number;
  expires_at: number;
  created_at: number;
}

export interface UserWithRole {
  id: number;
  username: string;
  role: Role;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

function parseDriver(url: string): 'better-sqlite3' | 'pg' | 'mysql2' {
  if (url.startsWith('sqlite:')) return 'better-sqlite3';
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'pg';
  if (url.startsWith('mysql://') || url.startsWith('mariadb://')) return 'mysql2';
  throw new Error(`Unsupported DATABASE_URL scheme. Use sqlite:, postgresql:, mysql:, or mariadb:`);
}

export function openDb(databaseUrl: string): Knex {
  const driver = parseDriver(databaseUrl);

  if (driver === 'better-sqlite3') {
    const filename = databaseUrl.slice('sqlite:'.length);
    mkdirSync(dirname(filename === ':memory:' ? '/tmp/x' : filename), { recursive: true });
    return knex({
      client: 'better-sqlite3',
      connection: { filename },
      useNullAsDefault: true,
    });
  }

  const connectionString = databaseUrl.startsWith('mariadb://')
    ? databaseUrl.replace('mariadb://', 'mysql://')
    : databaseUrl;

  return knex({
    client: driver,
    connection: connectionString,
    pool: { min: 2, max: 10 },
  });
}

export async function migrate(db: Knex): Promise<void> {
  const isSqlite = (db.client as { config: { client: string } }).config.client === 'better-sqlite3';

  if (isSqlite) {
    await db.raw('PRAGMA journal_mode = WAL');
    await db.raw('PRAGMA foreign_keys = ON');
  }

  if (!(await db.schema.hasTable('roles'))) {
    await db.schema.createTable('roles', (t: Knex.CreateTableBuilder) => {
      t.increments('id').primary();
      t.string('name', 64).unique().notNullable();
    });
  }

  if (!(await db.schema.hasTable('users'))) {
    await db.schema.createTable('users', (t: Knex.CreateTableBuilder) => {
      t.increments('id').primary();
      t.string('username', 255).unique().notNullable();
      t.string('password_hash', 255).notNullable();
      t.integer('role_id').unsigned().notNullable().references('id').inTable('roles');
      t.boolean('must_change_password').notNullable().defaultTo(false);
      t.timestamp('created_at', { useTz: false }).notNullable().defaultTo(db.fn.now());
      t.timestamp('last_login_at', { useTz: false }).nullable();
    });
  }

  if (!(await db.schema.hasTable('sessions'))) {
    await db.schema.createTable('sessions', (t: Knex.CreateTableBuilder) => {
      t.string('id', 64).primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.bigInteger('expires_at').notNullable();
      t.bigInteger('created_at').notNullable();
      t.index(['user_id']);
      t.index(['expires_at']);
    });
  }

  for (const name of ['admin', 'developer'] as const) {
    const exists = await db('roles').where({ name }).first();
    if (!exists) await db('roles').insert({ name });
  }
}

const BCRYPT_COST = 10;
export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

const USER_SELECT = [
  'u.id',
  'u.username',
  'u.password_hash',
  'r.name as role',
  'u.must_change_password',
  'u.created_at',
  'u.last_login_at',
] as const;

function normalizeUser(row: Record<string, unknown>): UserRow {
  return {
    id: Number(row.id),
    username: String(row.username),
    password_hash: String(row.password_hash),
    role: row.role as Role,
    must_change_password: Boolean(row.must_change_password),
    created_at: String(row.created_at),
    last_login_at: row.last_login_at != null ? String(row.last_login_at) : null,
  };
}

export function rowToPublic(row: UserRow): UserWithRole {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    must_change_password: row.must_change_password,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
  };
}

export async function userCount(db: Knex): Promise<number> {
  const [{ n }] = await db('users').count('id as n');
  return Number(n);
}

async function roleId(db: Knex, name: Role): Promise<number> {
  const row = await db('roles').where({ name }).first<{ id: number }>();
  if (!row) throw new Error(`Role ${name} not found — schema not seeded`);
  return row.id;
}

export async function findUserByUsername(db: Knex, username: string): Promise<UserRow | null> {
  const row = await db('users as u')
    .join('roles as r', 'r.id', 'u.role_id')
    .select(USER_SELECT)
    .whereRaw('LOWER(u.username) = LOWER(?)', [username])
    .first<Record<string, unknown>>();
  return row ? normalizeUser(row) : null;
}

export async function findUserById(db: Knex, id: number): Promise<UserRow | null> {
  const row = await db('users as u')
    .join('roles as r', 'r.id', 'u.role_id')
    .select(USER_SELECT)
    .where('u.id', id)
    .first<Record<string, unknown>>();
  return row ? normalizeUser(row) : null;
}

export async function listUsers(db: Knex): Promise<UserWithRole[]> {
  const rows = await db('users as u')
    .join('roles as r', 'r.id', 'u.role_id')
    .select(USER_SELECT)
    .orderBy('u.username') as Record<string, unknown>[];
  return rows.map((r) => rowToPublic(normalizeUser(r)));
}

export async function createUser(
  db: Knex,
  username: string,
  password: string,
  role: Role,
  mustChangePassword: boolean,
): Promise<UserWithRole> {
  const rid = await roleId(db, role);
  const [id] = await db('users').insert({
    username,
    password_hash: hashPassword(password),
    role_id: rid,
    must_change_password: mustChangePassword,
  });
  const created = await findUserById(db, Number(id));
  if (!created) throw new Error('User vanished immediately after insert');
  return rowToPublic(created);
}

export async function updateUser(
  db: Knex,
  id: number,
  patch: { role?: Role; password?: string },
): Promise<void> {
  if (patch.role) {
    await db('users').where({ id }).update({ role_id: await roleId(db, patch.role) });
  }
  if (patch.password) {
    await db('users').where({ id }).update({
      password_hash: hashPassword(patch.password),
      must_change_password: false,
    });
  }
}

export async function deleteUser(db: Knex, id: number): Promise<void> {
  await db('users').where({ id }).delete();
}

export async function markPasswordChanged(db: Knex, id: number, newPassword: string): Promise<void> {
  await db('users').where({ id }).update({
    password_hash: hashPassword(newPassword),
    must_change_password: false,
  });
}

export async function touchLogin(db: Knex, id: number): Promise<void> {
  await db('users').where({ id }).update({ last_login_at: db.fn.now() });
}

export async function createSession(db: Knex, userId: number, ttlSeconds: number): Promise<string> {
  const id = randomToken();
  const now = Date.now();
  await db('sessions').insert({ id, user_id: userId, expires_at: now + ttlSeconds * 1000, created_at: now });
  return id;
}

export async function findSession(db: Knex, id: string): Promise<SessionRow | null> {
  const row = await db('sessions').where({ id }).first<SessionRow>();
  if (!row) return null;
  if (Number(row.expires_at) <= Date.now()) {
    await deleteSession(db, id);
    return null;
  }
  return { ...row, expires_at: Number(row.expires_at), created_at: Number(row.created_at) };
}

export async function deleteSession(db: Knex, id: string): Promise<void> {
  await db('sessions').where({ id }).delete();
}

export async function deleteSessionsForUser(db: Knex, userId: number): Promise<void> {
  await db('sessions').where({ user_id: userId }).delete();
}

export async function purgeExpiredSessions(db: Knex): Promise<void> {
  await db('sessions').where('expires_at', '<=', Date.now()).delete();
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
