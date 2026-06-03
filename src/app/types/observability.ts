export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  source: string;
  message: string;
  correlationId?: string;
  meta?: Record<string, unknown>;
}

export interface LogsResponse {
  entries: LogEntry[];
}

export interface RouteStats {
  route: string;
  count: number;
  errors: number;
  totalDurationMs: number;
  lastDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  avgDurationMs: number;
  byStatus: Record<string, number>;
}

export interface MetricsSnapshot {
  timestamp: string;
  uptimeSec: number;
  routes: RouteStats[];
  counters: Record<string, number>;
  process: {
    memMb: number;
    rssMb: number;
    nodeVersion: string;
  };
}

export interface RegistryConfig {
  nodeEnv: string;
  port: number;
  healthCheckIntervalMs: number;
  logBufferCapacity: number;
  allowedOrigins: string[];
  systemServices: string[];
  nexusTokenConfigured: boolean;
  wsClients: number;
  nodeVersion: string;
  uptimeSec: number;
}
