#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const required = [
  'concurrently',
  'tsx',
  'express',
  'cookie-parser',
  'morgan',
  'bcryptjs',
  'better-sqlite3',
  'ws',
  '@angular/cli',
];

const missing = required.filter((pkg) => !existsSync(resolve(root, 'node_modules', pkg)));

if (missing.length > 0) {
  console.error('');
  console.error('[dev] Dependencies are missing. Run `npm install` first.');
  console.error('[dev] Missing: ' + missing.join(', '));
  console.error('');
  process.exit(1);
}
