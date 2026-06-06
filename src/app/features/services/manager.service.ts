import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, catchError, from, map, throwError } from 'rxjs';
import { SettingsService } from './settings.service';
import type {
  AddRemoteRequest,
  HealthStatus,
  RegistryResponse,
  RemoteConfig,
  RemoteHealthStatus,
  UpdateRemoteRequest,
} from '@bimo-dk/nexus-core';
import type { SystemHealthSnapshot } from '../../types/system-health';
import type {
  AuditLogResponse,
  Host,
  Gate,
  HostRemote,
  CreateHostDto,
  UpdateHostDto,
  CreateGateDto,
  UpdateGateDto,
  PortalRemoteConfig,
  RemoteVersionsResponse,
} from '../../types/platform';

@Injectable({ providedIn: 'root' })
export class ManagerService {
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly settings = inject(SettingsService);

  private get baseUrl() { return `${this.settings.registryUrl()}/remotes`; }
  private get systemUrl() { return `${this.settings.registryUrl()}/system`; }
  private get hostsUrl() { return `${this.settings.registryUrl()}/hosts`; }
  private get gatesUrl() { return `${this.settings.registryUrl()}/gates`; }

  getSystemHealth(fresh = false): Observable<SystemHealthSnapshot> {
    const url = fresh ? `${this.systemUrl}/health?fresh=true` : `${this.systemUrl}/health`;
    return this.http.get<SystemHealthSnapshot>(url).pipe(
      catchError((err) => this.onError(err, 'Failed to fetch system health')),
    );
  }

  getRegistryConfig(): Observable<import('../../types/observability').RegistryConfig> {
    return this.http.get<import('../../types/observability').RegistryConfig>(`${this.systemUrl}/config`).pipe(
      catchError((err) => this.onError(err, 'Failed to fetch registry config')),
    );
  }

  getLogs(opts: { since?: string; limit?: number; level?: import('../../types/observability').LogLevel } = {}): Observable<import('../../types/observability').LogsResponse> {
    const params: string[] = [];
    if (opts.since) params.push(`since=${encodeURIComponent(opts.since)}`);
    if (opts.limit) params.push(`limit=${opts.limit}`);
    if (opts.level) params.push(`level=${opts.level}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return this.http.get<import('../../types/observability').LogsResponse>(`${this.systemUrl}/logs${qs}`).pipe(
      catchError((err) => this.onError(err, 'Failed to fetch logs')),
    );
  }

  getMetrics(): Observable<import('../../types/observability').MetricsSnapshot> {
    return this.http.get<import('../../types/observability').MetricsSnapshot>(`${this.systemUrl}/metrics`).pipe(
      catchError((err) => this.onError(err, 'Failed to fetch metrics')),
    );
  }

  getRemotes(hostId?: string): Observable<RegistryResponse & { remotes: PortalRemoteConfig[] }> {
    const url = hostId ? `${this.baseUrl}?host_id=${encodeURIComponent(hostId)}` : this.baseUrl;
    return this.http
      .get<RegistryResponse & { remotes: PortalRemoteConfig[] }>(url)
      .pipe(catchError((err) => this.onError(err, 'Failed to fetch remotes')));
  }

  getRemote(name: string): Observable<RemoteConfig> {
    return this.http.get<RemoteConfig>(`${this.baseUrl}/${encodeURIComponent(name)}`).pipe(
      catchError((err) => this.onError(err, `Failed to fetch remote "${name}"`)),
    );
  }

  addRemote(config: AddRemoteRequest & { visibility?: string }): Observable<PortalRemoteConfig> {
    return this.http.post<PortalRemoteConfig>(this.baseUrl, config).pipe(
      map((created) => {
        this.successSnack(`Remote "${created.name}" added`);
        return created;
      }),
      catchError((err) => this.onError(err, 'Failed to add remote')),
    );
  }

  updateRemote(name: string, patch: UpdateRemoteRequest & { visibility?: string }): Observable<PortalRemoteConfig> {
    return this.http.put<PortalRemoteConfig>(`${this.baseUrl}/${encodeURIComponent(name)}`, patch).pipe(
      map((updated) => {
        this.successSnack(`Remote "${updated.name}" updated`);
        return updated;
      }),
      catchError((err) => this.onError(err, `Failed to update remote "${name}"`)),
    );
  }

  deleteRemote(name: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(name)}`).pipe(
      map(() => {
        this.successSnack(`Remote "${name}" deleted`);
      }),
      catchError((err) => this.onError(err, `Failed to delete remote "${name}"`)),
    );
  }

