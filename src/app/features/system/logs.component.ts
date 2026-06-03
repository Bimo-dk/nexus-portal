import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { interval, startWith, switchMap } from 'rxjs';
import { ManagerService } from '../services/manager.service';
import type { LogEntry, LogLevel } from '../../types/observability';

const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error'];

@Component({
  selector: 'app-system-logs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  template: `
    <div class="page">
      <header>
        <div>
          <h1>Logs</h1>
          <p>In-memory ring buffer — most recent 500 entries. Auto-refresh every 5 seconds.</p>
        </div>
        <div class="controls">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Min level</mat-label>
            <mat-select [(ngModel)]="minLevel" (selectionChange)="reload()">
              <mat-option value="debug">debug</mat-option>
              <mat-option value="info">info</mat-option>
              <mat-option value="warn">warn</mat-option>
              <mat-option value="error">error</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-slide-toggle [(ngModel)]="autoRefresh">Auto-refresh</mat-slide-toggle>
          <button mat-icon-button (click)="reload()" matTooltip="Refresh now">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </header>

      <mat-card>
        <mat-card-content class="log-pane">
          @for (entry of visibleEntries(); track entry.ts + entry.message) {
            <div class="log-line" [class]="entry.level">
              <span class="ts">{{ entry.ts | date: 'HH:mm:ss.SSS' }}</span>
              <span class="lvl" [class]="entry.level">{{ entry.level.toUpperCase() }}</span>
              <span class="src">[{{ entry.source }}]</span>
              <span class="msg">{{ entry.message }}</span>
              @if (entry.correlationId) {
                <span class="cid">{{ entry.correlationId }}</span>
              }
            </div>
          } @empty {
            <p class="empty">No log entries (yet).</p>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 1280px; margin: 0 auto; }
      header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
      header h1 { margin: 0 0 4px; font-size: 24px; }
      header p { margin: 0; color: rgba(0,0,0,0.6); font-size: 13px; }
      .controls { display: flex; align-items: center; gap: 12px; }
      .controls mat-form-field { width: 140px; }
      .log-pane {
        font-family: 'SF Mono', Consolas, monospace;
        font-size: 12px;
        background: #0f172a;
        color: #e2e8f0;
        padding: 12px;
        max-height: 600px;
        overflow-y: auto;
        border-radius: 4px;
      }
      .log-line { padding: 2px 0; display: flex; gap: 8px; align-items: baseline; }
      .ts { color: #64748b; flex-shrink: 0; }
      .lvl { font-weight: 700; flex-shrink: 0; min-width: 50px; }
      .lvl.debug { color: #94a3b8; }
      .lvl.info { color: #38bdf8; }
      .lvl.warn { color: #fbbf24; }
      .lvl.error { color: #f87171; }
      .src { color: #a78bfa; flex-shrink: 0; }
      .msg { flex: 1; word-break: break-word; }
      .cid { color: #64748b; font-size: 10px; flex-shrink: 0; }
      .log-line.error { background: rgba(248, 113, 113, 0.08); }
      .log-line.warn { background: rgba(251, 191, 36, 0.06); }
      .empty { color: #64748b; padding: 24px; text-align: center; }
    `,
  ],
})
export class LogsComponent implements OnInit {
  private readonly manager = inject(ManagerService);
  private readonly destroyRef = inject(DestroyRef);

  minLevel: LogLevel = 'info';
  autoRefresh = true;

  readonly entries = signal<LogEntry[]>([]);

  readonly visibleEntries = computed(() => {
    const minIdx = LEVEL_ORDER.indexOf(this.minLevel);
    return this.entries().filter((e) => LEVEL_ORDER.indexOf(e.level) >= minIdx);
  });

  ngOnInit(): void {
    interval(5_000)
      .pipe(
        startWith(0),
        switchMap(() => this.manager.getLogs({ limit: 300, level: this.minLevel })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (this.autoRefresh) this.entries.set(res.entries);
        },
      });
  }

  reload(): void {
    this.manager.getLogs({ limit: 300, level: this.minLevel }).subscribe({
      next: (res) => this.entries.set(res.entries),
    });
  }
}
