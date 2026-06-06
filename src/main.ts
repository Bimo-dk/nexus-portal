import { initFederation } from '@angular-architects/native-federation';

async function start(): Promise<void> {
  try {
    await initFederation();
    await import('./bootstrap');
  } catch (err) {
    console.error('[portal] Bootstrap failed:', err);
  }
}

start();
