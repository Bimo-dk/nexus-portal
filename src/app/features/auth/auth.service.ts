import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';

export type Role = 'admin' | 'developer';

export interface SessionUser {
  username: string;
  role: Role;
  must_change_password: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly _user = signal<SessionUser | null>(null);
  private readonly _loaded = signal(false);

  readonly user = this._user.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly isAdmin = computed(() => this._user()?.role === 'admin');
  readonly mustChangePassword = computed(() => this._user()?.must_change_password === true);

  loadCurrent(): Observable<SessionUser | null> {
    return this.http.get<SessionUser>('/api/auth/me').pipe(
      tap((u) => this.setUser(u)),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) this.setUser(null);
        return of(null);
      }),
    );
  }

  login(username: string, password: string): Observable<SessionUser> {
    return this.http
      .post<SessionUser>('/api/auth/login', { username, password })
      .pipe(tap((u) => this.setUser(u)));
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}).pipe(
      tap(() => this.setUser(null)),
      map(() => undefined),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http
      .post<void>('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      .pipe(
        tap(() => {
          const current = this._user();
          if (current) this._user.set({ ...current, must_change_password: false });
        }),
        map(() => undefined),
      );
  }

  private setUser(u: SessionUser | null): void {
    this._user.set(u);
    this._loaded.set(true);
  }
}