  toggleRemote(name: string): Observable<RemoteConfig> {
    return this.http.post<RemoteConfig>(`${this.baseUrl}/${encodeURIComponent(name)}/toggle`, {}).pipe(
      map((updated) => {
        this.successSnack(`Remote "${updated.name}" is now ${updated.enabled ? 'enabled' : 'disabled'}`);
        return updated;
      }),
      catchError((err) => this.onError(err, `Failed to toggle state for "${name}"`)),
    );
  }

  redeployRemote(name: string): Observable<{ accepted: boolean; remote: string; timestamp: string }> {
    return this.http
      .post<{ accepted: boolean; remote: string; timestamp: string }>(`${this.baseUrl}/${encodeURIComponent(name)}/redeploy`, {})
      .pipe(
        map((res) => {
          this.successSnack(`Redeploy signal sent for "${name}"`);
          return res;
        }),
        catchError((err) => this.onError(err, `Failed to send redeploy for "${name}"`)),
      );
  }

  checkHealth(remoteUrl: string): Observable<{ status: RemoteHealthStatus; raw?: HealthStatus; responseTimeMs: number }> {
    return from(this.doHealthCheck(remoteUrl));
  }

  getHosts(): Observable<Host[]> {
    return this.http
      .get<{ hosts: Host[]; total: number }>(this.hostsUrl)
      .pipe(
        map((res) => res.hosts),
        catchError((err) => this.onError(err, 'Failed to fetch hosts')),
      );
  }

  getHost(id: string): Observable<Host> {
    return this.http
      .get<Host>(`${this.hostsUrl}/${encodeURIComponent(id)}`)
      .pipe(catchError((err) => this.onError(err, `Failed to fetch host "${id}"`)));
  }

  getHostRemotes(id: string): Observable<HostRemote[]> {
    return this.http
      .get<{ hostId: string; remotes: HostRemote[]; total: number }>(`${this.hostsUrl}/${encodeURIComponent(id)}/remotes`)
      .pipe(
        map((res) => res.remotes),
        catchError((err) => this.onError(err, `Failed to fetch remotes for host "${id}"`)),
      );
  }

  createHost(dto: CreateHostDto): Observable<Host> {
    return this.http.post<Host>(this.hostsUrl, dto).pipe(
      map((created) => {
        this.successSnack(`Host "${created.name}" created`);
        return created;
      }),
      catchError((err) => this.onError(err, 'Failed to create host')),
    );
  }

  updateHost(id: string, dto: UpdateHostDto): Observable<Host> {
    return this.http.put<Host>(`${this.hostsUrl}/${encodeURIComponent(id)}`, dto).pipe(
      map((updated) => {
        this.successSnack(`Host "${updated.name}" updated`);
        return updated;
      }),
      catchError((err) => this.onError(err, `Failed to update host "${id}"`)),
    );
  }

  deleteHost(id: string): Observable<void> {
    return this.http.delete<void>(`${this.hostsUrl}/${encodeURIComponent(id)}`).pipe(
      map(() => {
        this.successSnack('Host deleted');
      }),
      catchError((err) => this.onError(err, `Failed to delete host "${id}"`)),
    );
  }

  toggleHost(id: string): Observable<Host> {
    return this.http.post<Host>(`${this.hostsUrl}/${encodeURIComponent(id)}/toggle`, {}).pipe(
      map((updated) => {
        this.successSnack(`Host "${updated.name}" is now ${updated.enabled ? 'enabled' : 'disabled'}`);
        return updated;
      }),
      catchError((err) => this.onError(err, `Failed to toggle host "${id}"`)),
    );
  }

  getGates(): Observable<Gate[]> {
    return this.http
      .get<{ gates: Gate[]; total: number }>(this.gatesUrl)
      .pipe(
        map((res) => res.gates),
        catchError((err) => this.onError(err, 'Failed to fetch gates')),
      );
  }

  getGate(id: string): Observable<Gate> {
    return this.http
      .get<Gate>(`${this.gatesUrl}/${encodeURIComponent(id)}`)
      .pipe(catchError((err) => this.onError(err, `Failed to fetch gate "${id}"`)));
  }

  getGateByDomain(domain: string): Observable<Gate> {
    return this.http
      .get<Gate>(`${this.gatesUrl}/by-domain/${encodeURIComponent(domain)}`)
      .pipe(catchError((err) => this.onError(err, `Failed to fetch gate for domain "${domain}"`)));
  }

