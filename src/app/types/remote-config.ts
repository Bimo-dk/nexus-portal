// MIGRATION: re-eksport fra @bimo-dk/nexus-core. Ny kode bør importere direkte fra '@bimo-dk/nexus-core'.
export type {
  RemoteHealthStatus,
  RemoteConfig,
  RegistryResponse,
  HealthStatus,
  WebSocketMessage,
  AddRemoteRequest,
  UpdateRemoteRequest,
} from '@bimo-dk/nexus-core';
