import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <div class="page">
      <mat-card class="card">
        <mat-card-header>
          <mat-icon mat-card-avatar>lock_reset</mat-icon>
          <mat-card-title>Change password</mat-card-title>
          <mat-card-subtitle>
            {{ auth.mustChangePassword()
              ? 'You must change your password before continuing.'
              : 'Update your account password.' }}
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()" class="form">
            <mat-form-field appearance="outline">
              <mat-label>Current password</mat-label>
              <input matInput type="password" formControlName="current" autocomplete="current-password" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>New password</mat-label>
              <input matInput type="password" formControlName="next" autocomplete="new-password" />
              <mat-hint>Minimum 8 characters</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Confirm new password</mat-label>
              <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
              @if (form.hasError('mismatch') && form.controls.confirm.dirty) {
                <mat-error>Passwords do not match</mat-error>
              }
            </mat-form-field>
            @if (error()) {
              <p class="error">{{ error() }}</p>
            }
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="form.invalid || submitting()"
            >
              {{ submitting() ? 'Saving…' : 'Save new password' }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px;
      background: var(--color-background);
    }
    .card { width: 100%; max-width: 420px; }
    .form { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; }
    .error { color: var(--color-danger, #d32f2f); font-size: 13px; margin: 0; }
  `],
})
export class ChangePasswordComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = new FormGroup(
    {
      current: new FormControl('', { nonNullable: true, validators: Validators.required }),
      next: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirm: new FormControl('', { nonNullable: true, validators: Validators.required }),
    },
    { validators: matchValidator },
  );

  submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set(null);
    const { current, next } = this.form.getRawValue();
    this.auth.changePassword(current, next).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/dashboard');
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        const msg = (err.error as { error?: string } | null)?.error;
        this.error.set(msg ?? 'Failed to change password');
      },
    });
  }
}

function matchValidator(group: import('@angular/forms').AbstractControl) {
  const next = group.get('next')?.value;
  const confirm = group.get('confirm')?.value;
  return next === confirm ? null : { mismatch: true };
}
