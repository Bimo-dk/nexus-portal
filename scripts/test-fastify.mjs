#!/usr/bin/env node
import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok', service: 'test-server' }));

await app.listen({ host: '127.0.0.1', port: 8081 });
console.log('Test server up on http://127.0.0.1:8081/health');
