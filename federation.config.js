const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
  name: 'manager',

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    'fastify',
    '@fastify/cookie',
    '@fastify/static',
    '@fastify/websocket',
    'better-sqlite3',
    'bcrypt',
    'ws',
  ],
});
