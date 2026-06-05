import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly _registryUrl = signal(environment.registryUrl);

  readonly registryUrl = computed(() => this._registryUrl());
}
