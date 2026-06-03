import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { interval, startWith, switchMap } from 'rxjs';
import { ManagerService } from '../services/manager.service';
import type { MetricsSnapshot } from '../../types/observability';

@Component({
  selector: 'app-system-metrics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, MatCardModule, MatIconModule, MatTableModule],
  template: `
    <div class="page">
      <header>
        <h1>Metrics</h1>
        <p>In-memory counters — reset on registry restart. Auto-refresh every 5 seconds.</p>
      </header>

      @if (metrics(); as m) {
        <section class="summary">
          <mat-card>
            <mat-card-content>
              <span class="label">Uptime</span>
              <strong>{{ formatUptime(m.uptimeSec) }}</strong>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="label">Heap memory</span>
              <strong>{{ m.process.memMb | number }} MB</strong>
              <span class="muted">RSS {{ m.process.rssMb | number }} MB</span>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="label">Node version</span>
              <strong>{{ m.process.nodeVersion }}</strong>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <span class="label">Total requests</span>
              <strong>{{ totalRequests(m) | number }}</strong>
              <span class="muted">{{ totalErrors(m) | number }} errors</span>
            </mat-card-content>
          </mat-card>
        </section>

        <mat-card>
          <mat-card-header>
            <mat-icon mat-card-avatar>route</mat-icon>
            <mat-card-title>HTTP routes</mat-card-title>
            <mat-card-subtitle>Sorted by request count</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <table mat-table [dataSource]="m.routes" class="full">
              <ng-container matColumnDef="route">
                <th mat-header-cell *matHeaderCellDef>Route</th>
                <td mat-cell *matCellDef="let r"><code>{{ r.route }}</code></td>
              </ng-container>
              <ng-container matColumnDef="count">
                <th mat-header-cell *matHeaderCellDef>Count</th>
                <td mat-cell *matCellDef="let r">{{ r.count | number }}</td>
              </ng-container>
              <ng-container matColumnDef="errors">
                <th mat-header-cell *matHeaderCellDef>Errors</th>
                <td mat-cell *matCellDef="let r" [class.has-errors]="r.errors > 0">{{ r.errors | number }}</td>
              </ng-container>
              <ng-container matColumnDef="avg">
                <th mat-header-cell *matHeaderCellDef>Avg ms</th>
                <td mat-cell *matCellDef="let r">{{ r.avgDurationMs | number: '1.1-1' }}</td>
              </ng-container>
              <ng-container matColumnDef="min">
                <th mat-header-cell *matHeaderCellDef>Min</th>
                <td mat-cell *matCellDef="let r">{{ r.minDurationMs | number: '1.0-0' }}</td>
              </ng-container>
              <ng-container matColumnDef="max">
                <th mat-header-cell *matHeaderCellDef>Max</th>
                <td mat-cell *matCellDef="let r">{{ r.maxDurationMs | number: '1.0-0' }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="cols"></tr>
              <tr mat-row *matRowDef="let row; columns: cols"></tr>
            </table>
            @if (m.routes.length === 0) {
              <p class="empty">No requests recorded yet.</p>
            }
          </mat-card-content>
        </mat-card>

        @if (counterKeys(m).length > 0) {
          <mat-card>
            <mat-card-header>
              <mat-icon mat-card-avatar>tag</mat-icon>
              <mat-card-title>Custom counters</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <dl>
                @for (k of counterKeys(m); track k) {
                  <dt>{{ k }}</dt>
                  <dd>{{ m.counters[k] | number }}</dd>
                }
              </dl>
            </mat-card-content>
          </mat-card>
        }

        <p class="footer muted">Snapshot at {{ m.timestamp | date: 'medium' }}</p>
      } @else {
        <p>Loading...</p>
      }
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 1280px; margin: 0 auto; }
      header { margin-bottom: 24px; }
      header h1 { margin: 0 0 4px; font-size: 24px; }
      header p { margin: 0; color: rgba(0,0,0,0.6); font-size: 13px; }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      .summary mat-card-content { display: flex; flex-direction: column; gap: 2px; padding: 12px 4px; }
      .label { font-size: 11px; color: rgba(0,0,0,0.6); text-transform: uppercase; letter-spacing: 0.5px; }
      .summary strong { font-size: 22px; font-weight: 600; }
      .muted { font-size: 11px; color: rgba(0,0,0,0.5); }
      mat-card { margin-bottom: 16px; }
      mat-icon[mat-card-avatar] { color: rgba(0,0,0,0.6); }
      table.full { width: 100%; }
      code { font-family: monospace; font-size: 12px; color: rgba(0,0,0,0.75); }
      .has-errors { color: #b91c1c; font-weight: 600; }
      .empty { padding: 24px; text-align: center; color: rgba(0,0,0,0.5); }
      dl { display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; margin: 0; }
      dt { font-family: monospace; font-size: 13px; }
      dd { margin: 0; font-weight: 600; }
      .footer { margin-top: 16px; text-align: right; }
    `,
  ],
})
export class MetricsComponent implements OnInit {
  private readonly manager = inject(ManagerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly metrics = signal<MetricsSnapshot | null>(null);
  readonly cols = ['route', 'count', 'errors', 'avg', 'min', 'max'];

  ngOnInit(): void {
    interval(5_000)
      .pipe(
        startWith(0),
        switchMap(() => this.manager.getMetrics()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (m) => this.metrics.set(m),
      });
  }

  totalRequests(m: MetricsSnapshot): number {
    return m.routes.reduce((sum, r) => sum + r.count, 0);
  }

  totalErrors(m: MetricsSnapshot): number {
    return m.routes.reduce((sum, r) => sum + r.errors, 0);
  }

  counterKeys(m: MetricsSnapshot): string[] {
    return Object.keys(m.counters);
  }

  formatUptime(sec: number): string {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    if (sec < 86_400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
    return `${Math.floor(sec / 86_400)}d ${Math.floor((sec % 86_400) / 3600)}h`;
  }
}
