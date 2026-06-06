import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../features/auth/auth.service';

async function ensureLoaded(auth: AuthService): Promise<void> {
  if (!auth.loaded()) await firstValueFrom(auth.loadCurrent());
}

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await ensureLoaded(auth);

  if (!auth.user()) {
    return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
  }
  if (auth.mustChangePassword() && state.url !== '/change-password') {
    return router.createUrlTree(['/change-password']);
  }
  return true;
};

export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await ensureLoaded(auth);

  if (!auth.user()) {
    return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
  }
  if (auth.mustChangePassword()) {
    return router.createUrlTree(['/change-password']);
  }
  if (!auth.isAdmin()) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};

export const loginGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await ensureLoaded(auth);

  if (auth.user()) {
    return router.createUrlTree([auth.mustChangePassword() ? '/change-password' : '/dashboard']);
  }
  return true;
};
