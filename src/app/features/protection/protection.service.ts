import { Injectable, OnDestroy, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  map,
  of,
  takeUntil,
  throwError,
} from 'rxjs';
import { SettingsService } from '../services/settings.service';
import { RegistryWsService } from '../services/registry-ws.service';
import type {
  BanEntry,
  GatewayMetrics,
  IpEntry,
  ProtectionConfig,
  ProtectionStatus,
} from '../../types/protection';
import type { LogMessage } from '../services/registry-ws.service';

const PROTECTION_KEYWORDS = ['banned', 'rate_limited', 'connection_limit'];

@Injectable({ providedIn: 'root' })
export class ProtectionService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly ws = inject(RegistryWsService);
  private readonly settings = inject(SettingsService);
  private readonly destroy$ = new Subject<void>();

  private get configUrl() { return `${this.settings.registryUrl()}/config/gateway/protection`; }
  private get statusUrl() { return `${this.settings.registryUrl()}/protection/status`; }
  private get banUrl() { return `${this.settings.registryUrl()}/protection/ban`; }
  private get gatewayMetricsUrl() { return `${this.settings.registryUrl()}/gateway/metrics`; }

  readonly protectionConfig$ = new BehaviorSubject<ProtectionConfig | null>(null);
  readonly activeBans$ = new BehaviorSubject<BanEntry[]>([]);
  readonly topOffenders$ = new BehaviorSubject<IpEntry[]>([]);
  readonly protectionEvent$ = new Subject<{ type: string; message: string }>();

  readonly bannedCount$ = this.activeBans$.pipe(map((b) => b.length));

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.listenForProtectionEvents();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.pollTimer !== null) clearInterval(this.pollTimer);
  }

  loadConfig(): Observable<ProtectionConfig> {
    return this.http.get<ProtectionConfig>(this.configUrl).pipe(
      map((cfg) => { this.protectionConfig$.next(cfg); return cfg; }),
      catchError((err) => this.onError(err, 'Failed to load protection config')),
    );
  }

  updateConfig(dto: Partial<ProtectionConfig>): Observable<ProtectionConfig> {
    return this.http.put<ProtectionConfig>(this.configUrl, dto).pipe(
      map((cfg) => {
        this.protectionConfig$.next(cfg);
        this.snack.open('Protection config saved', 'OK', { duration: 3000, panelClass: ['success-snack'] });
        return cfg;
      }),
      catchError((err) => this.onError(err, 'Failed to save protection config')),
    );
  }

  loadStatus(): Observable<ProtectionStatus> {
    return this.http.get<ProtectionStatus>(this.statusUrl).pipe(
      map((status) => {
        this.activeBans$.next(status.bans ?? []);
        this.topOffenders$.next(status.top_ips ?? []);
        return status;
      }),
      catchError(() => of({ bans: [], top_ips: [] } as ProtectionStatus)),
    );
  }

  loadMetrics(): Observable<GatewayMetrics> {
    return this.http.get(this.gatewayMetricsUrl, { responseType: 'text' }).pipe(
      map((text) => this.parseGatewayMetrics(text)),
      catchError(() => of<GatewayMetrics>({
        requests_blocked: 0,
        active_http: 0,
        active_ws: 0,
        banned_ips: this.activeBans$.value.length,
        total_violations: 0,
      })),
    );
  }

  banIp(ip: string, durationSeconds?: number): Observable<void> {
    const body = durationSeconds ? { duration_seconds: durationSeconds } : {};
    return this.http.post<void>(`${this.banUrl}/${encodeURIComponent(ip)}`, body).pipe(
      map(() => {
        this.snack.open(`IP ${ip} banned`, 'OK', { duration: 3000, panelClass: ['success-snack'] });
        this.loadStatus().subscribe();
      }),
      catchError((err) => this.onError(err, `Failed to ban ${ip}`)),
    );
  }

  unbanIp(ip: string): Observable<void> {
    return this.http.delete<void>(`${this.banUrl}/${encodeURIComponent(ip)}`).pipe(
      map(() => {
        this.snack.open(`IP ${ip} unbanned`, 'OK', { duration: 3000, panelClass: ['success-snack'] });
        this.loadStatus().subscribe();
      }),
      catchError((err) => this.onError(err, `Failed to unban ${ip}`)),
    );
  }

  clearAllBans(): Observable<void> {
    return this.http.delete<void>(`${this.banUrl}`).pipe(
      map(() => {
        this.snack.open('All bans cleared', 'OK', { duration: 3000, panelClass: ['success-snack'] });
        this.activeBans$.next([]);
      }),
      catchError((err) => this.onError(err, 'Failed to clear bans')),
    );
  }

  private listenForProtectionEvents(): void {
    this.ws.messagesOfType<LogMessage>('log')
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        const text = msg.entry?.message ?? '';
        if (PROTECTION_KEYWORDS.some((kw) => text.includes(kw))) {
          this.protectionEvent$.next({ type: 'log', message: text });
          this.loadStatus().subscribe();
        }
      });
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      this.loadStatus().subscribe();
    }, 30_000);
  }

  private parseGatewayMetrics(text: string): GatewayMetrics {
    const result: GatewayMetrics = {
      requests_blocked: 0,
      active_http: 0,
      active_ws: 0,
      banned_ips: this.activeBans$.value.length,
      total_violations: 0,
    };

    for (const line of text.split('\n')) {
      if (line.startsWith('#') || !line.trim()) continue;
      const braceIdx = line.indexOf('{');
      let name: string, labelsStr = '', valueStr: string;
      if (braceIdx >= 0) {
        name = line.slice(0, braceIdx).trim();
        const endBrace = line.indexOf('}');
        labelsStr = line.slice(braceIdx + 1, endBrace);
        valueStr = line.slice(endBrace + 2).trim();
      } else {
        const parts = line.trim().split(/\s+/);
        name = parts[0];
        valueStr = parts[1] ?? '0';
      }
      const value = parseFloat(valueStr);
      if (isNaN(value)) continue;

      if (name === 'nexus_gateway_requests_blocked_total') {
        result.requests_blocked = value;
      } else if (name === 'nexus_gateway_active_connections') {
        if (labelsStr.includes('"http"')) result.active_http = value;
        else if (labelsStr.includes('"websocket"')) result.active_ws = value;
      } else if (name === 'nexus_gateway_banned_ips_total') {
        result.banned_ips = value;
      } else if (name === 'nexus_gateway_violations_total') {
        result.total_violations = value;
      }
    }

    return result;
  }

  private onError(err: HttpErrorResponse, fallback: string): Observable<never> {
    const message = err.error?.message ?? err.message ?? fallback;
    this.snack.open(`${fallback}: ${message}`, 'Close', {
      duration: 6000,
      panelClass: ['error-snack'],
    });
    return throwError(() => err);
  }
}
