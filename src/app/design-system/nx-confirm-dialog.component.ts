import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface NxConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  disableConfirm?: boolean;
}

@Component({
  selector: 'nx-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <div class="nx-confirm-dialog">
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">{{ data.message }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close style="color: var(--text-secondary);">
          {{ data.cancelLabel ?? 'Cancel' }}
        </button>
        <button
          mat-raised-button
          color="warn"
          (click)="confirm()"
          [disabled]="data.disableConfirm"
        >
          {{ data.confirmLabel ?? 'Confirm' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class NxConfirmDialogComponent {
  readonly data = inject<NxConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<NxConfirmDialogComponent>);

  confirm(): void {
    this.ref.close(true);
  }
}
