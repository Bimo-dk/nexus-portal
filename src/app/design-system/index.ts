import { NxBadgeComponent } from './nx-badge.component';
import { NxStatTileComponent } from './nx-stat-tile.component';
import { NxLiveIndicatorComponent } from './nx-live-indicator.component';
import { NxSlideOverComponent } from './nx-slide-over.component';
import { NxMonoValueComponent } from './nx-mono-value.component';
import { NxConfirmDialogComponent } from './nx-confirm-dialog.component';

export { NxBadgeComponent };
export type { BadgeVariant } from './nx-badge.component';
export { NxStatTileComponent };
export type { StatVariant } from './nx-stat-tile.component';
export { NxLiveIndicatorComponent };
export type { LiveStatus } from './nx-live-indicator.component';
export { NxSlideOverComponent };
export { NxMonoValueComponent };
export { NxConfirmDialogComponent };
export type { NxConfirmDialogData } from './nx-confirm-dialog.component';

export const DS_COMPONENTS = [
  NxBadgeComponent,
  NxStatTileComponent,
  NxLiveIndicatorComponent,
  NxSlideOverComponent,
  NxMonoValueComponent,
  NxConfirmDialogComponent,
] as const;
