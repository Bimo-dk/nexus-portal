import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProtectionService } from './protection.service';
import type { BanEntry, GatewayMetrics, IpEntry, ProtectionConfig } from '../../types/protection';
import {
  NxBadgeComponent,
  NxConfirmDialogComponent,
  NxMonoValueComponent,
  NxSlideOverComponent,
  NxStatTileComponent,
} from '../../design-system';
import type { NxConfirmDialogData } from '../../design-system';

const HISTORY_LEN = 20;

@Component({
  selector: 'app-protection',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTableModule,
    MatTooltipModule,
    NxBadgeComponent,
    NxMonoValueComponent,
    NxSlideOverComponent,
    NxStatTileComponent,
  ],
  template: `
    <div class="nx-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Protection</h1>
          <p class="page-subtitle">Rate limiting, connection controls, and active bans</p>
        </div>
      </div>

      <div class="metrics-strip">
        <nx-stat-tile
          label="Requests blocked"
          [value]="latestMetrics()?.requests_blocked ?? 0"
          variant="danger"
          [sparkValues]="blockedHistory()"
        />
        <nx-stat-tile
          label="Active HTTP"
          [value]="latestMetrics()?.active_http ?? 0"
          [sparkValues]="httpHistory()"
        />
        <nx-stat-tile
          label="Active WS"
          [value]="latestMetrics()?.active_ws ?? 0"
          [sparkValues]="wsHistory()"
        />
        <nx-stat-tile
          label="Banned IPs"
          [value]="latestMetrics()?.banned_ips ?? bannedCount()"
          variant="warn"
          [sparkValues]="bannedIpsHistory()"
        />
        <nx-stat-tile
          label="Total violations"
          [value]="latestMetrics()?.total_violations ?? 0"
          variant="warn"
          [sparkValues]="violationsHistory()"
        />
      </div>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>Configuration</mat-card-title>
          <mat-card-subtitle>Active gateway protection policy</mat-card-subtitle>
          <span class="card-header-actions">
            <button mat-stroked-button (click)="openEdit()">
              <mat-icon>edit</mat-icon>
              Edit
            </button>
          </span>
        </mat-card-header>
        <mat-card-content>
          @if (config(); as cfg) {
            <dl class="config-dl">
              <div class="config-entry">
                <dt>Rate limiting</dt>
                <dd>
                  <nx-badge [variant]="cfg.rate_limit_enabled ? 'ok' : 'gray'">
                    {{ cfg.rate_limit_enabled ? 'Enabled' : 'Disabled' }}
                  </nx-badge>
                </dd>
              </div>
              <div class="config-entry">
                <dt>Requests / sec</dt>
                <dd><nx-mono [value]="'' + cfg.rate_limit_requests_per_second" /></dd>
              </div>
              <div class="config-entry">
                <dt>Burst</dt>
                <dd><nx-mono [value]="'' + cfg.rate_limit_burst" /></dd>
              </div>
              <div class="config-entry">
                <dt>Max connections / IP</dt>
                <dd><nx-mono [value]="'' + cfg.max_connections_per_ip" /></dd>
              </div>
              <div class="config-entry">
                <dt>Max WS / IP</dt>
                <dd><nx-mono [value]="'' + cfg.max_websocket_connections_per_ip" /></dd>
              </div>
              <div class="config-entry">
                <dt>Ban duration</dt>
                <dd><nx-mono [value]="cfg.ban_duration_seconds + 's'" /></dd>
              </div>
              <div class="config-entry">
                <dt>Violation threshold</dt>
                <dd><nx-mono [value]="'' + cfg.ban_threshold_violations" /></dd>
              </div>
              <div class="config-entry">
                <dt>Request timeout</dt>
                <dd><nx-mono [value]="cfg.request_timeout_ms + 'ms'" /></dd>
              </div>
            </dl>
          } @else {
            <div class="nx-empty-state">Loading configuration…</div>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>
            Active Bans
            @if (bannedCount() > 0) {
              <nx-badge variant="red" style="margin-left:8px">{{ bannedCount() }}</nx-badge>
            }
          </mat-card-title>
          <span class="card-header-actions">
            @if (bans().length > 0) {
              <button mat-stroked-button color="warn" (click)="confirmClearAll()">
                <mat-icon>clear_all</mat-icon>
                Clear all
              </button>
            }
          </span>
        </mat-card-header>
        <mat-card-content>
          @if (bans().length === 0) {
            <div class="nx-empty-state">No active bans</div>
          } @else {
            <table mat-table [dataSource]="bans()" class="nx-table">
              <ng-container matColumnDef="ip">
                <th mat-header-cell *matHeaderCellDef>IP Address</th>
                <td mat-cell *matCellDef="let row"><nx-mono [value]="row.ip" /></td>
              </ng-container>
              <ng-container matColumnDef="reason">
                <th mat-header-cell *matHeaderCellDef>Reason</th>
                <td mat-cell *matCellDef="let row">{{ row.reason }}</td>
              </ng-container>
              <ng-container matColumnDef="violations">
                <th mat-header-cell *matHeaderCellDef>Violations</th>
                <td mat-cell *matCellDef="let row" class="nx-num">{{ row.violations }}</td>
              </ng-container>
              <ng-container matColumnDef="banned_until">
                <th mat-header-cell *matHeaderCellDef>Expires</th>
                <td mat-cell *matCellDef="let row">
                  <nx-mono [value]="(row.banned_until | date:'short') ?? ''" />
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let row">
                  <button
                    mat-icon-button
                    matTooltip="Unban"
                    (click)="confirmUnban(row.ip)"
                  >
                    <mat-icon>lock_open</mat-icon>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="banCols"></tr>
              <tr mat-row *matRowDef="let r; columns: banCols"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>Top Offenders</mat-card-title>
          <mat-card-subtitle>IPs with the highest connection or violation counts</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (offenders().length === 0) {
            <div class="nx-empty-state">No offenders detected</div>
          } @else {
            <table mat-table [dataSource]="offenders()" class="nx-table">
              <ng-container matColumnDef="ip">
                <th mat-header-cell *matHeaderCellDef>IP Address</th>
                <td mat-cell *matCellDef="let row"><nx-mono [value]="row.ip" /></td>
              </ng-container>
              <ng-container matColumnDef="http">
                <th mat-header-cell *matHeaderCellDef>HTTP</th>
                <td mat-cell *matCellDef="let row" class="nx-num">{{ row.http_connections }}</td>
              </ng-container>
              <ng-container matColumnDef="ws">
                <th mat-header-cell *matHeaderCellDef>WS</th>
                <td mat-cell *matCellDef="let row" class="nx-num">{{ row.websocket_connections }}</td>
              </ng-container>
              <ng-container matColumnDef="violations">
                <th mat-header-cell *matHeaderCellDef>Violations</th>
                <td mat-cell *matCellDef="let row" class="nx-num">{{ row.violations }}</td>
              </ng-container>
              <ng-container matColumnDef="banned">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let row">
                  <nx-badge [variant]="row.banned ? 'red' : 'gray'">
                    {{ row.banned ? 'Banned' : 'Active' }}
                  </nx-badge>
                </td>
              </ng-container>
              <ng-container matColumnDef="bar">
                <th mat-header-cell *matHeaderCellDef>Connections</th>
                <td mat-cell *matCellDef="let row" style="min-width:120px">
                  <div class="nx-progress-bar">
                    <div
                      class="nx-progress-bar-fill"
                      [style.width.%]="connectionPct(row)"
                    ></div>
                  </div>
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let row">
                  @if (row.banned) {
                    <button mat-icon-button matTooltip="Unban" (click)="confirmUnban(row.ip)">
                      <mat-icon>lock_open</mat-icon>
                    </button>
                  } @else {
                    <button mat-icon-button matTooltip="Ban" (click)="confirmBan(row.ip)">
                      <mat-icon>block</mat-icon>
                    </button>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="offenderCols"></tr>
              <tr mat-row *matRowDef="let r; columns: offenderCols"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>
    </div>

    <nx-slide-over
      [open]="editOpen()"
      title="Edit Protection Config"
      (closeClick)="editOpen.set(false)"
    >
      <form [formGroup]="configForm" class="slide-over-form">
        <div class="form-section-heading">Rate Limiting</div>
        <mat-slide-toggle formControlName="rate_limit_enabled">Enabled</mat-slide-toggle>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Requests / sec</mat-label>
            <input matInput type="number" formControlName="rate_limit_requests_per_second" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Burst</mat-label>
            <input matInput type="number" formControlName="rate_limit_burst" />
            @if (burstError()) {
              <mat-error>Must be ≥ requests / sec</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="form-section-heading">Connections</div>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Max connections / IP</mat-label>
            <input matInput type="number" formControlName="max_connections_per_ip" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Max WS / IP</mat-label>
            <input matInput type="number" formControlName="max_websocket_connections_per_ip" />
          </mat-form-field>
        </div>

        <div class="form-section-heading">Timeouts (ms)</div>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Request</mat-label>
            <input matInput type="number" formControlName="request_timeout_ms" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Header read</mat-label>
            <input matInput type="number" formControlName="header_read_timeout_ms" />
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Body read</mat-label>
            <input matInput type="number" formControlName="body_read_timeout_ms" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Idle</mat-label>
            <input matInput type="number" formControlName="idle_timeout_ms" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Slowloris (ms)</mat-label>
          <input matInput type="number" formControlName="slowloris_timeout_ms" />
        </mat-form-field>

        <div class="form-section-heading">Limits (bytes)</div>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Max body</mat-label>
            <input matInput type="number" formControlName="max_body_bytes" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Max header</mat-label>
            <input matInput type="number" formControlName="max_header_bytes" />
          </mat-form-field>
        </div>

        <div class="form-section-heading">Ban Policy</div>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Duration (sec)</mat-label>
            <input matInput type="number" formControlName="ban_duration_seconds" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Violation threshold</mat-label>
            <input matInput type="number" formControlName="ban_threshold_violations" />
          </mat-form-field>
        </div>
      </form>

      <ng-container slot="footer">
        <button mat-button (click)="editOpen.set(false)">Cancel</button>
        <button
          mat-raised-button
          color="primary"
          [disabled]="configForm.invalid || burstError() || formSaving()"
          (click)="saveConfig()"
        >Save</button>
      </ng-container>
    </nx-slide-over>
  `,
  styles: [`
    .metrics-strip {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .section-card { margin-bottom: 20px; }
    .card-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }
    .config-dl {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0;
      margin: 0;
      padding: 0;
    }
    .config-entry {
      padding: 10px 16px;
      border-bottom: 1px solid var(--color-border);
    }
    .config-entry dt {
      font-size: 11px;
      color: var(--text-secondary);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .config-entry dd { margin: 0; }
    .nx-num { text-align: right; font-variant-numeric: tabular-nums; }
    .slide-over-form { display: flex; flex-direction: column; gap: 12px; }
    .form-section-heading {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-tertiary);
      margin-top: 8px;
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .page-title { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
    .page-subtitle { margin: 0; font-size: 13px; color: var(--text-secondary); }
    .page-header { margin-bottom: 20px; }
  `],
})
export class ProtectionComponent implements OnInit {
  private readonly svc = inject(ProtectionService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly config = toSignal(this.svc.protectionConfig$);
  readonly bans = toSignal(this.svc.activeBans$, { initialValue: [] as BanEntry[] });
  readonly offenders = toSignal(this.svc.topOffenders$, { initialValue: [] as IpEntry[] });
  readonly bannedCount = toSignal(this.svc.bannedCount$, { initialValue: 0 });

  readonly latestMetrics = signal<GatewayMetrics | null>(null);
  readonly blockedHistory = signal<number[]>([]);
  readonly httpHistory = signal<number[]>([]);
  readonly wsHistory = signal<number[]>([]);
  readonly bannedIpsHistory = signal<number[]>([]);
  readonly violationsHistory = signal<number[]>([]);

  readonly maxConnections = computed(() =>
    Math.max(...this.offenders().map((ip) => ip.http_connections + ip.websocket_connections), 1),
  );

  readonly editOpen = signal(false);
  readonly formSaving = signal(false);
  readonly burstError = signal(false);

  readonly configForm = new FormGroup({
    rate_limit_enabled: new FormControl(false, { nonNullable: true }),
    rate_limit_requests_per_second: new FormControl(100, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    rate_limit_burst: new FormControl(200, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    max_connections_per_ip: new FormControl(50, { nonNullable: true, validators: Validators.min(1) }),
    max_websocket_connections_per_ip: new FormControl(10, { nonNullable: true, validators: Validators.min(1) }),
    request_timeout_ms: new FormControl(30_000, { nonNullable: true, validators: Validators.min(1) }),
    header_read_timeout_ms: new FormControl(5_000, { nonNullable: true, validators: Validators.min(1) }),
    body_read_timeout_ms: new FormControl(10_000, { nonNullable: true, validators: Validators.min(1) }),
    idle_timeout_ms: new FormControl(60_000, { nonNullable: true, validators: Validators.min(1) }),
    max_body_bytes: new FormControl(1_048_576, { nonNullable: true, validators: Validators.min(1) }),
    max_header_bytes: new FormControl(8_192, { nonNullable: true, validators: Validators.min(1) }),
    slowloris_timeout_ms: new FormControl(10_000, { nonNullable: true, validators: Validators.min(1) }),
    ban_duration_seconds: new FormControl(3_600, { nonNullable: true, validators: Validators.min(1) }),
    ban_threshold_violations: new FormControl(10, { nonNullable: true, validators: Validators.min(1) }),
  });

  readonly banCols = ['ip', 'reason', 'violations', 'banned_until', 'actions'];
  readonly offenderCols = ['ip', 'http', 'ws', 'violations', 'banned', 'bar', 'actions'];

  ngOnInit(): void {
    this.svc
      .loadConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cfg) => {
        this.configForm.patchValue(cfg, { emitEvent: false });
        this.burstError.set(cfg.rate_limit_burst < cfg.rate_limit_requests_per_second);
      });

    this.configForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((v) => {
      this.burstError.set((v.rate_limit_burst ?? 0) < (v.rate_limit_requests_per_second ?? 0));
    });

    this.svc.loadStatus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.fetchMetrics();

    const statusTimer = setInterval(() => {
      this.svc.loadStatus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }, 10_000);

    const metricsTimer = setInterval(() => this.fetchMetrics(), 5_000);

    this.destroyRef.onDestroy(() => {
      clearInterval(statusTimer);
      clearInterval(metricsTimer);
    });
  }

  openEdit(): void {
    const cfg = this.config();
    if (cfg) this.configForm.patchValue(cfg, { emitEvent: false });
    this.editOpen.set(true);
  }

  saveConfig(): void {
    if (this.configForm.invalid || this.burstError()) return;
    this.formSaving.set(true);
    this.svc
      .updateConfig(this.configForm.getRawValue() as ProtectionConfig)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.editOpen.set(false);
          this.formSaving.set(false);
        },
        error: () => this.formSaving.set(false),
      });
  }

  confirmUnban(ip: string): void {
    this.dialog
      .open<NxConfirmDialogComponent, NxConfirmDialogData, boolean>(NxConfirmDialogComponent, {
        data: { title: 'Unban IP', message: `Remove ban for ${ip}?`, confirmLabel: 'Unban' },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.svc.unbanIp(ip).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
      });
  }

  confirmBan(ip: string): void {
    const duration = this.config()?.ban_duration_seconds ?? 3_600;
    this.dialog
      .open<NxConfirmDialogComponent, NxConfirmDialogData, boolean>(NxConfirmDialogComponent, {
        data: { title: 'Ban IP', message: `Ban ${ip} for ${duration}s?`, confirmLabel: 'Ban' },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.svc.banIp(ip, duration).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
      });
  }

  confirmClearAll(): void {
    this.dialog
      .open<NxConfirmDialogComponent, NxConfirmDialogData, boolean>(NxConfirmDialogComponent, {
        data: { title: 'Clear all bans', message: 'Remove all active bans?', confirmLabel: 'Clear all' },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.svc.clearAllBans().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
      });
  }

  connectionPct(ip: IpEntry): number {
    const total = ip.http_connections + ip.websocket_connections;
    return Math.round((total / this.maxConnections()) * 100);
  }

  private fetchMetrics(): void {
    this.svc
      .loadMetrics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((m) => {
        this.latestMetrics.set(m);
        this.push(this.blockedHistory, m.requests_blocked);
        this.push(this.httpHistory, m.active_http);
        this.push(this.wsHistory, m.active_ws);
        this.push(this.bannedIpsHistory, m.banned_ips);
        this.push(this.violationsHistory, m.total_violations);
      });
  }

  private push(sig: WritableSignal<number[]>, v: number): void {
    const cur = sig();
    sig.set(cur.length >= HISTORY_LEN ? [...cur.slice(1), v] : [...cur, v]);
  }
}
