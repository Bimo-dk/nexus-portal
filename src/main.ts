import { initFederation } from '@angular-architects/native-federation';
import { environment } from './environments/environment';

/**
 * Bootstrap-sekvens med runtime-config override.
 * Henter /assets/config.json (genereret af container entrypoint) og merger
 * ind i environment-objektet før bootstrap.
 */
async function start(): Promise<void> {
  try {
    const res = await fetch('/assets/config.json', { cache: 'no-store' });
    if (res.ok) {
      const runtime = (await res.json()) as Partial<typeof environment>;
      Object.assign(environment, runtime);
      console.log('[portal] Runtime config loaded:', runtime);
    }
  } catch (err) {
    console.warn('[portal] No runtime config — using compile-time defaults', err);
  }

  try {
    await initFederation();
    await import('./bootstrap');
  } catch (err) {
    console.error('[portal] Bootstrap failed:', err);
  }
}

start();
