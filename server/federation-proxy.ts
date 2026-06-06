import type { NextFunction, Request, Response } from 'express';

export interface FederationProxyOptions {
  gatewayUrl: string;
}

const FEDERATION_PATH = /^\/remotes\/[^/]+\/(catalog\.json|remoteEntry\.json)$/;

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  // Node's fetch decompresses gzipped responses transparently but leaves
  // the upstream Content-Encoding header on the response object. If we
  // forward it untouched, the browser tries to gunzip the already-decoded
  // body and fails with ERR_CONTENT_DECODING_FAILED. Strip it. Same goes
  // for content-length, which is wrong post-decompression.
  'content-encoding',
]);

export function createFederationProxy(opts: FederationProxyOptions) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const path = req.originalUrl.split('?')[0];
    if (!FEDERATION_PATH.test(path)) return next();

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(`${opts.gatewayUrl}${path}`);
    } catch (err) {
      console.error('[proxy] federation upstream failure', path, err);
      res.status(502).json({ error: 'upstream unavailable' });
      return;
    }

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });
    res.setHeader('cache-control', 'no-store, no-cache, must-revalidate');
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  };
}
