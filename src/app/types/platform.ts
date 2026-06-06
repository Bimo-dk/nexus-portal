import type { RemoteConfig } from '@bimo-dk/nexus-core';

export type Framework = 'angular' | 'vue' | 'react';
export type RemoteVisibility = 'global' | `host:${string}`;

export interface Host {
  id: string;
  name: string;
  url: string;
  framework: Framework;
  remoteEntry: string;
  exposedModule: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  gateCount: number | null;
}

export interface Gate {
  id: string;
  name: string;
  domain: string;
  hostId: string;
  host: Host;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HostRemote extends RemoteConfig {
  source: 'global' | 'host-specific';
}

export interface CreateHostDto {
  name: string;
  url: string;
  framework: string;
  remoteEntry: string;
  exposedModule: string;
  enabled?: boolean;
}

export type UpdateHostDto = Partial<CreateHostDto>;

export interface CreateGateDto {
  name: string;
  domain: string;
  hostId: string;
  enabled?: boolean;
}

export type UpdateGateDto = Partial<CreateGateDto>;

export interface PortalRemoteConfig extends RemoteConfig {
  visibility?: RemoteVisibility;
}

export interface HostChangedMessage {
  type: 'host_changed';
  host: Host;
  trigger: string;
  timestamp: string;
}

export interface GateChangedMessage {
  type: 'gate_changed';
  gate: Gate;
  trigger: string;
  old_host_id?: string;
  new_host_id?: string;
  timestamp: string;
}

export interface GateChangedEvent {
  gate: Gate;
  trigger: string;
  oldHostId?: string;
  newHostId?: string;
}

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
}

export interface RemoteVersion {
  id: string;
  remoteName: string;
  version: number;
  url: string;
  exposedModule: string;
  routePath: string;
  enabled: boolean;
  upstreamUrl?: string;
  visibility: string;
  recordedAt: string;
}

export interface RemoteVersionsResponse {
  remote: string;
  versions: RemoteVersion[];
  total: number;
}
