import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../features/auth/auth.service';

const AUTH_PATHS = ['/api/auth/login', '/api/auth/me', '/api/auth/logout'];

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const snack = inject(MatSnackBar);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      const isAuthRequest = AUTH_PATHS.some((p) => req.url.startsWith(p));
      if (isAuthRequest) return throwError(() => err);

      if (err.status === 401) {
        const onLogin = router.url.startsWith('/login');
        const alreadyAnonymous = auth.loaded() && auth.user() === null;
        if (!onLogin && !alreadyAnonymous) {
          auth.logout().subscribe({
            next: () => router.navigate(['/login'], { queryParams: { redirect: router.url } }),
            error: () => router.navigate(['/login'], { queryParams: { redirect: router.url } }),
          });
        }
      } else if (err.status === 403) {
        const body = err.error as { error?: string; code?: string } | null;
        if (body?.code === 'must_change_password') {
          if (!router.url.startsWith('/change-password')) {
            router.navigateByUrl('/change-password');
          }
        } else {
          const message = body?.error ?? 'You do not have permission to perform that action';
          snack.open(message, 'OK', { duration: 4000 });
        }
      }

      return throwError(() => err);
    }),
  );
};
