import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type BadgeVariant =
  | 'ok' | 'degraded' | 'down' | 'unknown'
  | 'blue' | 'red' | 'yellow' | 'purple' | 'gray'
  | 'angular' | 'vue' | 'react';

@Component({
  selector: 'nx-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="nx-badge" [class]="'nx-badge-' + variant">
      @if (dot) { <span class="nx-badge-dot"></span> }
      <ng-content />
    </span>
  `,
})
export class NxBadgeComponent {
  @Input() variant: BadgeVariant = 'gray';
  @Input() dot = false;
}
