export interface ProtectionConfig {
  rate_limit_enabled: boolean;
  rate_limit_requests_per_second: number;
  rate_limit_burst: number;
  max_connections_per_ip: number;
  max_websocket_connections_per_ip: number;
  request_timeout_ms: number;
  header_read_timeout_ms: number;
  body_read_timeout_ms: number;
  idle_timeout_ms: number;
  max_body_bytes: number;
  max_header_bytes: number;
  slowloris_timeout_ms: number;
  ban_duration_seconds: number;
  ban_threshold_violations: number;
}

export interface BanEntry {
  ip: string;
  reason: string;
  banned_until: string;
  violations: number;
}

export interface IpEntry {
  ip: string;
  http_connections: number;
  websocket_connections: number;
  violations: number;
  banned: boolean;
}

export interface ProtectionStatus {
  bans: BanEntry[];
  top_ips: IpEntry[];
}

export interface GatewayMetrics {
  requests_blocked: number;
  active_http: number;
  active_ws: number;
  banned_ips: number;
  total_violations: number;
}
