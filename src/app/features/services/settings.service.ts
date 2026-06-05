import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface PortalSettings {
  registryUrl: string;
  nexusToken: string;
}

const STORAGE_KEY = 'nexus-portal-settings';

export const SETTINGS_DEFAULTS: Readonly<PortalSettings> = {
  registryUrl: environment.registryUrl,
  nexusToken: environment.nexusToken,
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly _s = signal<PortalSettings>(this.load());

  readonly all = this._s.asReadonly();
  readonly registryUrl = computed(() => this._s().registryUrl);
  readonly nexusToken = computed(() => this._s().nexusToken);
  readonly isModified = computed(() => {
    const s = this._s();
    return s.registryUrl !== SETTINGS_DEFAULTS.registryUrl || s.nexusToken !== SETTINGS_DEFAULTS.nexusToken;
  });

  update(patch: Partial<PortalSettings>): void {
    const next = { ...this._s(), ...patch };
    this._s.set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  reset(): void {
    this._s.set({ ...SETTINGS_DEFAULTS });
    localStorage.removeItem(STORAGE_KEY);
  }

  private load(): PortalSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...SETTINGS_DEFAULTS, ...(JSON.parse(raw) as Partial<PortalSettings>) };
    } catch { /* corrupt — fall through */ }
    return { ...SETTINGS_DEFAULTS };
  }
}
