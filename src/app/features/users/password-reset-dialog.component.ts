import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface PasswordResetDialogData {
  username: string;
}

@Component({
  selector: 'app-password-reset-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Reset password for {{ data.username }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" (ngSubmit)="confirm()" class="form">
        <mat-form-field appearance="outline">
          <mat-label>New temporary password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>Minimum 8 characters. User will be forced to change it at next login.</mat-hint>
          @if (form.controls.password.hasError('minlength') && form.controls.password.dirty) {
            <mat-error>Password must be at least 8 characters</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-raised-button
        color="primary"
        type="button"
        [disabled]="form.invalid"
        (click)="confirm()"
      >
        Reset password
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form { display: flex; flex-direction: column; padding-top: 8px; min-width: 320px; }
  `],
})
export class PasswordResetDialogComponent {
  readonly data = inject<PasswordResetDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PasswordResetDialogComponent, string>);

  readonly form = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  confirm(): void {
    if (this.form.invalid) return;
    this.ref.close(this.form.controls.password.value);
  }
}
