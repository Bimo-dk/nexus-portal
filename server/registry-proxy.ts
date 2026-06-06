import type { IncomingMessage, Server } from 'node:http';
import type { Socket } from 'node:net';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { WebSocket, WebSocketServer } from 'ws';
import type Database from 'better-sqlite3';
import type { Role } from './db.js';
import { findSession, findUserById } from './db.js';
import { SESSION_COOKIE } from './middleware.js';

export interface ProxyOptions {
  registryUrl: string;
  nexusToken: string;
}

interface RouteRule {
  pattern: RegExp;
  methods: ReadonlyArray<string>;
}

const DEVELOPER_ALLOW: ReadonlyArray<RouteRule> = [
  { pattern: /^\/api\/remotes(\/[^/]+)?$/, methods: ['GET'] },
  { pattern: /^\/api\/system\/health$/, methods: ['GET'] },
  { pattern: /^\/api\/catalog$/, methods: ['GET'] },
];

const RESERVED_PREFIXES = ['/api/auth', '/api/users', '/api/ws'];

function isReserved(path: string): boolean {
  return RESERVED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

function isAllowed(role: Role, method: string, path: string): boolean {
  if (role === 'admin') return true;
  return DEVELOPER_ALLOW.some(
    (rule) => rule.methods.includes(method) && rule.pattern.test(path),
  );
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

export function createRegistryProxy(opts: ProxyOptions) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const fullPath = req.originalUrl.split('?')[0];
    if (isReserved(fullPath)) return next();

    if (!req.sessionUser) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    if (!isAllowed(req.sessionUser.role, req.method, fullPath)) {
      res.status(403).json({ error: 'insufficient permissions' });
      return;
    }

    const upstreamUrl = `${opts.registryUrl}${req.originalUrl}`;
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      const lower = name.toLowerCase();
      if (HOP_BY_HOP.has(lower)) continue;
      if (lower === 'cookie') continue;
      if (lower === 'x-nexus-token') continue;
      headers.set(name, Array.isArray(value) ? value.join(',') : value);
    }
    headers.set('x-nexus-token', opts.nexusToken);
    headers.set('x-forwarded-for', req.ip ?? '');
    headers.set('x-forwarded-proto', req.protocol);

    const body =
      req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : JSON.stringify(req.body ?? null);
    if (body !== undefined) headers.set('content-type', 'application/json');

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(upstreamUrl, { method: req.method, headers, body });
    } catch (err) {
      console.error('[proxy] registry upstream failure', upstreamUrl, err);
      res.status(502).json({ error: 'upstream unavailable' });
      return;
    }

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  };
}

function extractCookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const segment of header.split(';')) {
    const idx = segment.indexOf('=');
    if (idx < 0) continue;
    const k = segment.slice(0, idx).trim();
    if (k !== name) continue;
    return decodeURIComponent(segment.slice(idx + 1).trim());
  }
  return null;
}

function parseSignedCookie(rawCookie: string | undefined, secret: string, name: string): string | null {
  const raw = extractCookieValue(rawCookie, name);
  if (!raw) return null;
  const unsigned = cookieParser.signedCookie(raw, secret);
  return typeof unsigned === 'string' ? unsigned : null;
}

export function attachWebSocketProxy(
  server: Server,
  db: Database.Database,
  sessionSecret: string,
  opts: ProxyOptions,
): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    if (!req.url || !req.url.startsWith('/api/ws')) {
      socket.destroy();
      return;
    }

    const sessionId = parseSignedCookie(req.headers.cookie, sessionSecret, SESSION_COOKIE);
    if (!sessionId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const session = findSession(db, sessionId);
    if (!session) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const user = findUserById(db, session.user_id);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (downstream) => {
      const wsBase = opts.registryUrl.replace(/^https?:/, (p) => (p === 'https:' ? 'wss:' : 'ws:'));
      const upstream = new WebSocket(`${wsBase}/api/ws`, {
        headers: { 'x-nexus-token': opts.nexusToken },
      });

      const closeBoth = (code: number, reason: string) => {
        try { downstream.close(code, reason); } catch { /* ignore */ }
        try { upstream.close(code, reason); } catch { /* ignore */ }
      };

      upstream.on('open', () => {
        downstream.on('message', (data) => {
          if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
        });
        upstream.on('message', (data) => {
          if (downstream.readyState === WebSocket.OPEN) downstream.send(data);
        });
      });

      upstream.on('close', (code, reason) => closeBoth(code || 1011, reason.toString()));
      upstream.on('error', () => closeBoth(1011, 'upstream error'));

      downstream.on('close', () => upstream.close());
      downstream.on('error', () => upstream.close());
    });
  });
}
