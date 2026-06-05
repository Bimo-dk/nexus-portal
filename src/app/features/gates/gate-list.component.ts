import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { ManagerService } from '../services/manager.service';
import { HostEventService } from '../services/host-event.service';
import { GateFormDialogComponent } from './gate-form-dialog.component';
import { ConfirmDialogComponent } from '../remotes/confirm-dialog.component';
import type { Gate, Host } from '../../types/platform';

@Component({
  selector: 'app-gate-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatTableModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDialogModule,
  ],
  template: `
    <div class="page">
      <header>
        <h1>Gates</h1>
        <button mat-raised-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon>
          Add gate
        </button>
      </header>

      <div class="toolbar">
        <mat-form-field appearance="outline" class="host-filter">
          <mat-label>Filter by host</mat-label>
          <mat-select [(ngModel)]="selectedHostId" (ngModelChange)="onHostFilter()">
            <mat-option value="">All hosts</mat-option>
            @for (h of hosts(); track h.id) {
              <mat-option [value]="h.id">{{ h.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <table mat-table [dataSource]="filteredGates()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let g"><strong>{{ g.name }}</strong></td>
        </ng-container>

        <ng-container matColumnDef="domain">
          <th mat-header-cell *matHeaderCellDef>Domain</th>
          <td mat-cell *matCellDef="let g">
            <a [href]="'//' + g.domain" target="_blank" rel="noopener" class="domain-link">
              {{ g.domain }}
            </a>
          </td>
        </ng-container>

        <ng-container matColumnDef="host">
          <th mat-header-cell *matHeaderCellDef>Host</th>
          <td mat-cell *matCellDef="let g" [class.host-col-flash]="flashingHostCol().has(g.id)">
            <span class="fw-badge" [class]="'fw-' + g.host.framework">{{ g.host.framework }}</span>
            {{ g.host.name }}
          </td>
        </ng-container>

        <ng-container matColumnDef="enabled">
          <th mat-header-cell *matHeaderCellDef>Enabled</th>
          <td mat-cell *matCellDef="let g">
            <mat-slide-toggle [checked]="g.enabled" (change)="onToggle(g)" />
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Actions</th>
          <td mat-cell *matCellDef="let g" class="actions-cell">
            <button mat-icon-button matTooltip="Edit" (click)="openEdit(g)">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button matTooltip="Delete" color="warn" (click)="onDelete(g)">
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayed"></tr>
        <tr mat-row *matRowDef="let row; columns: displayed"></tr>
      </table>

      @if (filteredGates().length === 0) {
        <p class="empty">No gates found.</p>
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
      .actions-cell { white-space: nowrap; }
      .empty { padding: 32px; text-align: center; color: rgba(0,0,0,0.6); }
      .domain-link { color: #1d4ed8; }
      .fw-badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        text-transform: capitalize;
        margin-right: 6px;
      }
      .fw-angular { background: #fee2e2; color: #b91c1c; }
      .fw-vue { background: #dcfce7; color: #14532d; }
      .fw-react { background: #dbeafe; color: #1e40af; }
      @keyframes host-col-flash {
        0% { background: #fef3c7; }
        100% { background: transparent; }
      }
      .host-col-flash { animation: host-col-flash 600ms ease-out; }
    `,
  ],
})
export class GateListComponent implements OnInit {
  private readonly manager = inject(ManagerService);
  private readonly events = inject(HostEventService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly displayed = ['name', 'domain', 'host', 'enabled', 'actions'];
  readonly gates = signal<Gate[]>([]);
  readonly hosts = signal<Host[]>([]);
  readonly flashingHostCol = signal<Set<string>>(new Set());

  private readonly _selectedHostId = signal('');
  get selectedHostId(): string { return this._selectedHostId(); }
  set selectedHostId(v: string) { this._selectedHostId.set(v); }

  readonly filteredGates = computed(() => {
    const id = this._selectedHostId();
    return id ? this.gates().filter((g) => g.hostId === id) : this.gates();
  });

  ngOnInit(): void {
    const queryHostId = this.route.snapshot.queryParamMap.get('host_id') ?? '';
    this.selectedHostId = queryHostId;

    this.refresh();
    this.manager.getHosts().subscribe({ next: (list) => this.hosts.set(list) });

    this.events.gateChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const { gate, trigger, oldHostId, newHostId } = event;
        this.gates.update((list) => {
          const idx = list.findIndex((g) => g.id === gate.id);
          if (idx >= 0) {
            const updated = [...list];
            updated[idx] = gate;
            return updated;
          }
          return [...list, gate];
        });

        if (trigger === 'host_reassigned' && oldHostId && newHostId) {
          this.snack.open(
            `Gate "${gate.name}" was reassigned to a new host`,
            'OK',
            { duration: 5000, panelClass: ['warn-snack'] },
          );
          this.flashHostCol(gate.id);
        }
      });
  }

  openCreate(): void {
    this.dialog
      .open(GateFormDialogComponent, { data: { hosts: this.hosts() } })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.refresh();
      });
  }

  openEdit(gate: Gate): void {
    this.dialog
      .open(GateFormDialogComponent, { data: { gate, hosts: this.hosts() } })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.refresh();
      });
  }

  onToggle(gate: Gate): void {
    this.manager.toggleGate(gate.id).subscribe({
      next: () => this.refresh(),
      error: () => this.refresh(),
    });
  }

  onDelete(gate: Gate): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Delete "${gate.name}"?`,
          message: `Gate "${gate.name}" will be removed permanently.`,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.manager.deleteGate(gate.id).subscribe({ next: () => this.refresh() });
        }
      });
  }

  onHostFilter(): void {
    // filteredGates is computed from selectedHostId — no extra action needed
  }

  private refresh(): void {
    this.manager.getGates().subscribe({ next: (list) => this.gates.set(list) });
  }

  private flashHostCol(id: string): void {
    this.flashingHostCol.update((s) => new Set([...s, id]));
    setTimeout(() => {
      this.flashingHostCol.update((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, 700);
  }
}
