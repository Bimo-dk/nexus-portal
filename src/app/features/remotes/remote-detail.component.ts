import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatDivider } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { interval, startWith, switchMap } from 'rxjs';
import { ManagerService } from '../services/manager.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import type { RemoteConfig, RemoteHealthStatus } from '../../types/remote-config';

@Component({
  selector: 'app-remote-detail',
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
    MatDivider,
    MatDialogModule,
    DatePipe,
    DecimalPipe,
    UpperCasePipe,
  ],
  template: `
    <div class="page">
      <header>
        <a mat-button routerLink="/remotes"><mat-icon>arrow_back</mat-icon> Back to list</a>
        <h1>{{ remote()?.name ?? 'Loading...' }}</h1>
      </header>

      @if (remote(); as r) {
        <div class="grid">
          <mat-card>
            <mat-card-header>
              <mat-card-title>Configuration</mat-card-title>
              <mat-card-subtitle>Added {{ r.addedAt | date: 'medium' }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <form [formGroup]="form" (ngSubmit)="onSave()" class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>URL to remoteEntry.json</mat-label>
                  <input matInput formControlName="url" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Exposed module</mat-label>
                  <input matInput formControlName="exposedModule" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Route path</mat-label>
                  <input matInput formControlName="routePath" />
                </mat-form-field>

                <mat-checkbox formControlName="enabled">Enabled</mat-checkbox>

                <div class="actions">
                  <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || form.pristine || saving">
                    {{ saving ? 'Saving...' : 'Save changes' }}
                  </button>
                </div>
              </form>
            </mat-card-content>
          </mat-card>

          <mat-card>
            <mat-card-header>
              <mat-card-title>Live status</mat-card-title>
              <mat-card-subtitle>Health check every 10 seconds</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="status-row">
                <span class="status-pill" [class]="health() ?? 'unknown'">
                  <span class="dot"></span>
                  {{ (health() ?? 'unknown') | uppercase }}
                </span>
                @if (responseTime() !== null) {
                  <span class="rt">{{ responseTime() | number: '1.0-0' }} ms</span>
                }
              </div>
              <p class="last">Last checked: {{ lastChecked() | date: 'mediumTime' }}</p>

              <mat-divider />

              <h3>Dangerous actions</h3>
              <div class="danger-actions">
                <button mat-stroked-button color="primary" (click)="onRedeploy()">
                  <mat-icon>refresh</mat-icon> Redeploy
                </button>
                <button mat-stroked-button color="warn" (click)="onDelete()">
                  <mat-icon>delete</mat-icon> Delete remote
                </button>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      } @else {
        <p>Loading...</p>
      }
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 1080px; margin: 0 auto; }
      header { margin-bottom: 16px; }
      header h1 { margin: 8px 0 0; font-size: 24px; }
      .grid { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      .form-grid { display: flex; flex-direction: column; gap: 4px; }
      .actions { display: flex; justify-content: flex-end; margin-top: 12px; }
      .status-row { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
      .rt { font-family: monospace; font-size: 12px; color: rgba(0,0,0,0.6); }
      .last { margin: 0 0 16px; font-size: 12px; color: rgba(0,0,0,0.6); }
      h3 { margin: 16px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(0,0,0,0.6); }
      .danger-actions { display: flex; flex-direction: column; gap: 8px; }
    `,
  ],
})
export class RemoteDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly manager = inject(ManagerService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly remote = signal<RemoteConfig | null>(null);
  readonly health = signal<RemoteHealthStatus | null>(null);
  readonly responseTime = signal<number | null>(null);
  readonly lastChecked = signal<Date | null>(null);
  saving = false;

  readonly form = this.fb.nonNullable.group({
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    exposedModule: ['./RemoteEntry', [Validators.required]],
    routePath: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    enabled: [true],
  });

  ngOnInit(): void {
    const name = this.route.snapshot.paramMap.get('name');
    if (!name) {
      this.router.navigate(['/remotes']);
      return;
    }
    this.manager.getRemote(name).subscribe({
      next: (r) => {
        this.remote.set(r);
        this.form.patchValue({
          url: r.url,
          exposedModule: r.exposedModule,
          routePath: r.routePath,
          enabled: r.enabled,
        });
        this.startHealthPolling(r.url);
      },
      error: () => this.router.navigate(['/remotes']),
    });
  }

  private startHealthPolling(url: string): void {
    interval(10000)
      .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.manager.checkHealth(url).subscribe((res) => {
          this.health.set(res.status);
          this.responseTime.set(res.responseTimeMs);
          this.lastChecked.set(new Date());
        });
      });
  }

  onSave(): void {
    const r = this.remote();
    if (!r || this.form.invalid || this.saving) return;
    this.saving = true;
    const v = this.form.getRawValue();
    this.manager.updateRemote(r.name, v).subscribe({
      next: (updated) => {
        this.remote.set(updated);
        this.form.markAsPristine();
        this.saving = false;
      },
      error: () => {
        this.saving = false;
      },
    });
  }

  onDelete(): void {
    const r = this.remote();
    if (!r) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Delete "${r.name}"?`,
        message: `Remote will be removed permanently from the registry and the host will deregister the route.`,
        confirmLabel: 'Delete',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.manager.deleteRemote(r.name).subscribe({
          next: () => this.router.navigate(['/remotes']),
        });
      }
    });
  }

  onRedeploy(): void {
    const r = this.remote();
    if (!r) return;
    this.manager.redeployRemote(r.name).subscribe();
  }
}
