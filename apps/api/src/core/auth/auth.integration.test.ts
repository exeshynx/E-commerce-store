import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import type { ApiSuccess, AuthSessionData } from '@aurelia/contracts';
import { createApp } from '../../app.js';
import { prisma } from '../../infrastructure/database/prisma.js';

const email = 'auth.integration@aurelia.test';
const password = 'StrongPassword123';
const server = createServer(createApp());
let baseUrl = '';

const getCookie = (response: Response) => {
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(cookie, 'Expected the API to set a refresh cookie');
  return cookie;
};

const getAccessToken = async (response: Response) => {
  const payload = (await response.json()) as ApiSuccess<AuthSessionData>;
  assert.ok(payload.data.accessToken);
  return payload.data.accessToken;
};

before(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1/auth`;
});

after(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

void test('registration, profile, refresh, logout, and login lifecycle', async () => {
  const registration = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      firstName: 'Auth',
      lastName: 'Tester',
      password,
    }),
  });
  assert.equal(registration.status, 201);
  const registrationCookie = getCookie(registration);
  const accessToken = await getAccessToken(registration);

  const profile = await fetch(`${baseUrl}/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assert.equal(profile.status, 200);

  const duplicate = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: email.toUpperCase(),
      firstName: 'Auth',
      lastName: 'Tester',
      password,
    }),
  });
  assert.equal(duplicate.status, 409);

  const refresh = await fetch(`${baseUrl}/refresh`, {
    method: 'POST',
    headers: { cookie: registrationCookie },
  });
  assert.equal(refresh.status, 200);
  const rotatedCookie = getCookie(refresh);
  await getAccessToken(refresh);

  const invalidLogin = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'IncorrectPassword123' }),
  });
  assert.equal(invalidLogin.status, 401);

  const logout = await fetch(`${baseUrl}/logout`, {
    method: 'POST',
    headers: { cookie: rotatedCookie },
  });
  assert.equal(logout.status, 204);

  const profileAfterLogout = await fetch(`${baseUrl}/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assert.equal(profileAfterLogout.status, 401);

  const refreshAfterLogout = await fetch(`${baseUrl}/refresh`, {
    method: 'POST',
    headers: { cookie: rotatedCookie },
  });
  assert.equal(refreshAfterLogout.status, 401);

  const login = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  getCookie(login);
  await getAccessToken(login);
});
