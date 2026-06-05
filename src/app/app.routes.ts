import { Routes } from '@angular/router';
import { adminGuard, authGuard, loginGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/change-password.component').then((m) => m.ChangePasswordComponent),
  },
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'system',
        canActivate: [adminGuard],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'health' },
          {
            path: 'health',
            loadComponent: () =>
              import('./features/system/system.component').then((m) => m.SystemComponent),
          },
          {
            path: 'config',
            loadComponent: () =>
              import('./features/system/config.component').then((m) => m.ConfigComponent),
          },
          {
            path: 'logs',
            loadComponent: () =>
              import('./features/system/logs.component').then((m) => m.LogsComponent),
          },
          {
            path: 'metrics',
            loadComponent: () =>
              import('./features/system/metrics.component').then((m) => m.MetricsComponent),
          },
        ],
      },
      {
        path: 'catalog',
        loadComponent: () =>
          import('./features/catalog/catalog.component').then((m) => m.CatalogComponent),
      },
      {
        path: 'remotes',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/remotes/remote-list.component').then((m) => m.RemoteListComponent),
          },
          {
            path: 'new',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/remotes/remote-add.component').then((m) => m.RemoteAddComponent),
          },
          {
            path: ':name',
            loadComponent: () =>
              import('./features/remotes/remote-detail.component').then((m) => m.RemoteDetailComponent),
          },
        ],
      },
      {
        path: 'hosts',
        canActivate: [adminGuard],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/hosts/host-list.component').then((m) => m.HostListComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/hosts/host-detail.component').then((m) => m.HostDetailComponent),
          },
        ],
      },
      {
        path: 'gates',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/gates/gate-list.component').then((m) => m.GateListComponent),
      },
      {
        path: 'protection',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/protection/protection.component').then((m) => m.ProtectionComponent),
      },
      {
        path: 'settings',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/users/users.component').then((m) => m.UsersComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
