import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { SettingsService } from '../services/settings.service';
import { RegistryWsService } from '../services/registry-ws.service';
import { ThemeService } from '../services/theme.service';
import { NxBadgeComponent, NxLiveIndicatorComponent } from '../../design-system';
import type { LiveStatus } from '../../design-system';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    NxBadgeComponent,
    NxLiveIndicatorComponent,
  ],
  template: `
    <div class="nx-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">Portal status and appearance</p>
        </div>
      </div>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>Registry Connection</mat-card-title>
          <mat-card-subtitle>WebSocket status from the portal backend to the registry</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="status-row">
            <nx-live-indicator [status]="wsLiveStatus()" [label]="wsLabel()" />
            <span class="status-url">{{ settings.registryUrl() }}</span>
            @if (wsState() === 'disconnected') {
              <span class="status-hint">Backend cannot reach the registry. Reconnects automatically.</span>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>Authentication</mat-card-title>
          <mat-card-subtitle>Registry credentials are managed by the portal backend</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="info-row">
            <nx-badge variant="ok">Server-side token</nx-badge>
            <span class="hint">The registry token is held in the portal backend's environment and is never sent to the browser. Rotate it by updating the NEXUS_TOKEN env-var and restarting the portal container.</span>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>Appearance</mat-card-title>
          <mat-card-subtitle>Visual theme &mdash; also toggled from the toolbar</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="theme-row">
            <span class="theme-label">Current theme</span>
            <nx-badge [variant]="theme.current === 'dark' ? 'blue' : 'gray'">
              {{ theme.current === 'dark' ? 'Dark' : 'Light' }}
            </nx-badge>
            <button mat-stroked-button type="button" (click)="theme.toggle()">
              <mat-icon>{{ theme.current === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
              Switch to {{ theme.current === 'dark' ? 'light' : 'dark' }} mode
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
    .page-title { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
    .page-subtitle { margin: 0; font-size: 13px; color: var(--text-secondary); }
    .section-card { margin-bottom: 20px; }
    .status-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 0;
      flex-wrap: wrap;
    }
    .status-url {
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--text-secondary);
      background: var(--color-surface-raised);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .status-hint { font-size: 12px; color: var(--text-tertiary); }
    .info-row { display: flex; align-items: center; gap: 16px; padding: 8px 0; flex-wrap: wrap; }
    .hint { font-size: 13px; color: var(--text-secondary); max-width: 640px; }
    .theme-row { display: flex; align-items: center; gap: 16px; padding: 8px 0; }
    .theme-label { font-size: 13px; color: var(--text-secondary); }
  `],
})
export class SettingsComponent {
  readonly settings = inject(SettingsService);
  readonly theme = inject(ThemeService);
  private readonly ws = inject(RegistryWsService);

  readonly wsState = this.ws.connectionState;

  readonly wsLiveStatus = computed((): LiveStatus => {
    switch (this.ws.connectionState()) {
      case 'connected': return 'ok';
      case 'connecting': return 'warn';
      case 'disconnected': return 'down';
    }
  });

  readonly wsLabel = computed(() => {
    switch (this.ws.connectionState()) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting…';
      case 'disconnected': return 'Disconnected';
    }
  });
}
