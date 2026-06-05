import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ManagerService } from '../services/manager.service';
import type { Host, Gate, HostRemote } from '../../types/platform';

@Component({
  selector: 'app-host-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page">
      <header>
        <a mat-button routerLink="/hosts"><mat-icon>arrow_back</mat-icon> Back to hosts</a>
        <h1>{{ host()?.name ?? 'Loading…' }}</h1>
      </header>

      @if (host(); as h) {
        <section class="meta-card">
          <mat-card>
            <mat-card-header>
              <mat-card-title>Host details</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <dl class="meta-grid">
                <dt>Name</dt><dd>{{ h.name }}</dd>
                <dt>URL</dt><dd><code>{{ h.url }}</code></dd>
                <dt>Framework</dt>
                <dd><span class="fw-badge" [class]="'fw-' + h.framework">{{ h.framework }}</span></dd>
                <dt>Remote entry</dt><dd><code>{{ h.remoteEntry }}</code></dd>
                <dt>Exposed module</dt><dd><code>{{ h.exposedModule }}</code></dd>
                <dt>Status</dt><dd>{{ h.enabled ? 'Enabled' : 'Disabled' }}</dd>
                <dt>Created</dt><dd>{{ h.createdAt | date: 'medium' }}</dd>
                <dt>Updated</dt><dd>{{ h.updatedAt | date: 'medium' }}</dd>
              </dl>
            </mat-card-content>
          </mat-card>
        </section>

        <section class="section">
          <h2>Gates <span class="count">({{ gates().length }})</span></h2>
          @if (gates().length > 0) {
            <table mat-table [dataSource]="gates()">
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
              <ng-container matColumnDef="enabled">
                <th mat-header-cell *matHeaderCellDef>Enabled</th>
                <td mat-cell *matCellDef="let g">{{ g.enabled ? 'Yes' : 'No' }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="gateColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: gateColumns"></tr>
            </table>
          } @else {
            <p class="empty">No gates point to this host.</p>
          }
        </section>

        <section class="section">
          <h2>Visible remotes <span class="count">({{ remotes().length }})</span></h2>
          @if (remotes().length > 0) {
            <table mat-table [dataSource]="remotes()">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let r"><strong>{{ r.name }}</strong></td>
              </ng-container>
              <ng-container matColumnDef="source">
                <th mat-header-cell *matHeaderCellDef>Source</th>
                <td mat-cell *matCellDef="let r">
                  <span class="source-badge" [class]="'source-' + r.source">{{ r.source }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="route">
                <th mat-header-cell *matHeaderCellDef>Route</th>
                <td mat-cell *matCellDef="let r"><code>/{{ r.routePath }}</code></td>
              </ng-container>
              <ng-container matColumnDef="enabled">
                <th mat-header-cell *matHeaderCellDef>Enabled</th>
                <td mat-cell *matCellDef="let r">{{ r.enabled ? 'Yes' : 'No' }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="remoteColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: remoteColumns"></tr>
            </table>
          } @else {
            <p class="empty">No remotes visible to this host.</p>
          }
        </section>
      } @else {
        <p>Loading…</p>
      }
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 1080px; margin: 0 auto; }
      header { margin-bottom: 16px; }
      header h1 { margin: 8px 0 0; font-size: 24px; }
      .meta-card { margin-bottom: 32px; }
      .meta-grid { display: grid; grid-template-columns: 140px 1fr; gap: 4px 16px; margin: 0; }
      .meta-grid dt { color: rgba(0,0,0,0.6); font-size: 13px; font-weight: 500; }
      .meta-grid dd { margin: 0; font-size: 13px; }
      code { font-family: monospace; font-size: 12px; color: rgba(0,0,0,0.7); }
      .section { margin-bottom: 32px; }
      .section h2 { font-size: 16px; font-weight: 600; margin: 0 0 12px; }
      .count { font-weight: 400; color: rgba(0,0,0,0.5); }
      table { width: 100%; background: white; }
      .empty { color: rgba(0,0,0,0.5); font-size: 13px; }
      .domain-link { color: #1d4ed8; }
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
      .source-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
      }
      .source-global { background: #f1f5f9; color: #475569; }
      .source-host-specific { background: #ede9fe; color: #4c1d95; }
    `,
  ],
})
export class HostDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly manager = inject(ManagerService);

  readonly gateColumns = ['name', 'domain', 'enabled'];
  readonly remoteColumns = ['name', 'source', 'route', 'enabled'];

  readonly host = signal<Host | null>(null);
  readonly gates = signal<Gate[]>([]);
  readonly remotes = signal<HostRemote[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/hosts']);
      return;
    }

    this.manager.getHost(id).subscribe({
      next: (h) => {
        this.host.set(h);
        this.loadGates(id);
        this.loadRemotes(id);
      },
      error: () => this.router.navigate(['/hosts']),
    });
  }

  private loadGates(hostId: string): void {
    this.manager.getGates().subscribe({
      next: (gates) => this.gates.set(gates.filter((g) => g.hostId === hostId)),
    });
  }

  private loadRemotes(hostId: string): void {
    this.manager.getHostRemotes(hostId).subscribe({
      next: (remotes) => this.remotes.set(remotes),
    });
  }
}
