import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { interval, startWith, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ManagerService } from '../services/manager.service';
import type { RemoteConfig, RemoteHealthStatus } from '@bimo-dk/nexus-core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    RouterLink,
    DatePipe,
    UpperCasePipe,
  ],
  template: `
    <div class="page">
      <header>
        <h1>Nexus dashboard</h1>
        <p>Auto-refresh every {{ refreshInterval / 1000 }} seconds · last updated: {{ lastUpdated() | date: 'medium' }}</p>
      </header>

      @if (loading() && remotes().length === 0) {
        <div class="loader"><mat-spinner diameter="48" /></div>
      } @else {
        <section class="stats">
          <mat-card>
            <mat-card-content>
              <span class="label">Total remotes</span>
              <strong>{{ remotes().length }}</strong>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="label">Enabled</span>
              <strong>{{ enabledCount() }}</strong>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="label">Healthy</span>
              <strong class="healthy">{{ countByStatus('healthy') }}</strong>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="label">Degraded</span>
              <strong class="degraded">{{ countByStatus('degraded') }}</strong>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="label">Down</span>
              <strong class="down">{{ countByStatus('down') }}</strong>
            </mat-card-content>
          </mat-card>
        </section>

        <section class="remote-grid">
          @for (r of remotes(); track r.name) {
            <mat-card>
              <mat-card-header>
                <mat-card-title>{{ r.name }}</mat-card-title>
                <mat-card-subtitle>/{{ r.routePath }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <span class="status-pill" [class]="statusClass(r.name)">
                  <span class="dot"></span>
                  {{ statusFor(r.name) | uppercase }}
                </span>
                <p class="url">{{ r.url }}</p>
                <p class="meta">
                  <strong>Enabled:</strong> {{ r.enabled ? 'Yes' : 'No' }}<br />
                  <strong>Added:</strong> {{ r.addedAt | date: 'short' }}
                </p>
              </mat-card-content>
              <mat-card-actions>
                <a mat-button [routerLink]="['/remotes', r.name]">Details</a>
              </mat-card-actions>
            </mat-card>
          } @empty {
            <p class="empty">No remotes registered. Add one under <strong>Remotes → Add</strong>.</p>
          }
        </section>
      }
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 1280px; margin: 0 auto; }
      header { margin-bottom: 24px; }
      header h1 { margin: 0 0 4px; font-size: 24px; }
      header p { margin: 0; color: rgba(0,0,0,0.6); font-size: 13px; }
      .loader { display: flex; justify-content: center; padding: 48px; }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 32px;
      }
      .stats mat-card-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px 4px;
      }
      .stats .label { font-size: 12px; color: rgba(0,0,0,0.6); text-transform: uppercase; letter-spacing: 0.5px; }
      .stats strong { font-size: 28px; font-weight: 600; }
      .stats strong.healthy { color: #15803d; }
      .stats strong.degraded { color: #b45309; }
      .stats strong.down { color: #b91c1c; }
      .remote-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }
      .remote-grid .url {
        margin: 12px 0 8px;
        font-family: monospace;
        font-size: 12px;
        color: rgba(0,0,0,0.6);
        word-break: break-all;
      }
      .remote-grid .meta { margin: 0; font-size: 13px; color: rgba(0,0,0,0.7); line-height: 1.5; }
      .empty {
        grid-column: 1 / -1;
        text-align: center;
        color: rgba(0,0,0,0.6);
        padding: 32px;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly manager = inject(ManagerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly refreshInterval = environment.refreshIntervalMs;
  readonly loading = signal(true);
  readonly remotes = signal<RemoteConfig[]>([]);
  readonly lastUpdated = signal<Date>(new Date());
  readonly healthMap = signal<Map<string, RemoteHealthStatus>>(new Map());

  ngOnInit(): void {
    interval(this.refreshInterval)
      .pipe(
        startWith(0),
        switchMap(() => this.manager.getRemotes()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.remotes.set(res.remotes);
          this.lastUpdated.set(new Date());
          this.loading.set(false);
          this.refreshHealth(res.remotes);
        },
        error: () => this.loading.set(false),
      });
  }

  enabledCount(): number {
    return this.remotes().filter((r) => r.enabled).length;
  }

  statusFor(name: string): RemoteHealthStatus {
    return this.healthMap().get(name) ?? 'unknown';
  }

  statusClass(name: string): string {
    return this.statusFor(name);
  }

  countByStatus(status: RemoteHealthStatus): number {
    let n = 0;
    for (const s of this.healthMap().values()) if (s === status) n++;
    return n;
  }

  private async refreshHealth(remotes: RemoteConfig[]): Promise<void> {
    const checks = remotes.map(async (r) => {
      const result = await new Promise<RemoteHealthStatus>((resolve) => {
        this.manager.checkHealth(r.url).subscribe({
          next: (h) => resolve(h.status),
          error: () => resolve('down'),
        });
      });
      return { name: r.name, status: result };
    });
    const results = await Promise.all(checks);
    this.healthMap.update((m) => {
      const next = new Map(m);
      for (const r of results) next.set(r.name, r.status);
      return next;
    });
  }
}
