import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { ManagerService } from '../services/manager.service';

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
  ],
  template: `
    <div class="page">
      <header>
        <a mat-button routerLink="/remotes"><mat-icon>arrow_back</mat-icon> Tilbage til liste</a>
        <h1>Add remote</h1>
      </header>

      <mat-card>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Navn</mat-label>
              <input matInput formControlName="name" placeholder="remoteThree" />
              <mat-hint>camelCase, starter med et bogstav</mat-hint>
              @if (form.controls.name.touched && form.controls.name.errors) {
                <mat-error>
                  @if (form.controls.name.errors['required']) { Navn er påkrævet. }
                  @if (form.controls.name.errors['pattern']) { Skal være camelCase (a-z, A-Z, 0-9). }
                </mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>URL til remoteEntry.json</mat-label>
              <input matInput formControlName="url" placeholder="http://localhost:6680/remoteEntry.json" />
              @if (form.controls.url.touched && form.controls.url.errors) {
                <mat-error>
                  @if (form.controls.url.errors['required']) { URL er påkrævet. }
                  @if (form.controls.url.errors['pattern']) { Skal være en gyldig http(s) URL. }
                </mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Exposed module</mat-label>
              <input matInput formControlName="exposedModule" />
              <mat-hint>Standard: ./RemoteEntry</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Route path</mat-label>
              <input matInput formControlName="routePath" placeholder="remote-three" />
              <mat-hint>kebab-case URL i host</mat-hint>
              @if (form.controls.routePath.touched && form.controls.routePath.errors) {
                <mat-error>
                  @if (form.controls.routePath.errors['required']) { Route path er påkrævet. }
                  @if (form.controls.routePath.errors['pattern']) { Skal være kebab-case (a-z, 0-9, -). }
                </mat-error>
              }
            </mat-form-field>

            <mat-checkbox formControlName="enabled">Aktiver remote med det samme</mat-checkbox>

            <div class="actions">
              <a mat-button routerLink="/remotes">Annullér</a>
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || submitting">
                @if (submitting) { Gemmer... } @else { Gem remote }
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
    `,
  ],
})
export class RemoteAddComponent {
  private readonly fb = inject(FormBuilder);
  private readonly manager = inject(ManagerService);
  private readonly router = inject(Router);

  submitting = false;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/)]],
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    exposedModule: ['./RemoteEntry', [Validators.required]],
    routePath: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    enabled: [true],
  });

  onSubmit(): void {
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;
    const v = this.form.getRawValue();
    this.manager
      .addRemote({
        name: v.name,
        url: v.url,
        exposedModule: v.exposedModule,
        routePath: v.routePath,
        enabled: v.enabled,
      })
      .subscribe({
        next: () => this.router.navigate(['/remotes']),
        error: () => {
          this.submitting = false;
        },
      });
  }
}
