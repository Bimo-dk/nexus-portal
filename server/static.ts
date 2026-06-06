import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type NextFunction, type Request, type Response, type Application } from 'express';

export interface StaticOptions {
  staticDir: string;
}

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'x-frame-options': 'SAMEORIGIN',
  'x-content-type-options': 'nosniff',
  'x-xss-protection': '1; mode=block',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

const IMMUTABLE_RE = /\.(?:css|js|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/i;
const NO_STORE_RE = /(?:remoteEntry\.(?:json|js)|(?:chunk|remote)-[^/]+\.js)$/i;

export function attachSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(k, v);
  }
  next();
}

export function registerStatic(app: Application, opts: StaticOptions): void {
  if (!existsSync(opts.staticDir)) {
    console.warn(
      `[static] Dir does not exist (${opts.staticDir}). Serving /api/* only — Angular dev server handles the SPA in dev.`,
    );
    return;
  }

  app.use(
    express.static(opts.staticDir, {
      index: false,
      etag: true,
      setHeaders: (res, filePath) => {
        if (NO_STORE_RE.test(filePath)) {
          res.setHeader('cache-control', 'no-store, no-cache, must-revalidate');
          res.setHeader('pragma', 'no-cache');
        } else if (IMMUTABLE_RE.test(filePath)) {
          res.setHeader('cache-control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith('/api/')) return next();
    res.setHeader('cache-control', 'no-store');
    res.sendFile(resolve(opts.staticDir, 'index.html'));
  });
}
