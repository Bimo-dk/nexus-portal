import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { NxConfirmDialogComponent } from '../../design-system';
import type { Role } from '../auth/auth.service';
import { AuthService } from '../auth/auth.service';
import { PasswordResetDialogComponent } from './password-reset-dialog.component';

interface PortalUser {
  id: number;
  username: string;
  role: Role;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

const ROLE_OPTIONS: ReadonlyArray<Role> = ['admin', 'developer'];

@Component({
  selector: 'app-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  template: `
    <div class="page">
      <header>
        <h1>Users</h1>
      </header>

      <mat-card class="section">
        <mat-card-header>
          <mat-card-title>Add user</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="createForm" (ngSubmit)="create()" class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Username</mat-label>
              <input matInput formControlName="username" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Temporary password</mat-label>
              <input matInput type="password" formControlName="password" />
              <mat-hint>Minimum 8 characters. User must change at first login.</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline" class="role-select">
              <mat-label>Role</mat-label>
              <mat-select formControlName="role">
                @for (r of roles; track r) {
                  <mat-option [value]="r">{{ r }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="createForm.invalid || creating()"
            >
              <mat-icon>person_add</mat-icon>
              Create
            </button>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="section">
        <mat-card-header>
          <mat-card-title>All users</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <table mat-table [dataSource]="users()">
            <ng-container matColumnDef="username">
              <th mat-header-cell *matHeaderCellDef>Username</th>
              <td mat-cell *matCellDef="let u">{{ u.username }}</td>
            </ng-container>
            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Role</th>
              <td mat-cell *matCellDef="let u">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inline-select">
                  <mat-select [value]="u.role" (selectionChange)="updateRole(u, $event.value)">
                    @for (r of roles; track r) {
                      <mat-option [value]="r">{{ r }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </td>
            </ng-container>
            <ng-container matColumnDef="must_change">
              <th mat-header-cell *matHeaderCellDef>Password reset</th>
              <td mat-cell *matCellDef="let u">
                @if (u.must_change_password) {
                  <mat-icon class="warn" matTooltip="User must change password at next login">priority_high</mat-icon>
                } @else {
                  <mat-icon class="muted">check</mat-icon>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="last_login">
              <th mat-header-cell *matHeaderCellDef>Last login</th>
              <td mat-cell *matCellDef="let u">{{ u.last_login_at ?? '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let u">
                <button
                  mat-icon-button
                  matTooltip="Reset password"
                  (click)="resetPassword(u)"
                >
                  <mat-icon>vpn_key</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  matTooltip="Delete user"
                  [disabled]="u.username === currentUsername()"
                  (click)="delete(u)"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayed"></tr>
            <tr mat-row *matRowDef="let row; columns: displayed"></tr>
          </table>

          @if (users().length === 0) {
            <p class="empty">No users yet.</p>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1280px; margin: 0 auto; }
    header { margin-bottom: 16px; }
    header h1 { margin: 0; font-size: 24px; }
    .section { margin-bottom: 20px; }
    .form-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; padding-top: 12px; }
    .role-select { min-width: 160px; }
    .inline-select { width: 140px; }
    table { width: 100%; }
    .warn { color: var(--color-danger, #d32f2f); }
    .muted { color: var(--text-tertiary); }
    .empty { padding: 24px; text-align: center; color: var(--text-secondary); }
  `],
})
export class UsersComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  readonly users = signal<PortalUser[]>([]);
  readonly creating = signal(false);
  readonly roles = ROLE_OPTIONS;
  readonly displayed = ['username', 'role', 'must_change', 'last_login', 'actions'];
  readonly currentUsername = computed(() => this.auth.user()?.username ?? '');

  readonly createForm = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: Validators.required }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    role: new FormControl<Role>('developer', { nonNullable: true, validators: Validators.required }),
  });

  ngOnInit(): void {
    this.refresh();
  }

  create(): void {
    if (this.createForm.invalid) return;
    this.creating.set(true);
    const payload = this.createForm.getRawValue();
    this.http.post<PortalUser>('/api/users', payload).subscribe({
      next: () => {
        this.creating.set(false);
        this.createForm.reset({ username: '', password: '', role: 'developer' });
        this.refresh();
        this.snack.open('User created', 'OK', { duration: 3000 });
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        this.snack.open(this.errorMessage(err, 'Failed to create user'), 'OK', { duration: 4000 });
      },
    });
  }

  updateRole(user: PortalUser, role: Role): void {
    if (user.role === role) return;
    this.http.patch<PortalUser>(`/api/users/${user.id}`, { role }).subscribe({
      next: () => this.refresh(),
      error: (err: HttpErrorResponse) => {
        this.snack.open(this.errorMessage(err, 'Failed to update role'), 'OK', { duration: 4000 });
      },
    });
  }

  resetPassword(user: PortalUser): void {
    const ref = this.dialog.open(PasswordResetDialogComponent, {
      data: { username: user.username },
    });
    ref.afterClosed().subscribe((newPassword: string | undefined) => {
      if (!newPassword) return;
      this.http.patch(`/api/users/${user.id}`, { password: newPassword }).subscribe({
        next: () => this.snack.open(`Password reset for ${user.username}`, 'OK', { duration: 3000 }),
        error: (err: HttpErrorResponse) => {
          this.snack.open(this.errorMessage(err, 'Failed to reset password'), 'OK', { duration: 4000 });
        },
      });
    });
  }

  delete(user: PortalUser): void {
    const ref = this.dialog.open(NxConfirmDialogComponent, {
      data: {
        title: `Delete ${user.username}?`,
        message: 'This removes the user and all active sessions immediately. Cannot be undone.',
        confirmLabel: 'Delete',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.http.delete(`/api/users/${user.id}`).subscribe({
        next: () => {
          this.refresh();
          this.snack.open(`Deleted ${user.username}`, 'OK', { duration: 3000 });
        },
        error: (err: HttpErrorResponse) => {
          this.snack.open(this.errorMessage(err, 'Failed to delete user'), 'OK', { duration: 4000 });
        },
      });
    });
  }

  private refresh(): void {
    this.http.get<PortalUser[]>('/api/users').subscribe({
      next: (list) => this.users.set(list),
    });
  }

  private errorMessage(err: HttpErrorResponse, fallback: string): string {
    return (err.error as { error?: string } | null)?.error ?? fallback;
  }
}
