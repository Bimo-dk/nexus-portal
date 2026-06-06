export interface PortalConfig {
  port: number;
  host: string;
  databasePath: string;
  sessionSecret: string;
  initialPassword: string | null;
  registryUrl: string;
  gatewayUrl: string;
  nexusToken: string;
  staticDir: string;
  cookieSecure: boolean;
  sessionTtlSeconds: number;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env-var ${name}`);
  return v;
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) throw new Error(`Env-var ${name} must be an integer, got ${v}`);
  return n;
}

export function loadConfig(): PortalConfig {
  return {
    port: intEnv('PORT', 8080),
    host: process.env.HOST ?? '0.0.0.0',
    databasePath: process.env.DATABASE_PATH ?? '/data/portal.db',
    sessionSecret: required('SESSION_SECRET'),
    initialPassword: process.env.NEXUS_INITIAL_PASSWORD ?? null,
    registryUrl: process.env.REGISTRY_URL ?? 'http://registry:8670',
    gatewayUrl: process.env.GATEWAY_URL ?? 'http://gateway:80',
    nexusToken: required('NEXUS_TOKEN'),
    staticDir: process.env.STATIC_DIR ?? '/app/dist/manager/browser',
    cookieSecure: process.env.NODE_ENV === 'production',
    sessionTtlSeconds: intEnv('SESSION_TTL_SECONDS', 60 * 60 * 12),
  };
}
