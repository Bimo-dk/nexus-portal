import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UpperCasePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ManagerService } from '../services/manager.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import type { RemoteConfig, RemoteHealthStatus } from '../../types/remote-config';

@Component({
  selector: 'app-remote-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
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

      <table mat-table [dataSource]="remotes()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Navn</th>
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
          <th mat-header-cell *matHeaderCellDef>Handlinger</th>
          <td mat-cell *matCellDef="let r" class="actions-cell">
            <button mat-icon-button matTooltip="Health-check" (click)="checkHealth(r)">
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
        <p class="empty">Ingen remotes. Tilføj én med knappen ovenfor.</p>
      }
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 1280px; margin: 0 auto; }
      header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
      header h1 { margin: 0; font-size: 24px; }
      table { width: 100%; background: white; }
      code { font-family: monospace; font-size: 12px; color: rgba(0,0,0,0.7); }
      .actions-cell { white-space: nowrap; }
      .empty { padding: 32px; text-align: center; color: rgba(0,0,0,0.6); }
    `,
  ],
})
export class RemoteListComponent implements OnInit {
  private readonly manager = inject(ManagerService);
  private readonly dialog = inject(MatDialog);

  readonly displayed = ['name', 'url', 'route', 'status', 'enabled', 'actions'];
  readonly remotes = signal<RemoteConfig[]>([]);
  readonly healthMap = signal<Map<string, RemoteHealthStatus>>(new Map());

  ngOnInit(): void {
    this.refresh();
  }

  statusFor(name: string): RemoteHealthStatus {
    return this.healthMap().get(name) ?? 'unknown';
  }

  onToggle(remote: RemoteConfig): void {
    this.manager.toggleRemote(remote.name).subscribe({
      next: () => this.refresh(),
      error: () => this.refresh(),
    });
  }

  onDelete(remote: RemoteConfig): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Slet "${remote.name}"?`,
        message: `Remote "${remote.name}" fjernes permanent fra registry. Host vil afregistrere ruten /${remote.routePath} ved næste polling.`,
        confirmLabel: 'Slet',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.manager.deleteRemote(remote.name).subscribe({ next: () => this.refresh() });
      }
    });
  }

  checkHealth(remote: RemoteConfig): void {
    this.manager.checkHealth(remote.url).subscribe((res) => {
      this.healthMap.update((m) => {
        const next = new Map(m);
        next.set(remote.name, res.status);
        return next;
      });
    });
  }

  private refresh(): void {
    this.manager.getRemotes().subscribe({
      next: (res) => {
        this.remotes.set(res.remotes);
        this.refreshAllHealth(res.remotes);
      },
    });
  }

  private refreshAllHealth(remotes: RemoteConfig[]): void {
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
