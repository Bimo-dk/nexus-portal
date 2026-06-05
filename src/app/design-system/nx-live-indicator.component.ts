import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type LiveStatus = 'ok' | 'down' | 'warn';

@Component({
  selector: 'nx-live-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="nx-live-indicator" [class]="'nx-live-' + status">
      <span class="nx-live-dot-wrap">
        <span class="nx-live-ring"></span>
        <span class="nx-live-dot"></span>
      </span>
      @if (label) { <span>{{ label }}</span> }
    </span>
  `,
})
export class NxLiveIndicatorComponent {
  @Input() status: LiveStatus = 'ok';
  @Input() label = '';
}
