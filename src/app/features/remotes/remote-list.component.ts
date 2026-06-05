import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ManagerService } from '../services/manager.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import type { RemoteHealthStatus } from '@bimo-dk/nexus-core';
import type { Host, PortalRemoteConfig } from '../../types/platform';

@Component({
  selector: 'app-remote-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatTableModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    MatSelectModule,
    MatFormFieldModule,
    RouterLink,
    UpperCasePipe,
  ],
  template: `
    <div class="page">
      <header>
        <h1>Remotes</h1>
        <a mat-raised-button color="primary" routerLink="/remotes/new">
          <mat-icon>add</mat-icon>
          Add remote
        </a>
      </header>

      <div class="toolbar">
        <mat-form-field appearance="outline" class="host-filter">
          <mat-label>Filter by host</mat-label>
          <mat-select [(ngModel)]="selectedHostId" (ngModelChange)="onHostFilter()">
            <mat-option value="">All remotes</mat-option>
            @for (h of hosts(); track h.id) {
              <mat-option [value]="h.id">{{ h.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <table mat-table [dataSource]="remotes()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let r">
            <a [routerLink]="['/remotes', r.name]"><strong>{{ r.name }}</strong></a>
          </td>
        </ng-container>

        <ng-container matColumnDef="url">
          <th mat-header-cell *matHeaderCellDef>URL</th>
          <td mat-cell *matCellDef="let r"><code>{{ r.url }}</code></td>
        </ng-container>

        <ng-container matColumnDef="route">
          <th mat-header-cell *matHeaderCellDef>Route</th>
          <td mat-cell *matCellDef="let r"><code>/{{ r.routePath }}</code></td>
        </ng-container>

        <ng-container matColumnDef="visibility">
          <th mat-header-cell *matHeaderCellDef>Visibility</th>
          <td mat-cell *matCellDef="let r">
            <span class="vis-badge" [class]="visibilityClass(r)">{{ visibilityLabel(r) }}</span>
          </td>
        </ng-container>

        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let r">
            <span class="status-pill" [class]="statusFor(r.name)">
              <span class="dot"></span>
              {{ (statusFor(r.name) | uppercase) }}
            </span>
          </td>
        </ng-container>

        <ng-container matColumnDef="enabled">
          <th mat-header-cell *matHeaderCellDef>Enabled</th>
          <td mat-cell *matCellDef="let r">
            <mat-slide-toggle [checked]="r.enabled" (change)="onToggle(r)" />
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Actions</th>
          <td mat-cell *matCellDef="let r" class="actions-cell">
            <button mat-icon-button matTooltip="Health check" (click)="checkHealth(r)">
              <mat-icon>monitor_heart</mat-icon>
            </button>
            <a mat-icon-button matTooltip="Edit" [routerLink]="['/remotes', r.name]">
              <mat-icon>edit</mat-icon>
            </a>
            <button mat-icon-button matTooltip="Delete" color="warn" (click)="onDelete(r)">
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayed"></tr>
        <tr mat-row *matRowDef="let row; columns: displayed"></tr>
      </table>

      @if (remotes().length === 0) {
        <p class="empty">No remotes. Add one with the button above.</p>
      }
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 1280px; margin: 0 auto; }
      header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      header h1 { margin: 0; font-size: 24px; }
      .toolbar { margin-bottom: 16px; }
      .host-filter { min-width: 240px; }
      table { width: 100%; background: white; }
      code { font-family: monospace; font-size: 12px; color: rgba(0,0,0,0.7); }
      .actions-cell { white-space: nowrap; }
      .empty { padding: 32px; text-align: center; color: rgba(0,0,0,0.6); }
      .vis-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
      }
      .vis-global { background: #f1f5f9; color: #475569; }
      .vis-host { background: #ede9fe; color: #4c1d95; }
    `,
  ],
})
export class RemoteListComponent implements OnInit {
  private readonly manager = inject(ManagerService);
  private readonly dialog = inject(MatDialog);

  readonly displayed = ['name', 'url', 'route', 'visibility', 'status', 'enabled', 'actions'];
  readonly remotes = signal<PortalRemoteConfig[]>([]);
  readonly hosts = signal<Host[]>([]);
  readonly healthMap = signal<Map<string, RemoteHealthStatus>>(new Map());

  selectedHostId = '';

  ngOnInit(): void {
    this.refresh();
    this.manager.getHosts().subscribe({ next: (list) => this.hosts.set(list) });
  }

  statusFor(name: string): RemoteHealthStatus {
    return this.healthMap().get(name) ?? 'unknown';
  }

  visibilityClass(r: PortalRemoteConfig): string {
    return r.visibility && r.visibility !== 'global' ? 'vis-host' : 'vis-global';
  }

  visibilityLabel(r: PortalRemoteConfig): string {
    if (!r.visibility || r.visibility === 'global') return 'global';
    const hostId = r.visibility.slice('host:'.length);
    const host = this.hosts().find((h) => h.id === hostId);
    return host ? host.name : r.visibility;
  }

  onHostFilter(): void {
    this.refresh();
  }

  onToggle(remote: PortalRemoteConfig): void {
    this.manager.toggleRemote(remote.name).subscribe({
      next: () => this.refresh(),
      error: () => this.refresh(),
    });
  }

  onDelete(remote: PortalRemoteConfig): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Delete "${remote.name}"?`,
        message: `Remote "${remote.name}" will be removed permanently from the registry. The host will deregister the route /${remote.routePath} on the next poll.`,
        confirmLabel: 'Delete',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.manager.deleteRemote(remote.name).subscribe({ next: () => this.refresh() });
      }
    });
  }

  checkHealth(remote: PortalRemoteConfig): void {
    this.manager.checkHealth(remote.url).subscribe((res) => {
      this.healthMap.update((m) => {
        const next = new Map(m);
        next.set(remote.name, res.status);
        return next;
      });
    });
  }

  private refresh(): void {
    const hostId = this.selectedHostId || undefined;
    this.manager.getRemotes(hostId).subscribe({
      next: (res) => {
        this.remotes.set(res.remotes);
        this.refreshAllHealth(res.remotes);
      },
    });
  }

  private refreshAllHealth(remotes: PortalRemoteConfig[]): void {
    for (const r of remotes) {
      this.manager.checkHealth(r.url).subscribe({
        next: (res) => {
          this.healthMap.update((m) => {
            const next = new Map(m);
            next.set(r.name, res.status);
            return next;
          });
        },
      });
    }
  }
}
