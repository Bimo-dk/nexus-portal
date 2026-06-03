import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, catchError, from, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  AddRemoteRequest,
  HealthStatus,
  RegistryResponse,
  RemoteConfig,
  RemoteHealthStatus,
  UpdateRemoteRequest,
} from '../../types/remote-config';
import type { SystemHealthSnapshot } from '../../types/system-health';

@Injectable({ providedIn: 'root' })
export class ManagerService {
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly baseUrl = `${environment.registryUrl}/remotes`;
  private readonly systemUrl = `${environment.registryUrl}/system`;

  getSystemHealth(fresh = false): Observable<SystemHealthSnapshot> {
    const url = fresh ? `${this.systemUrl}/health?fresh=true` : `${this.systemUrl}/health`;
    return this.http.get<SystemHealthSnapshot>(url).pipe(
      catchError((err) => this.onError(err, 'Kunne ikke hente system health')),
    );
  }

  getRemotes(): Observable<RegistryResponse> {
    return this.http.get<RegistryResponse>(this.baseUrl).pipe(catchError((err) => this.onError(err, 'Kunne ikke hente remotes')));
  }

  getRemote(name: string): Observable<RemoteConfig> {
    return this.http.get<RemoteConfig>(`${this.baseUrl}/${encodeURIComponent(name)}`).pipe(
      catchError((err) => this.onError(err, `Kunne ikke hente remote "${name}"`)),
    );
  }

  addRemote(config: AddRemoteRequest): Observable<RemoteConfig> {
    return this.http.post<RemoteConfig>(this.baseUrl, config).pipe(
      map((created) => {
        this.successSnack(`Remote "${created.name}" tilføjet`);
        return created;
      }),
      catchError((err) => this.onError(err, 'Kunne ikke tilføje remote')),
    );
  }

  updateRemote(name: string, patch: UpdateRemoteRequest): Observable<RemoteConfig> {
    return this.http.put<RemoteConfig>(`${this.baseUrl}/${encodeURIComponent(name)}`, patch).pipe(
      map((updated) => {
        this.successSnack(`Remote "${updated.name}" opdateret`);
        return updated;
      }),
      catchError((err) => this.onError(err, `Kunne ikke opdatere remote "${name}"`)),
    );
  }

  deleteRemote(name: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(name)}`).pipe(
      map(() => {
        this.successSnack(`Remote "${name}" slettet`);
      }),
      catchError((err) => this.onError(err, `Kunne ikke slette remote "${name}"`)),
    );
  }

  toggleRemote(name: string): Observable<RemoteConfig> {
    return this.http.post<RemoteConfig>(`${this.baseUrl}/${encodeURIComponent(name)}/toggle`, {}).pipe(
      map((updated) => {
        this.successSnack(`Remote "${updated.name}" er nu ${updated.enabled ? 'aktiv' : 'deaktiveret'}`);
        return updated;
      }),
      catchError((err) => this.onError(err, `Kunne ikke skifte tilstand på "${name}"`)),
    );
  }

  redeployRemote(name: string): Observable<{ accepted: boolean; remote: string; timestamp: string }> {
    return this.http
      .post<{ accepted: boolean; remote: string; timestamp: string }>(`${this.baseUrl}/${encodeURIComponent(name)}/redeploy`, {})
      .pipe(
        map((res) => {
          this.successSnack(`Redeploy-signal sendt for "${name}"`);
          return res;
        }),
        catchError((err) => this.onError(err, `Kunne ikke sende redeploy for "${name}"`)),
      );
  }

  checkHealth(remoteUrl: string): Observable<{ status: RemoteHealthStatus; raw?: HealthStatus; responseTimeMs: number }> {
    return from(this.doHealthCheck(remoteUrl));
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
    this.snack.open(message, 'Luk', { duration: 6000, panelClass: ['error-snack'] });
  }
}
