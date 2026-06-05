import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'nx-slide-over',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="nx-slide-over-backdrop" [class.open]="open" (click)="closeClick.emit()"></div>
    <div class="nx-slide-over-panel" [class.open]="open" role="dialog" [attr.aria-label]="title">
      <div class="nx-slide-over-header">
        <h2 class="nx-slide-over-title">{{ title }}</h2>
        <button mat-icon-button (click)="closeClick.emit()" aria-label="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="nx-slide-over-body">
        <ng-content />
      </div>
      <div class="nx-slide-over-footer">
        <ng-content select="[slot=footer]" />
      </div>
    </div>
  `,
})
export class NxSlideOverComponent {
  @Input() open = false;
  @Input() title = '';
  @Output() closeClick = new EventEmitter<void>();
}
