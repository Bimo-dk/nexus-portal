import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ManagerService } from '../services/manager.service';
import { HostEventService } from '../services/host-event.service';
import { HostFormDialogComponent } from './host-form-dialog.component';
import { ConfirmDialogComponent } from '../remotes/confirm-dialog.component';
import type { Host } from '../../types/platform';

@Component({
  selector: 'app-host-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  template: `
    <div class="page">
      <header>
        <h1>Hosts</h1>
        <button mat-raised-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon>
          Add host
        </button>
      </header>

      <table mat-table [dataSource]="hosts()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let h">
            <a class="host-link" [href]="'/hosts/' + h.id" (click)="navDetail($event, h)">
              <strong>{{ h.name }}</strong>
            </a>
          </td>
        </ng-container>

        <ng-container matColumnDef="framework">
          <th mat-header-cell *matHeaderCellDef>Framework</th>
          <td mat-cell *matCellDef="let h">
            <span class="fw-badge" [class]="'fw-' + h.framework">{{ h.framework }}</span>
          </td>
        </ng-container>

        <ng-container matColumnDef="url">
          <th mat-header-cell *matHeaderCellDef>URL</th>
          <td mat-cell *matCellDef="let h"><code>{{ h.url }}</code></td>
        </ng-container>

        <ng-container matColumnDef="gateCount">
          <th mat-header-cell *matHeaderCellDef>Gates</th>
          <td mat-cell *matCellDef="let h">
            <button
              mat-button
              class="gate-count-btn"
              (click)="navGatesFor(h)"
              [matTooltip]="'View gates for ' + h.name"
            >
              {{ h.gateCount }}
            </button>
          </td>
        </ng-container>

        <ng-container matColumnDef="enabled">
          <th mat-header-cell *matHeaderCellDef>Enabled</th>
          <td mat-cell *matCellDef="let h">
            <mat-slide-toggle [checked]="h.enabled" (change)="onToggle(h)" />
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Actions</th>
          <td mat-cell *matCellDef="let h" class="actions-cell">
            <button mat-icon-button matTooltip="Edit" (click)="openEdit(h)">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button matTooltip="Delete" color="warn" (click)="onDelete(h)">
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayed"></tr>
        <tr
          mat-row
          *matRowDef="let row; columns: displayed"
          [class.row-flash]="flashing().has(row.id)"
        ></tr>
      </table>

      @if (hosts().length === 0) {
        <p class="empty">No hosts registered. Add one with the button above.</p>
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
      .host-link { text-decoration: none; color: inherit; }
      .host-link:hover strong { text-decoration: underline; }
      .gate-count-btn { min-width: 0; padding: 0 8px; font-weight: 600; }
      .fw-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        text-transform: capitalize;
      }
      .fw-angular { background: #fee2e2; color: #b91c1c; }
      .fw-vue { background: #dcfce7; color: #14532d; }
      .fw-react { background: #dbeafe; color: #1e40af; }
      @keyframes row-flash {
        0% { background: #fef9c3; }
        100% { background: transparent; }
      }
      .row-flash { animation: row-flash 600ms ease-out; }
    `,
  ],
})
export class HostListComponent implements OnInit {
  private readonly manager = inject(ManagerService);
  private readonly events = inject(HostEventService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly displayed = ['name', 'framework', 'url', 'gateCount', 'enabled', 'actions'];
  readonly hosts = signal<Host[]>([]);
  readonly flashing = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.refresh();

    this.events.hostChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((host) => {
        this.hosts.update((list) => {
          const idx = list.findIndex((h) => h.id === host.id);
          if (idx >= 0) {
            const updated = [...list];
            updated[idx] = host;
            return updated;
          }
          return [...list, host];
        });
        this.flash(host.id);
        this.snack.open(`Host "${host.name}" was updated externally`, 'OK', {
          duration: 4000,
          panelClass: ['info-snack'],
        });
      });
  }

  openCreate(): void {
    this.dialog
      .open(HostFormDialogComponent, { data: {} })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.refresh();
      });
  }

  openEdit(host: Host): void {
    this.dialog
      .open(HostFormDialogComponent, { data: { host } })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.refresh();
      });
  }

  onToggle(host: Host): void {
    this.manager.toggleHost(host.id).subscribe({
      next: () => this.refresh(),
      error: () => this.refresh(),
    });
  }

  onDelete(host: Host): void {
    const hasGates = (host.gateCount ?? 0) > 0;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Delete "${host.name}"?`,
          message: hasGates
            ? `Host "${host.name}" has ${host.gateCount} gate(s) pointing to it. Remove all gates before deleting this host.`
            : `Host "${host.name}" will be removed permanently.`,
          confirmLabel: 'Delete',
          disableConfirm: hasGates,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.manager.deleteHost(host.id).subscribe({ next: () => this.refresh() });
        }
      });
  }

  navDetail(event: MouseEvent, host: Host): void {
    event.preventDefault();
    this.router.navigate(['/hosts', host.id]);
  }

  navGatesFor(host: Host): void {
    this.router.navigate(['/gates'], { queryParams: { host_id: host.id } });
  }

  private refresh(): void {
    this.manager.getHosts().subscribe({
      next: (list) => this.hosts.set(list),
    });
  }

  private flash(id: string): void {
    this.flashing.update((s) => new Set([...s, id]));
    setTimeout(() => {
      this.flashing.update((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, 700);
  }
}
