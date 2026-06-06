import { createServer } from 'node:http';
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { loadConfig } from './config.js';
import { createUser, migrate, openDb, userCount } from './db.js';
import { createAuthRouter } from './auth.js';
import { createUsersRouter } from './users.js';
import { attachWebSocketProxy, createRegistryProxy } from './registry-proxy.js';
import { createFederationProxy } from './federation-proxy.js';
import { attachSecurityHeaders, registerStatic } from './static.js';
import { blockWhilePasswordChangeRequired, loadSessionUser } from './middleware.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDb(config.databaseUrl);
  await migrate(db);

  if (await userCount(db) === 0) {
    if (!config.initialPassword) {
      const msg =
        'nexus-portal cannot start: the user database is empty and NEXUS_INITIAL_PASSWORD ' +
        'is not set. Set NEXUS_INITIAL_PASSWORD to seed the initial admin account, then restart. ' +
        'Once that admin has logged in and changed the password, you can unset the env-var.';
      process.stderr.write(`\n[nexus-portal] ${msg}\n\n`);
      process.exit(1);
    }
    await createUser(db, 'admin', config.initialPassword, 'admin', true);
    console.log('[nexus-portal] seeded initial admin user — password change required on first login.');
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(morgan('tiny', {
    skip: (req) => req.url === '/health',
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser(config.sessionSecret));
  app.use(attachSecurityHeaders);
  app.use(loadSessionUser(db));
  app.use(blockWhilePasswordChangeRequired);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'nexus-portal' });
  });

  app.use('/api/auth', createAuthRouter(db, {
    sessionTtlSeconds: config.sessionTtlSeconds,
    cookieSecure: config.cookieSecure,
  }));
  app.use('/api/users', createUsersRouter(db));
  app.use(createFederationProxy({ gatewayUrl: config.gatewayUrl }));
  app.use('/api', createRegistryProxy({
    registryUrl: config.registryUrl,
    nexusToken: config.nexusToken,
  }));

  registerStatic(app, { staticDir: config.staticDir });

  const server = createServer(app);
  attachWebSocketProxy(server, db, config.sessionSecret, {
    registryUrl: config.registryUrl,
    nexusToken: config.nexusToken,
  });

  const shutdown = (signal: string) => {
    console.log(`[nexus-portal] received ${signal}, shutting down`);
    server.close(async () => {
      await db.destroy();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  server.listen(config.port, config.host, () => {
    console.log(`[nexus-portal] listening on http://${config.host}:${config.port}`);
  });

  server.on('error', (err) => {
    console.error('[nexus-portal] server error', err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('[nexus-portal] startup failure', err);
  process.exit(1);
});
