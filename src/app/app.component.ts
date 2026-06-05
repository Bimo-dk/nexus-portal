import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, of } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ManagerService } from './features/services/manager.service';
import { HostEventService } from './features/services/host-event.service';
import { ThemeService } from './features/services/theme.service';
import { ProtectionService } from './features/protection/protection.service';
import { RegistryWsService } from './features/services/registry-ws.service';
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
    MatTooltipModule,
    NxLiveIndicatorComponent,
  ],
  template: `
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
    </mat-toolbar>

    <mat-sidenav-container class="container">
      <mat-sidenav mode="side" opened class="sidenav">
        <mat-nav-list>
          <a mat-list-item routerLink="/dashboard" routerLinkActive="active">
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </a>

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

          <div class="section-heading">Remotes</div>

          <a mat-list-item routerLink="/remotes" routerLinkActive="active">
            <mat-icon matListItemIcon>cloud</mat-icon>
            <span matListItemTitle>Remotes</span>
          </a>
          <a mat-list-item routerLink="/remotes/new" routerLinkActive="active">
            <mat-icon matListItemIcon>add_circle</mat-icon>
            <span matListItemTitle>Add remote</span>
          </a>
          <a mat-list-item routerLink="/catalog" routerLinkActive="active">
            <mat-icon matListItemIcon>widgets</mat-icon>
            <span matListItemTitle>Component catalog</span>
          </a>

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

          <a mat-list-item routerLink="/settings" routerLinkActive="active">
            <mat-icon matListItemIcon>settings</mat-icon>
            <span matListItemTitle>Settings</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="content">
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
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
    `,
  ],
})
export class AppComponent implements OnInit {
  private readonly manager = inject(ManagerService);
  private readonly hostEvents = inject(HostEventService);
  private readonly destroyRef = inject(DestroyRef);
  readonly theme = inject(ThemeService);
  private readonly prot = inject(ProtectionService);
  private readonly ws = inject(RegistryWsService);

  readonly currentTheme = toSignal(this.theme.currentTheme$, { initialValue: this.theme.current });
  readonly bannedCount = toSignal(this.prot.bannedCount$, { initialValue: 0 });
  readonly wsStatus = this.ws.connectionState;
  readonly registryLiveStatus = computed((): LiveStatus => {
    switch (this.ws.connectionState()) {
      case 'connected': return 'ok';
      case 'connecting': return 'warn';
      case 'disconnected': return 'down';
    }
  });

  readonly hostCount = signal<number | null>(null);
  readonly gateCount = signal<number | null>(null);

  ngOnInit(): void {
    this.manager
      .getHosts()
      .pipe(
        catchError(() => of([] as Host[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((hosts) => this.hostCount.set(hosts.length));

    this.manager
      .getGates()
      .pipe(
        catchError(() => of([] as Gate[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((gates) => this.gateCount.set(gates.length));

    this.hostEvents.hostChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.manager
          .getHosts()
          .pipe(catchError(() => of([] as Host[])))
          .subscribe((hosts) => this.hostCount.set(hosts.length));
      });

    this.hostEvents.gateChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.manager
          .getGates()
          .pipe(catchError(() => of([] as Gate[])))
          .subscribe((gates) => this.gateCount.set(gates.length));
      });
  }
}
