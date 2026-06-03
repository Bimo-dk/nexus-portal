import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

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
  ],
  template: `
    <mat-toolbar color="primary">
      <mat-icon>hub</mat-icon>
      <span class="brand">Nexus Manager</span>
      <span class="spacer"></span>
      <a mat-button routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
      <a mat-button routerLink="/system" routerLinkActive="active">System</a>
      <a mat-button routerLink="/remotes" routerLinkActive="active">Remotes</a>
      <a mat-button routerLink="/catalog" routerLinkActive="active">Catalog</a>
    </mat-toolbar>

    <mat-sidenav-container class="container">
      <mat-sidenav mode="side" opened class="sidenav">
        <mat-nav-list>
          <a mat-list-item routerLink="/dashboard" routerLinkActive="active">
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </a>
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
            <span matListItemTitle>Component Catalog</span>
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
      .brand { margin-left: 8px; font-weight: 600; }
      .spacer { flex: 1; }
      .container { height: calc(100vh - 64px); }
      .sidenav { width: 220px; background: #f8fafc; border-right: 1px solid #e2e8f0; }
      .content { background: #f8fafc; }
      a.mat-mdc-button.active, a.mat-mdc-list-item.active { background: rgba(0,0,0,0.08); }
    `,
  ],
})
export class AppComponent {}
