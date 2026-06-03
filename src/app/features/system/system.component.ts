import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { interval, startWith, switchMap } from 'rxjs';
import { ManagerService } from '../services/manager.service';
import type { ServiceHealth, SystemHealthSnapshot, ServiceKind } from '../../types/system-health';
import type { RemoteHealthStatus } from '../../types/remote-config';

const KIND_LABELS: Record<ServiceKind, string> = {
  registry: 'Registry',
  system: 'System',
  remote: 'Remote',
};

@Component({
  selector: 'app-system',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    UpperCasePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page">
      <header>
        <div>
          <h1>System</h1>
          <p>Live status for alle Bimo-Nexus services. Auto-refresh hvert 10. sekund.</p>
        </div>
        <button mat-raised-button color="primary" (click)="refreshNow()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon> Refresh nu
        </button>
      </header>

      @if (snapshot(); as snap) {
        <section class="summary">
          <mat-card class="summary-card healthy">
            <mat-card-content>
              <span class="label">HEALTHY</span>
              <strong>{{ snap.summary.healthy }}</strong>
            </mat-card-content>
          </mat-card>
          <mat-card class="summary-card degraded">
            <mat-card-content>
              <span class="label">DEGRADED</span>
              <strong>{{ snap.summary.degraded }}</strong>
            </mat-card-content>
          </mat-card>
          <mat-card class="summary-card down">
            <mat-card-content>
              <span class="label">DOWN</span>
              <strong>{{ snap.summary.down }}</strong>
            </mat-card-content>
          </mat-card>
          <mat-card class="summary-card unknown">
            <mat-card-content>
              <span class="label">UNKNOWN</span>
              <strong>{{ snap.summary.unknown }}</strong>
            </mat-card-content>
          </mat-card>
          <mat-card class="summary-card meta">
            <mat-card-content>
              <span class="label">Total</span>
              <strong>{{ snap.summary.total }}</strong>
              <span class="muted">Last: {{ snap.timestamp | date: 'mediumTime' }}</span>
            </mat-card-content>
          </mat-card>
        </section>

        @for (group of groupedServices(); track group.kind) {
          <h2>{{ kindLabel(group.kind) }}</h2>
          <section class="service-grid">
            @for (svc of group.services; track svc.name) {
              <mat-card class="service-card" [class]="svc.status">
                <mat-card-header>
                  <mat-icon mat-card-avatar [class]="svc.status">{{ icon(svc) }}</mat-icon>
                  <mat-card-title>{{ svc.name }}</mat-card-title>
                  <mat-card-subtitle>
                    <span class="status-pill" [class]="svc.status">
                      <span class="dot"></span>
                      {{ svc.status | uppercase }}
                    </span>
                    @if (!svc.enabled) {
                      <span class="status-pill unknown">DISABLED</span>
                    }
                  </mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  @if (svc.latencyMs !== undefined) {
                    <p class="metric">
                      <mat-icon>speed</mat-icon>
                      <span>{{ svc.latencyMs | number: '1.0-0' }} ms</span>
                    </p>
                  }
                  @if (svc.url) {
                    <p class="url" [matTooltip]="svc.url">{{ svc.url }}</p>
                  }
                  @if (svc.error) {
                    <p class="error">{{ svc.error }}</p>
                  }
                  <p class="muted">Last checked: {{ svc.lastChecked | date: 'mediumTime' }}</p>
                </mat-card-content>
              </mat-card>
            }
          </section>
        }
      } @else if (loading()) {
        <p>Indlæser system status...</p>
      } @else if (error()) {
        <mat-card class="error-card">
          <mat-card-content>
            <p><strong>Fejl:</strong> {{ error() }}</p>
            <button mat-button color="primary" (click)="refreshNow()">Prøv igen</button>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 1280px; margin: 0 auto; }
      header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
      header h1 { margin: 0; font-size: 24px; }
      header p { margin: 4px 0 0; color: rgba(0,0,0,0.6); font-size: 13px; }
      h2 { margin: 32px 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.6px; color: rgba(0,0,0,0.6); }

      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      .summary-card mat-card-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px 4px;
      }
      .summary-card .label { font-size: 11px; color: rgba(0,0,0,0.6); text-transform: uppercase; letter-spacing: 0.5px; }
      .summary-card strong { font-size: 28px; font-weight: 600; }
      .summary-card.healthy strong { color: #15803d; }
      .summary-card.degraded strong { color: #b45309; }
      .summary-card.down strong { color: #b91c1c; }
      .summary-card.unknown strong { color: rgba(0,0,0,0.6); }
      .summary-card.meta .muted { font-size: 11px; color: rgba(0,0,0,0.5); }

      .service-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }

      .service-card { border-left: 4px solid transparent; }
      .service-card.healthy { border-left-color: #16a34a; }
      .service-card.degraded { border-left-color: #f59e0b; }
      .service-card.down { border-left-color: #dc2626; }
      .service-card.unknown { border-left-color: #94a3b8; }

      mat-icon[mat-card-avatar].healthy { color: #16a34a; background: #dcfce7; }
      mat-icon[mat-card-avatar].degraded { color: #b45309; background: #fef3c7; }
      mat-icon[mat-card-avatar].down { color: #b91c1c; background: #fee2e2; }
      mat-icon[mat-card-avatar].unknown { color: #475569; background: #f1f5f9; }
      mat-icon[mat-card-avatar] { display: flex; align-items: center; justify-content: center; border-radius: 999px; }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        margin-right: 6px;
      }
      .status-pill .dot { width: 8px; height: 8px; border-radius: 999px; background: currentColor; }
      .status-pill.healthy { background: #dcfce7; color: #14532d; }
      .status-pill.degraded { background: #fef3c7; color: #78350f; }
      .status-pill.down { background: #fee2e2; color: #7f1d1d; }
      .status-pill.unknown { background: #f1f5f9; color: #475569; }

      .metric { display: flex; align-items: center; gap: 6px; margin: 8px 0; font-size: 14px; font-family: monospace; }
      .metric mat-icon { font-size: 16px; width: 16px; height: 16px; color: rgba(0,0,0,0.5); }

      .url {
        font-family: monospace;
        font-size: 11px;
        color: rgba(0,0,0,0.5);
        margin: 4px 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .error { color: #b91c1c; font-size: 12px; margin: 4px 0; }
      .muted { color: rgba(0,0,0,0.5); font-size: 11px; margin: 4px 0 0; }
      .error-card { max-width: 480px; }
    `,
  ],
})
export class SystemComponent implements OnInit {
  private readonly manager = inject(ManagerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly snapshot = signal<SystemHealthSnapshot | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly groupedServices = computed(() => {
    const snap = this.snapshot();
    if (!snap) return [];
    const groups = new Map<ServiceKind, ServiceHealth[]>();
    for (const svc of snap.services) {
      if (!groups.has(svc.kind)) groups.set(svc.kind, []);
      groups.get(svc.kind)!.push(svc);
    }
    const order: ServiceKind[] = ['registry', 'system', 'remote'];
    return order
      .filter((k) => groups.has(k))
      .map((k) => ({ kind: k, services: groups.get(k)! }));
  });

  ngOnInit(): void {
    interval(10_000)
      .pipe(
        startWith(0),
        switchMap(() => this.manager.getSystemHealth()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (snap) => {
          this.snapshot.set(snap);
          this.error.set(null);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(err instanceof Error ? err.message : String(err));
          this.loading.set(false);
        },
      });
  }

  refreshNow(): void {
    this.loading.set(true);
    this.manager.getSystemHealth(true).subscribe({
      next: (snap) => {
        this.snapshot.set(snap);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : String(err));
        this.loading.set(false);
      },
    });
  }

  kindLabel(k: ServiceKind): string {
    return KIND_LABELS[k];
  }

  icon(s: ServiceHealth): string {
    if (s.kind === 'registry') return 'inventory_2';
    if (s.kind === 'system') return 'hub';
    return 'extension';
  }
}
