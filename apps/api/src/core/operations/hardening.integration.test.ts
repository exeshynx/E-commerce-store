import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../../app.js';

let baseUrl = '';
let server: Server;

const closeServer = () =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server address unavailable.');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => closeServer());

void test('responses include hardened browser policies and sanitized request IDs', async () => {
  const response = await fetch(`${baseUrl}/health/live`, {
    headers: { 'x-request-id': '<script>alert(1)</script>' },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'none'/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('permissions-policy') ?? '', /camera=\(\)/);
  assert.doesNotMatch(response.headers.get('x-request-id') ?? '', /script/);
});

void test('cookie-authenticated endpoints reject cross-site origins', async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    headers: { origin: 'https://attacker.example' },
    method: 'POST',
  });
  assert.equal(response.status, 403);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'UNTRUSTED_REQUEST_ORIGIN');
});

void test('oversized JSON requests receive a stable 413 API error', async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    body: JSON.stringify({ payload: 'x'.repeat(300_000) }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(response.status, 413);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'REQUEST_TOO_LARGE');
});

void test('login throttling limits repeated authentication attempts', async () => {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 11; attempt += 1) {
    response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      body: JSON.stringify({ email: 'not-an-email', password: '' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }
  assert.equal(response?.status, 429);
  assert.match(response?.headers.get('retry-after') ?? '', /^\d+$/);
});
