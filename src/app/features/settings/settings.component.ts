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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SettingsService, SETTINGS_DEFAULTS } from '../services/settings.service';
import { RegistryWsService } from '../services/registry-ws.service';
import { ThemeService } from '../services/theme.service';
import { NxBadgeComponent, NxLiveIndicatorComponent } from '../../design-system';
import type { LiveStatus } from '../../design-system';

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    NxBadgeComponent,
    NxLiveIndicatorComponent,
  ],
  template: `
    <div class="nx-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">Portal configuration — changes take effect immediately</p>
        </div>
        @if (settings.isModified()) {
          <nx-badge variant="yellow">Modified from defaults</nx-badge>
        }
      </div>

      <!-- Registry connection status card -->
      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>Registry Connection</mat-card-title>
          <mat-card-subtitle>Live status of the WebSocket channel to the registry</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="status-row">
            <nx-live-indicator [status]="wsLiveStatus()" [label]="wsLabel()" />
            <span class="status-url">{{ settings.registryUrl() }}</span>
            @if (wsState() === 'disconnected') {
              <span class="status-hint">Check registry URL and token below — WebSocket reconnects automatically on save.</span>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Connection settings -->
      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>Connection</mat-card-title>
          <mat-card-subtitle>Base URL for all registry API calls</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="connForm" class="settings-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Registry URL</mat-label>
              <input matInput formControlName="registryUrl" placeholder="/api" />
              <mat-hint>
                Use a relative path (e.g. <code>/api</code>) or an absolute URL
                (e.g. <code>http://localhost:8670/api</code>)
              </mat-hint>
              @if (connForm.controls.registryUrl.hasError('required')) {
                <mat-error>Registry URL is required</mat-error>
              }
            </mat-form-field>

            <div class="form-actions">
              <button
                mat-stroked-button
                type="button"
                [disabled]="testStatus() === 'testing'"
                (click)="testConnection()"
              >
                @if (testStatus() === 'testing') {
                  <mat-icon>hourglass_empty</mat-icon> Testing…
                } @else {
                  <mat-icon>network_check</mat-icon> Test connection
                }
              </button>
              @if (testStatus() === 'ok') {
                <nx-badge variant="ok">Reachable</nx-badge>
              }
              @if (testStatus() === 'error') {
                <nx-badge variant="down">Unreachable</nx-badge>
              }
              <span class="spacer"></span>
              <button
                mat-raised-button
                color="primary"
                type="button"
                [disabled]="connForm.invalid"
                (click)="saveConnection()"
              >Save</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Authentication settings -->
      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>Authentication</mat-card-title>
          <mat-card-subtitle>Token sent as X-Nexus-Token on every registry request</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="authForm" class="settings-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nexus Token</mat-label>
              <input
                matInput
                formControlName="nexusToken"
                [type]="showToken() ? 'text' : 'password'"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                [matTooltip]="showToken() ? 'Hide token' : 'Show token'"
                (click)="showToken.set(!showToken())"
              >
                <mat-icon>{{ showToken() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (authForm.controls.nexusToken.hasError('required')) {
                <mat-error>Token is required</mat-error>
              }
            </mat-form-field>
            <div class="form-actions">
              <span class="spacer"></span>
              <button
                mat-raised-button
                color="primary"
                type="button"
                [disabled]="authForm.invalid"
                (click)="saveAuth()"
              >Save</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Appearance -->
      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>Appearance</mat-card-title>
          <mat-card-subtitle>Visual theme — also toggled from the toolbar</mat-card-subtitle>
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

      <!-- Danger zone -->
      <mat-card class="section-card danger-card">
        <mat-card-header>
          <mat-card-title>Reset</mat-card-title>
          <mat-card-subtitle>Restore all settings to their built-in defaults</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="danger-row">
            <div class="danger-info">
              <span class="default-label">Default registry URL</span>
              <code class="default-value">{{ defaults.registryUrl }}</code>
            </div>
            <button mat-stroked-button color="warn" type="button" (click)="resetAll()">
              <mat-icon>restart_alt</mat-icon>
              Reset to defaults
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
    .settings-form { display: flex; flex-direction: column; gap: 16px; padding-top: 4px; }
    .full-width { width: 100%; max-width: 480px; }
    .form-actions { display: flex; align-items: center; gap: 12px; }
    .spacer { flex: 1; }
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
    .theme-row { display: flex; align-items: center; gap: 16px; padding: 8px 0; }
    .theme-label { font-size: 13px; color: var(--text-secondary); }
    .danger-card { border: 1px solid var(--color-danger, #f44336); }
    .danger-row { display: flex; align-items: center; gap: 16px; padding: 8px 0; }
    .danger-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
    .default-label { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.4px; }
    .default-value { font-family: var(--font-mono); font-size: 13px; color: var(--text-primary); }
  `],
})
export class SettingsComponent implements OnInit {
  readonly settings = inject(SettingsService);
  readonly theme = inject(ThemeService);
  private readonly ws = inject(RegistryWsService);
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly defaults = SETTINGS_DEFAULTS;
  readonly testStatus = signal<TestStatus>('idle');
  readonly showToken = signal(false);
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

  readonly connForm = new FormGroup({
    registryUrl: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  readonly authForm = new FormGroup({
    nexusToken: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  ngOnInit(): void {
    this.connForm.setValue({ registryUrl: this.settings.registryUrl() });
    this.authForm.setValue({ nexusToken: this.settings.nexusToken() });
  }

  testConnection(): void {
    const url = this.connForm.controls.registryUrl.value.trim();
    if (!url) return;
    this.testStatus.set('testing');
    this.http
      .get(`${url}/system/health`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.testStatus.set('ok'),
        error: () => this.testStatus.set('error'),
      });
  }

  saveConnection(): void {
    if (this.connForm.invalid) return;
    this.settings.update({ registryUrl: this.connForm.controls.registryUrl.value.trim() });
    this.testStatus.set('idle');
    this.snack.open('Registry URL saved', 'OK', { duration: 3000, panelClass: ['success-snack'] });
  }

  saveAuth(): void {
    if (this.authForm.invalid) return;
    this.settings.update({ nexusToken: this.authForm.controls.nexusToken.value.trim() });
    this.snack.open('Token saved', 'OK', { duration: 3000, panelClass: ['success-snack'] });
  }

  resetAll(): void {
    this.settings.reset();
    this.connForm.setValue({ registryUrl: this.settings.registryUrl() });
    this.authForm.setValue({ nexusToken: this.settings.nexusToken() });
    this.testStatus.set('idle');
    this.snack.open('Settings reset to defaults', 'OK', { duration: 3000, panelClass: ['success-snack'] });
  }
}
