#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

if (!existsSync(resolve(root, 'node_modules'))) {
  console.error('\n[dev] node_modules is missing. Run `npm install` first.\n');
  process.exit(1);
}

const dataDir = resolve(root, '.data');
mkdirSync(dataDir, { recursive: true });

const env = {
  ...process.env,
  PORT: process.env.PORT ?? '8080',
  HOST: process.env.HOST ?? '127.0.0.1',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev-only-not-for-production-change-me',
  NEXUS_TOKEN: process.env.NEXUS_TOKEN ?? 'dev-token',
  NEXUS_INITIAL_PASSWORD: process.env.NEXUS_INITIAL_PASSWORD ?? 'devpass1',
  DATABASE_PATH: process.env.DATABASE_PATH ?? resolve(dataDir, 'portal.db'),
  REGISTRY_URL: process.env.REGISTRY_URL ?? 'http://127.0.0.1:8670',
  GATEWAY_URL: process.env.GATEWAY_URL ?? 'http://127.0.0.1:8668',
  STATIC_DIR: process.env.STATIC_DIR ?? resolve(root, 'dist', 'manager', 'browser'),
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};

const banner = [
  '',
  '  nexus-portal dev',
  '  ----------------',
  `  Angular  http://localhost:8669    (HMR — open this in the browser)`,
  `  BFF      http://localhost:${env.PORT}    (proxied via /api on 8669)`,
  `  SQLite   ${env.DATABASE_PATH}`,
  '',
  '  First login:',
  `    username  admin`,
  `    password  ${env.NEXUS_INITIAL_PASSWORD}  (forced change at first login)`,
  '',
  '  Reset state:',
  `    delete ${dataDir}  and restart`,
  '',
].join('\n');

process.stdout.write(banner);

const child = spawn('npx', ['tsx', 'watch', 'server/index.ts'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
