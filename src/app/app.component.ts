import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, of } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ManagerService } from './features/services/manager.service';
import { HostEventService } from './features/services/host-event.service';
import { ThemeService } from './features/services/theme.service';
import { ProtectionService } from './features/protection/protection.service';
import { RegistryWsService } from './features/services/registry-ws.service';
import { AuthService } from './features/auth/auth.service';
import { NxLiveIndicatorComponent } from './design-system';
import type { LiveStatus } from './design-system';
import type { Host, Gate } from './types/platform';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatBadgeModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    NxLiveIndicatorComponent,
  ],
  template: `
    @if (auth.user(); as user) {
      @if (chromeVisible()) {
        <mat-toolbar class="nx-toolbar">
          <mat-icon class="brand-icon">hub</mat-icon>
          <span class="brand">Nexus</span>
          <span class="spacer"></span>
          <nx-live-indicator
            [status]="registryLiveStatus()"
            [label]="wsStatus() === 'connected' ? 'Registry' : wsStatus() === 'connecting' ? 'Connecting…' : 'Disconnected'"
            [matTooltip]="'Registry: ' + wsStatus()"
          />
          <span class="spacer"></span>
          <button
            mat-icon-button
            (click)="theme.toggle()"
            [matTooltip]="currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <mat-icon>{{ currentTheme() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          <button mat-icon-button [matMenuTriggerFor]="userMenu" [matTooltip]="user.username">
            <mat-icon>account_circle</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <div class="user-menu-header">
              <div class="user-menu-name">{{ user.username }}</div>
              <div class="user-menu-role">{{ user.role }}</div>
            </div>
            <button mat-menu-item routerLink="/change-password">
              <mat-icon>lock_reset</mat-icon>
              <span>Change password</span>
            </button>
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Sign out</span>
            </button>
          </mat-menu>
        </mat-toolbar>

        <mat-sidenav-container class="container">
          <mat-sidenav mode="side" opened class="sidenav">
            <mat-nav-list>
              <a mat-list-item routerLink="/dashboard" routerLinkActive="active">
                <mat-icon matListItemIcon>dashboard</mat-icon>
                <span matListItemTitle>Dashboard</span>
              </a>

              @if (isAdmin()) {
                <div class="section-heading">Observability</div>

                <a mat-list-item routerLink="/system/health" routerLinkActive="active">
                  <mat-icon matListItemIcon>monitor_heart</mat-icon>
                  <span matListItemTitle>System health</span>
                </a>
                <a mat-list-item routerLink="/system/config" routerLinkActive="active">
                  <mat-icon matListItemIcon>settings</mat-icon>
                  <span matListItemTitle>Configuration</span>
                </a>
                <a mat-list-item routerLink="/system/logs" routerLinkActive="active">
                  <mat-icon matListItemIcon>article</mat-icon>
                  <span matListItemTitle>Logs</span>
                </a>
                <a mat-list-item routerLink="/system/metrics" routerLinkActive="active">
                  <mat-icon matListItemIcon>insights</mat-icon>
                  <span matListItemTitle>Metrics</span>
                </a>
              }

              <div class="section-heading">Remotes</div>

              <a mat-list-item routerLink="/remotes" routerLinkActive="active">
                <mat-icon matListItemIcon>cloud</mat-icon>
                <span matListItemTitle>Remotes</span>
              </a>
              @if (isAdmin()) {
                <a mat-list-item routerLink="/remotes/new" routerLinkActive="active">
                  <mat-icon matListItemIcon>add_circle</mat-icon>
                  <span matListItemTitle>Add remote</span>
                </a>
              }
              <a mat-list-item routerLink="/catalog" routerLinkActive="active">
                <mat-icon matListItemIcon>widgets</mat-icon>
                <span matListItemTitle>Component catalog</span>
              </a>

              @if (isAdmin()) {
                <div class="section-heading">Platform</div>

                <a mat-list-item routerLink="/hosts" routerLinkActive="active">
                  <mat-icon matListItemIcon>dns</mat-icon>
                  <span
                    matListItemTitle
                    [matBadge]="hostCount() || null"
                    matBadgeSize="small"
                    matBadgeColor="accent"
                  >Hosts</span>
                </a>
                <a mat-list-item routerLink="/gates" routerLinkActive="active">
                  <mat-icon matListItemIcon>device_hub</mat-icon>
                  <span
                    matListItemTitle
                    [matBadge]="gateCount() || null"
                    matBadgeSize="small"
                    matBadgeColor="accent"
                  >Gates</span>
                </a>

                <div class="section-heading">Security</div>

                <a mat-list-item routerLink="/protection" routerLinkActive="active">
                  <mat-icon matListItemIcon>security</mat-icon>
                  <span
                    matListItemTitle
                    [matBadge]="bannedCount() || null"
                    matBadgeSize="small"
                    matBadgeColor="warn"
                  >Protection</span>
                </a>

                <div class="section-heading">Admin</div>

                <a mat-list-item routerLink="/users" routerLinkActive="active">
                  <mat-icon matListItemIcon>group</mat-icon>
                  <span matListItemTitle>Users</span>
                </a>
                <a mat-list-item routerLink="/settings" routerLinkActive="active">
                  <mat-icon matListItemIcon>settings</mat-icon>
                  <span matListItemTitle>Settings</span>
                </a>
              }
            </mat-nav-list>
          </mat-sidenav>

          <mat-sidenav-content class="content">
            <router-outlet />
          </mat-sidenav-content>
        </mat-sidenav-container>
      } @else {
        <router-outlet />
      }
    } @else {
      <router-outlet />
    }
  `,
  styles: [
    `
      :host { display: block; height: 100vh; }
      .brand-icon { margin-right: 4px; font-size: 20px; width: 20px; height: 20px; }
      .brand { font-weight: 600; font-size: 15px; letter-spacing: -0.2px; }
      .spacer { flex: 1; }
      .container { height: calc(100vh - 48px); }
      .sidenav { width: 220px; background: var(--color-surface); border-right: 1px solid var(--color-border); }
      .content { background: var(--color-background); }
      a.mat-mdc-list-item.active { background: var(--color-hover); }
      .section-heading {
        padding: 16px 16px 4px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--text-tertiary);
      }
      .user-menu-header {
        padding: 8px 16px 12px;
        border-bottom: 1px solid var(--color-border);
      }
      .user-menu-name { font-weight: 600; font-size: 14px; }
      .user-menu-role { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px; }
    `,
  ],
})
export class AppComponent {
  private readonly manager = inject(ManagerService);
  private readonly hostEvents = inject(HostEventService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  private readonly prot = inject(ProtectionService);
  private readonly ws = inject(RegistryWsService);
  readonly auth = inject(AuthService);

  readonly currentTheme = toSignal(this.theme.currentTheme$, { initialValue: this.theme.current });
  readonly bannedCount = toSignal(this.prot.bannedCount$, { initialValue: 0 });
  readonly wsStatus = this.ws.connectionState;
  readonly isAdmin = this.auth.isAdmin;
  readonly chromeVisible = computed(() => !this.auth.mustChangePassword());
  readonly registryLiveStatus = computed((): LiveStatus => {
    switch (this.ws.connectionState()) {
      case 'connected': return 'ok';
      case 'connecting': return 'warn';
      case 'disconnected': return 'down';
    }
  });

  readonly hostCount = signal<number | null>(null);
  readonly gateCount = signal<number | null>(null);

  private subscribed = false;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (!user || this.subscribed) return;
      this.subscribed = true;
      this.bootstrapPlatformData();
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login'),
    });
  }

  private bootstrapPlatformData(): void {
    this.refreshHosts();
    this.refreshGates();

    this.hostEvents.hostChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshHosts());

    this.hostEvents.gateChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshGates());
  }

  private refreshHosts(): void {
    this.manager
      .getHosts()
      .pipe(catchError(() => of([] as Host[])))
      .subscribe((hosts) => this.hostCount.set(hosts.length));
  }

  private refreshGates(): void {
    this.manager
      .getGates()
      .pipe(catchError(() => of([] as Gate[])))
      .subscribe((gates) => this.gateCount.set(gates.length));
  }
}
