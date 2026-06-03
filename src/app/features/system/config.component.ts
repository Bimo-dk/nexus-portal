import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ManagerService } from '../services/manager.service';
import type { RegistryConfig } from '../../types/observability';

@Component({
  selector: 'app-system-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatCardModule, MatIconModule],
  template: `
    <div class="page">
      <header>
        <h1>Configuration</h1>
        <p>Effective registry configuration (read-only — derived from environment variables).</p>
      </header>

      @if (config(); as c) {
        <mat-card>
          <mat-card-header>
            <mat-icon mat-card-avatar>settings</mat-icon>
            <mat-card-title>Runtime</mat-card-title>
            <mat-card-subtitle>{{ c.nodeEnv }} · uptime {{ formatUptime(c.uptimeSec) }} · Node {{ c.nodeVersion }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <dl>
              <dt>HTTP port</dt>
              <dd>{{ c.port }}</dd>
              <dt>Health-check interval</dt>
              <dd>{{ c.healthCheckIntervalMs | number }} ms</dd>
              <dt>Log buffer capacity</dt>
              <dd>{{ c.logBufferCapacity | number }} entries</dd>
              <dt>WebSocket clients</dt>
              <dd>{{ c.wsClients }}</dd>
              <dt>NEXUS_TOKEN</dt>
              <dd>{{ c.nexusTokenConfigured ? 'configured' : '⚠ not set' }}</dd>
            </dl>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-icon mat-card-avatar>policy</mat-icon>
            <mat-card-title>Allowed origins (CORS)</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <ul class="list">
              @for (o of c.allowedOrigins; track o) {
                <li><code>{{ o }}</code></li>
              } @empty {
                <li class="muted">(none)</li>
              }
            </ul>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-icon mat-card-avatar>hub</mat-icon>
            <mat-card-title>System services (health-checked)</mat-card-title>
            <mat-card-subtitle>From SYSTEM_SERVICES env-var</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <ul class="list">
              @for (s of c.systemServices; track s) {
                <li><code>{{ s }}</code></li>
              } @empty {
                <li class="muted">(none configured)</li>
              }
            </ul>
          </mat-card-content>
        </mat-card>

        <mat-card class="info">
          <mat-card-content>
            <p><strong>To change values:</strong> update the registry container's environment variables and restart. Most settings are immutable at runtime by design.</p>
          </mat-card-content>
        </mat-card>
      } @else if (error()) {
        <mat-card>
          <mat-card-content>
            <p><strong>Error:</strong> {{ error() }}</p>
          </mat-card-content>
        </mat-card>
      } @else {
        <p>Loading...</p>
      }
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 960px; margin: 0 auto; }
      header { margin-bottom: 24px; }
      header h1 { margin: 0 0 4px; font-size: 24px; }
      header p { margin: 0; color: rgba(0,0,0,0.6); font-size: 13px; }
      mat-card { margin-bottom: 16px; }
      mat-icon[mat-card-avatar] { color: rgba(0,0,0,0.6); }
      dl { display: grid; grid-template-columns: 200px 1fr; gap: 8px 16px; margin: 0; font-size: 14px; }
      dt { color: rgba(0,0,0,0.6); font-weight: 500; }
      dd { margin: 0; font-family: monospace; color: rgba(0,0,0,0.85); }
      .list { list-style: none; padding: 0; margin: 0; }
      .list li { padding: 4px 0; }
      code { background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 13px; }
      .muted { color: rgba(0,0,0,0.5); font-style: italic; }
      .info { background: #eff6ff; }
      .info p { margin: 0; font-size: 13px; color: #1e40af; }
    `,
  ],
})
export class ConfigComponent implements OnInit {
  private readonly manager = inject(ManagerService);

  readonly config = signal<RegistryConfig | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.manager.getRegistryConfig().subscribe({
      next: (c) => this.config.set(c),
      error: (err: unknown) => this.error.set(err instanceof Error ? err.message : String(err)),
    });
  }

  formatUptime(sec: number): string {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    if (sec < 86_400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
    return `${Math.floor(sec / 86_400)}d ${Math.floor((sec % 86_400) / 3600)}h`;
  }
}
