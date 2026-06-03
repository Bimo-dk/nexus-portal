import type { RemoteHealthStatus } from '@bimo-dk/nexus-core';

export type ServiceKind = 'registry' | 'system' | 'remote';

export interface ServiceHealth {
  name: string;
  kind: ServiceKind;
  enabled: boolean;
  status: RemoteHealthStatus;
  latencyMs?: number;
  lastChecked: string;
  url?: string;
  error?: string;
}

export interface SystemHealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
}

export interface SystemHealthSnapshot {
  timestamp: string;
  services: ServiceHealth[];
  summary: SystemHealthSummary;
}
