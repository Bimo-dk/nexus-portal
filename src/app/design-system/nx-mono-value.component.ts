import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'nx-mono',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTooltipModule],
  template: `
    <span
      class="nx-mono"
      [style.max-width.px]="maxWidth || null"
      [matTooltip]="value"
      [matTooltipDisabled]="!maxWidth"
    >{{ value }}</span>
  `,
})
export class NxMonoValueComponent {
  @Input() value = '';
  @Input() maxWidth = 0;
}
