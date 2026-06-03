import { initFederation } from '@angular-architects/native-federation';

initFederation()
  .catch((err) => console.error('[manager] Federation init failed:', err))
  .then(() => import('./bootstrap'))
  .catch((err) => console.error('[manager] Bootstrap failed:', err));
