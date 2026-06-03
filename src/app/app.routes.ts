import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'system',
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
    path: 'remotes',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/remotes/remote-list.component').then((m) => m.RemoteListComponent),
      },
      {
        path: 'new',
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
  { path: '**', redirectTo: 'dashboard' },
];
