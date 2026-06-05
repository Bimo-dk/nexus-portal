import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { ManagerService } from '../services/manager.service';
import type { Host } from '../../types/platform';

@Component({
  selector: 'app-remote-add',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatCardModule,
    MatSelectModule,
    MatRadioModule,
  ],
  template: `
    <div class="page">
      <header>
        <a mat-button routerLink="/remotes"><mat-icon>arrow_back</mat-icon> Back to list</a>
        <h1>Add remote</h1>
      </header>

      <mat-card>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input matInput formControlName="name" placeholder="remoteThree" />
              <mat-hint>camelCase, must start with a letter</mat-hint>
              @if (form.controls.name.touched && form.controls.name.errors) {
                <mat-error>
                  @if (form.controls.name.errors['required']) { Name is required. }
                  @if (form.controls.name.errors['pattern']) { Must be camelCase (a-z, A-Z, 0-9). }
                </mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>URL to remoteEntry.json</mat-label>
              <input matInput formControlName="url" placeholder="http://localhost:6680/remoteEntry.json" />
              @if (form.controls.url.touched && form.controls.url.errors) {
                <mat-error>
                  @if (form.controls.url.errors['required']) { URL is required. }
                  @if (form.controls.url.errors['pattern']) { Must be a valid http(s) URL. }
                </mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Exposed module</mat-label>
              <input matInput formControlName="exposedModule" />
              <mat-hint>Default: ./RemoteEntry</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Route path</mat-label>
              <input matInput formControlName="routePath" placeholder="remote-three" />
              <mat-hint>kebab-case URL in host</mat-hint>
              @if (form.controls.routePath.touched && form.controls.routePath.errors) {
                <mat-error>
                  @if (form.controls.routePath.errors['required']) { Route path is required. }
                  @if (form.controls.routePath.errors['pattern']) { Must be kebab-case (a-z, 0-9, -). }
                </mat-error>
              }
            </mat-form-field>

            <div class="visibility-group">
              <p class="field-label">Visibility</p>
              <mat-radio-group formControlName="visibilityType" class="radio-group">
                <mat-radio-button value="global">Global — visible to all hosts</mat-radio-button>
                <mat-radio-button value="host">Host-specific</mat-radio-button>
              </mat-radio-group>

              @if (form.controls.visibilityType.value === 'host') {
                <mat-form-field appearance="outline" class="host-select">
                  <mat-label>Host</mat-label>
                  <mat-select formControlName="visibilityHostId">
                    @for (h of hosts(); track h.id) {
                      <mat-option [value]="h.id">{{ h.name }}</mat-option>
                    }
                  </mat-select>
                  @if (form.controls.visibilityHostId.touched && form.controls.visibilityHostId.errors) {
                    <mat-error>Select a host.</mat-error>
                  }
                </mat-form-field>
              }
            </div>

            <mat-checkbox formControlName="enabled">Enable remote immediately</mat-checkbox>

            <div class="actions">
              <a mat-button routerLink="/remotes">Cancel</a>
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || submitting()">
                @if (submitting()) { Saving... } @else { Save remote }
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 720px; margin: 0 auto; }
      header { margin-bottom: 16px; }
      header h1 { margin: 8px 0 0; font-size: 24px; }
      .form-grid { display: flex; flex-direction: column; gap: 4px; }
      .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
      .visibility-group { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; }
      .field-label { margin: 0; font-size: 12px; color: rgba(0,0,0,0.6); }
      .radio-group { display: flex; flex-direction: column; gap: 4px; }
      .host-select { width: 100%; }
    `,
  ],
})
export class RemoteAddComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly manager = inject(ManagerService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly hosts = signal<Host[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/)]],
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    exposedModule: ['./RemoteEntry', [Validators.required]],
    routePath: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    visibilityType: ['global' as 'global' | 'host'],
    visibilityHostId: [''],
    enabled: [true],
  });

  ngOnInit(): void {
    this.manager.getHosts().subscribe({ next: (list) => this.hosts.set(list) });
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    const v = this.form.getRawValue();

    const visibility =
      v.visibilityType === 'host' && v.visibilityHostId
        ? (`host:${v.visibilityHostId}` as const)
        : 'global';

    this.manager
      .addRemote({
        name: v.name,
        url: v.url,
        exposedModule: v.exposedModule,
        routePath: v.routePath,
        enabled: v.enabled,
        visibility,
      })
      .subscribe({
        next: () => this.router.navigate(['/remotes']),
        error: () => {
          this.submitting.set(false);
        },
      });
  }
}
