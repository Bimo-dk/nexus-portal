#!/usr/bin/env node
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const dataDir = resolve(process.cwd(), '.data');
rmSync(dataDir, { recursive: true, force: true });
console.log(`[dev] Removed ${dataDir}. Next \`npm run dev\` will re-seed the admin user.`);
