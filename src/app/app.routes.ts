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
    loadComponent: () =>
      import('./features/system/system.component').then((m) => m.SystemComponent),
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
