import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { ManagerService } from '../services/manager.service';
import type { Host } from '../../types/platform';

export interface HostFormDialogData {
  host?: Host;
}

@Component({
  selector: 'app-host-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.host ? 'Edit host' : 'Add host' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid" id="host-form" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="shellApp" />
          <mat-hint>camelCase, starts with a letter</mat-hint>
          @if (form.controls.name.touched && form.controls.name.errors) {
            <mat-error>
              @if (form.controls.name.errors['required']) { Name is required. }
              @if (form.controls.name.errors['pattern']) { Must be camelCase (a–z, A–Z, 0–9). }
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>URL</mat-label>
          <input matInput formControlName="url" placeholder="http://localhost:4000" />
          @if (form.controls.url.touched && form.controls.url.errors) {
            <mat-error>
              @if (form.controls.url.errors['required']) { URL is required. }
              @if (form.controls.url.errors['pattern']) { Must be a valid http(s) URL. }
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Framework</mat-label>
          <mat-select formControlName="framework">
            <mat-option value="angular">Angular</mat-option>
            <mat-option value="vue">Vue</mat-option>
            <mat-option value="react">React</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Remote entry</mat-label>
          <input matInput formControlName="remoteEntry" />
          <mat-hint>Path to remoteEntry.json on the host</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Exposed module</mat-label>
          <input matInput formControlName="exposedModule" />
        </mat-form-field>

        <mat-slide-toggle formControlName="enabled">Enabled</mat-slide-toggle>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-raised-button
        color="primary"
        form="host-form"
        type="submit"
        [disabled]="form.invalid || saving()"
      >
        {{ saving() ? 'Saving…' : (data.host ? 'Save changes' : 'Add host') }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content { min-width: 480px; }
      .form-grid { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
    `,
  ],
})
export class HostFormDialogComponent {
  readonly data = inject<HostFormDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<HostFormDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly manager = inject(ManagerService);

  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: [
      this.data.host?.name ?? '',
      [Validators.required, Validators.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/)],
    ],
    url: [
      this.data.host?.url ?? '',
      [Validators.required, Validators.pattern(/^https?:\/\/.+/)],
    ],
    framework: [this.data.host?.framework ?? 'angular', Validators.required],
    remoteEntry: [this.data.host?.remoteEntry ?? '/host/remoteEntry.json', Validators.required],
    exposedModule: [this.data.host?.exposedModule ?? './AppShell', Validators.required],
    enabled: [this.data.host?.enabled ?? true],
  });

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const op = this.data.host
      ? this.manager.updateHost(this.data.host.id, v)
      : this.manager.createHost(v);

    op.subscribe({
      next: (result) => this.ref.close(result),
      error: () => this.saving.set(false),
    });
  }
}