  createGate(dto: CreateGateDto): Observable<Gate> {
    return this.http.post<Gate>(this.gatesUrl, dto).pipe(
      map((created) => {
        this.successSnack(`Gate "${created.name}" created`);
        return created;
      }),
      catchError((err) => this.onError(err, 'Failed to create gate')),
    );
  }

  updateGate(id: string, dto: UpdateGateDto): Observable<Gate> {
    return this.http.put<Gate>(`${this.gatesUrl}/${encodeURIComponent(id)}`, dto).pipe(
      map((updated) => {
        this.successSnack(`Gate "${updated.name}" updated`);
        return updated;
      }),
      catchError((err) => this.onError(err, `Failed to update gate "${id}"`)),
    );
  }

  deleteGate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.gatesUrl}/${encodeURIComponent(id)}`).pipe(
      map(() => {
        this.successSnack('Gate deleted');
      }),
      catchError((err) => this.onError(err, `Failed to delete gate "${id}"`)),
    );
  }

  getAuditLog(params: { entityType?: string; entityId?: string; action?: string; before?: string; limit?: number } = {}): Observable<AuditLogResponse> {
    const qs = new URLSearchParams();
    if (params.entityType) qs.set('entity_type', params.entityType);
    if (params.entityId) qs.set('entity_id', params.entityId);
    if (params.action) qs.set('action', params.action);
    if (params.before) qs.set('before', params.before);
    if (params.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return this.http.get<AuditLogResponse>(`${this.systemUrl}/audit${suffix}`).pipe(
      catchError((err) => this.onError(err, 'Failed to fetch audit log')),
    );
  }

  getRemoteVersions(name: string): Observable<RemoteVersionsResponse> {
    return this.http.get<RemoteVersionsResponse>(`${this.baseUrl}/${encodeURIComponent(name)}/versions`).pipe(
      catchError((err) => this.onError(err, `Failed to fetch versions for "${name}"`)),
    );
  }

  rollbackRemote(name: string, version: number): Observable<PortalRemoteConfig> {
    return this.http.post<PortalRemoteConfig>(`${this.baseUrl}/${encodeURIComponent(name)}/rollback`, { version }).pipe(
      map((updated) => {
        this.successSnack(`Remote "${name}" rolled back to version ${version}`);
        return updated;
      }),
      catchError((err) => this.onError(err, `Failed to rollback "${name}"`)),
    );
  }

  toggleGate(id: string): Observable<Gate> {
    return this.http.post<Gate>(`${this.gatesUrl}/${encodeURIComponent(id)}/toggle`, {}).pipe(
      map((updated) => {
        this.successSnack(`Gate "${updated.name}" is now ${updated.enabled ? 'enabled' : 'disabled'}`);
        return updated;
      }),
      catchError((err) => this.onError(err, `Failed to toggle gate "${id}"`)),
    );
  }

  private async doHealthCheck(remoteUrl: string): Promise<{ status: RemoteHealthStatus; raw?: HealthStatus; responseTimeMs: number }> {
    const healthUrl = this.healthUrlFor(remoteUrl);
    const start = performance.now();
    try {
      const res = await fetch(healthUrl, { method: 'GET', cache: 'no-store' });
      const elapsed = performance.now() - start;
      if (!res.ok) return { status: 'down', responseTimeMs: elapsed };
      let raw: HealthStatus | undefined;
      try {
        raw = (await res.json()) as HealthStatus;
      } catch {
        /* not json — still healthy if 200 */
      }
      const status: RemoteHealthStatus = elapsed > 1500 ? 'degraded' : 'healthy';
      return { status, raw, responseTimeMs: elapsed };
    } catch {
      const elapsed = performance.now() - start;
      return { status: 'down', responseTimeMs: elapsed };
    }
  }

  private healthUrlFor(remoteEntryUrl: string): string {
    try {
      const u = new URL(remoteEntryUrl);
      u.pathname = '/health';
      u.search = '';
      return u.toString();
    } catch {
      return remoteEntryUrl.replace(/\/remoteEntry\.json.*$/, '/health');
    }
  }

  private onError(err: HttpErrorResponse, fallback: string): Observable<never> {
    const message = err.error?.message ?? err.message ?? fallback;
    this.errorSnack(`${fallback}: ${message}`);
    return throwError(() => err);
  }

  private successSnack(message: string): void {
    this.snack.open(message, 'OK', { duration: 3000, panelClass: ['success-snack'] });
  }

  private errorSnack(message: string): void {
    this.snack.open(message, 'Close', { duration: 6000, panelClass: ['error-snack'] });
  }
}
