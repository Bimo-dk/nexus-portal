import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ManagerService } from '../services/manager.service';
import type { AuditEntry } from '../../types/platform';

@Component({
  selector: 'app-audit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    JsonPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <div class="page">
      <header>
        <div>
          <h1>Audit log</h1>
          <p>Immutable record of every create, update, delete, toggle, and rollback action.</p>
        </div>
        <button mat-stroked-button (click)="load()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </header>

      <div class="filters">
        <mat-form-field appearance="outline">
          <mat-label>Entity type</mat-label>
          <mat-select [(ngModel)]="filterEntityType">
            <mat-option value="">All</mat-option>
            <mat-option value="remote">Remote</mat-option>
            <mat-option value="host">Host</mat-option>
            <mat-option value="gate">Gate</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Action</mat-label>
          <mat-select [(ngModel)]="filterAction">
            <mat-option value="">All</mat-option>
            <mat-option value="created">Created</mat-option>
            <mat-option value="updated">Updated</mat-option>
            <mat-option value="deleted">Deleted</mat-option>
            <mat-option value="toggled">Toggled</mat-option>
            <mat-option value="bulk_toggled">Bulk toggled</mat-option>
            <mat-option value="rollback">Rollback</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Limit</mat-label>
          <mat-select [(ngModel)]="filterLimit">
            <mat-option [value]="25">25</mat-option>
            <mat-option [value]="50">50</mat-option>
            <mat-option [value]="100">100</mat-option>
            <mat-option [value]="500">500</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-raised-button color="primary" (click)="load()">Apply</button>
      </div>

      @if (loading()) {
        <p class="hint">Loading...</p>
      } @else if (entries().length === 0) {
        <p class="hint">No audit entries found.</p>
      } @else {
        <p class="count">{{ total() }} entries &middot; showing {{ entries().length }}</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Meta</th>
              </tr>
            </thead>
            <tbody>
              @for (e of entries(); track e.id) {
                <tr>
                  <td class="mono">{{ e.createdAt | date: 'short' }}</td>
                  <td><span class="pill" [class]="'type-' + e.entityType">{{ e.entityType }}</span></td>
                  <td class="mono">{{ e.entityId }}</td>
                  <td><span class="pill" [class]="'action-' + e.action">{{ e.action }}</span></td>
                  <td class="mono">{{ e.actor }}</td>
                  <td class="mono meta">{{ e.meta ? (e.meta | json) : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1400px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 16px; flex-wrap: wrap; }
    header h1 { margin: 0; font-size: 22px; }
    header p { margin: 4px 0 0; font-size: 13px; color: rgba(0,0,0,0.6); }

    .filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; padding: 8px; background: #f8fafc; border-radius: 10px; }
    .filters mat-form-field { min-width: 140px; }

    .count { margin: 0 0 8px; font-size: 12px; color: rgba(0,0,0,0.5); }
    .hint { padding: 32px; text-align: center; color: rgba(0,0,0,0.5); }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: rgba(0,0,0,0.6); border-bottom: 2px solid #e2e8f0; }
    td { padding: 6px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr:hover td { background: #f8fafc; }

    .mono { font-family: monospace; font-size: 11px; }
    .meta { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(0,0,0,0.5); }

    .pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; background: #e2e8f0; color: #475569; }
    .pill.type-remote { background: #ede9fe; color: #5b21b6; }
    .pill.type-host { background: #dbeafe; color: #1d4ed8; }
    .pill.type-gate { background: #dcfce7; color: #166534; }
    .pill.action-created { background: #dcfce7; color: #166534; }
    .pill.action-updated { background: #dbeafe; color: #1d4ed8; }
    .pill.action-deleted { background: #fee2e2; color: #991b1b; }
    .pill.action-toggled { background: #fef3c7; color: #92400e; }
    .pill.action-bulk_toggled { background: #fef3c7; color: #92400e; }
    .pill.action-rollback { background: #ede9fe; color: #5b21b6; }
  `],
})
export class AuditComponent implements OnInit {
  private readonly manager = inject(ManagerService);

  readonly loading = signal(false);
  readonly entries = signal<AuditEntry[]>([]);
  readonly total = signal(0);

  filterEntityType = '';
  filterAction = '';
  filterLimit = 100;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.manager.getAuditLog({
      entityType: this.filterEntityType || undefined,
      action: this.filterAction || undefined,
      limit: this.filterLimit,
    }).subscribe({
      next: (res) => {
        this.entries.set(res.entries);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
