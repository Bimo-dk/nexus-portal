import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type StatVariant = 'default' | 'danger' | 'warn' | 'ok';

@Component({
  selector: 'nx-stat-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nx-stat-tile" [class]="'nx-stat-tile-' + variant">
      <div class="nx-stat-tile-value">{{ value }}</div>
      <div class="nx-stat-tile-label">{{ label }}</div>
      @if (sparkPath) {
        <svg
          class="nx-stat-tile-sparkline"
          [attr.width]="sparkW"
          [attr.height]="sparkH"
          [attr.viewBox]="'0 0 ' + sparkW + ' ' + sparkH"
          fill="none"
          overflow="visible"
        >
          <path [attr.d]="sparkPath" stroke="currentColor" stroke-width="1.5" fill="none" />
        </svg>
      }
    </div>
  `,
})
export class NxStatTileComponent {
  @Input() value: string | number = 0;
  @Input() label = '';
  @Input() variant: StatVariant = 'default';
  @Input() sparkValues: number[] = [];

  readonly sparkW = 80;
  readonly sparkH = 24;

  get sparkPath(): string {
    const vals = this.sparkValues;
    if (vals.length < 2) return '';
    const max = Math.max(...vals, 1);
    const step = this.sparkW / (vals.length - 1);
    const pts = vals.map((v, i) => `${i * step},${this.sparkH - (v / max) * (this.sparkH - 2) - 1}`);
    return `M ${pts.join(' L ')}`;
  }
}
