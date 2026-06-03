// Runtime-overridable. nexusToken overrides via /assets/config.json (genereres af container entrypoint fra env-vars).
export const environment = {
  production: true,
  registryUrl: '/api',
  nexusToken: 'dev-token-change-in-production',
  refreshIntervalMs: 30000,
};
