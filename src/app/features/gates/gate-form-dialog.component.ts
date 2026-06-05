import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ManagerService } from '../services/manager.service';
import type { Gate, Host } from '../../types/platform';

export interface GateFormDialogData {
  gate?: Gate;
  hosts: Host[];
}

@Component({
  selector: 'app-gate-form-dialog',
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
    MatCardModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.gate ? 'Edit gate' : 'Add gate' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid" id="gate-form" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="mainGate" />
          <mat-hint>camelCase, starts with a letter</mat-hint>
          @if (form.controls.name.touched && form.controls.name.errors) {
            <mat-error>
              @if (form.controls.name.errors['required']) { Name is required. }
              @if (form.controls.name.errors['pattern']) { Must be camelCase (a–z, A–Z, 0–9). }
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Domain</mat-label>
          <input matInput formControlName="domain" placeholder="app.example.com" />
          <mat-hint>No protocol or trailing slash</mat-hint>
          @if (form.controls.domain.touched && form.controls.domain.errors) {
            <mat-error>
              @if (form.controls.domain.errors['required']) { Domain is required. }
              @if (form.controls.domain.errors['pattern']) { Invalid domain — no protocol or trailing slash. }
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Host</mat-label>
          <mat-select formControlName="hostId" (selectionChange)="onHostSelected()">
            @for (h of data.hosts; track h.id) {
              <mat-option [value]="h.id">{{ h.name }}</mat-option>
            }
          </mat-select>
          @if (form.controls.hostId.touched && form.controls.hostId.errors) {
            <mat-error>Host is required.</mat-error>
          }
        </mat-form-field>

        @if (selectedHost()) {
          <mat-card class="host-preview">
            <mat-card-content>
              <p class="preview-label">Selected host preview</p>
              <dl class="preview-grid">
                <dt>Framework</dt>
                <dd>
                  <span class="fw-badge" [class]="'fw-' + selectedHost()!.framework">
                    {{ selectedHost()!.framework }}
                  </span>
                </dd>
                <dt>URL</dt><dd><code>{{ selectedHost()!.url }}</code></dd>
                <dt>Remote entry</dt><dd><code>{{ selectedHost()!.remoteEntry }}</code></dd>
              </dl>
            </mat-card-content>
          </mat-card>
        }

        <mat-slide-toggle formControlName="enabled">Enabled</mat-slide-toggle>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-raised-button
        color="primary"
        form="gate-form"
        type="submit"
        [disabled]="form.invalid || saving()"
      >
        {{ saving() ? 'Saving…' : (data.gate ? 'Save changes' : 'Add gate') }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content { min-width: 480px; }
      .form-grid { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
      .host-preview { background: #f8fafc; box-shadow: none; border: 1px solid #e2e8f0; margin: 4px 0; }
      .host-preview mat-card-content { padding: 12px !important; }
      .preview-label { margin: 0 0 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(0,0,0,0.5); }
      .preview-grid { display: grid; grid-template-columns: 100px 1fr; gap: 4px 8px; margin: 0; }
      .preview-grid dt { color: rgba(0,0,0,0.6); font-size: 12px; }
      .preview-grid dd { margin: 0; font-size: 12px; }
      code { font-family: monospace; font-size: 11px; color: rgba(0,0,0,0.7); }
      .fw-badge {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        text-transform: capitalize;
      }
      .fw-angular { background: #fee2e2; color: #b91c1c; }
      .fw-vue { background: #dcfce7; color: #14532d; }
      .fw-react { background: #dbeafe; color: #1e40af; }
    `,
  ],
})
export class GateFormDialogComponent {
  readonly data = inject<GateFormDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<GateFormDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly manager = inject(ManagerService);

  readonly saving = signal(false);
  readonly selectedHost = signal<Host | null>(
    this.data.hosts.find((h) => h.id === this.data.gate?.hostId) ?? null,
  );

  readonly form = this.fb.nonNullable.group({
    name: [
      this.data.gate?.name ?? '',
      [Validators.required, Validators.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/)],
    ],
    domain: [
      this.data.gate?.domain ?? '',
      [Validators.required, Validators.pattern(/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/)],
    ],
    hostId: [this.data.gate?.hostId ?? '', Validators.required],
    enabled: [this.data.gate?.enabled ?? true],
  });

  onHostSelected(): void {
    const id = this.form.getRawValue().hostId;
    this.selectedHost.set(this.data.hosts.find((h) => h.id === id) ?? null);
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const op = this.data.gate
      ? this.manager.updateGate(this.data.gate.id, v)
      : this.manager.createGate(v);

    op.subscribe({
      next: (result) => this.ref.close(result),
      error: () => this.saving.set(false),
    });
  }
}
