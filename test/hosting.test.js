import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { runtimeConfig } from '../config.js';

test('produção exige senha e banco persistente fora do build; desenvolvimento continua local', () => {
  const root = path.resolve('example-app');
  const production = { NODE_ENV: 'production', APP_PASSWORD: 'senha-ficticia-para-teste' };
  assert.equal(runtimeConfig(root, {}).host, '127.0.0.1');
  assert.throws(() => runtimeConfig(root, { NODE_ENV: 'production' }), /APP_PASSWORD/);
  assert.throws(() => runtimeConfig(root, production), /DATA_DIR/);
  assert.throws(() => runtimeConfig(root, { ...production, DATA_DIR: 'data' }), /absoluto/);
  assert.throws(() => runtimeConfig(root, { ...production, DATA_DIR: path.join(root, 'data') }), /fora do código/);
  const hostingRoot = path.resolve('hosting-example', 'domains', 'diario.example', 'hbuilds', 'versions', '123', 'nodejs');
  const config = runtimeConfig(hostingRoot, production);
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.dataDir, path.resolve('hosting-example', 'domains', 'diario.example', 'entredias-data'));
});

test('hospedagem protege página, dados e CSV, autentica, encerra sessão e limita tentativas', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'diary-auth-test-'));
  const password = 'senha-ficticia-para-teste';
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, NODE_ENV: 'production', APP_PASSWORD: password, DATA_DIR: dir, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const [output] = await once(child.stdout, 'data');
    const base = output.toString().match(/http:\/\/localhost:\d+/)[0];
    const request = (route, options = {}) => fetch(`${base}${route}`, { redirect: 'manual', ...options });
    assert.equal((await request('/')).status, 303);
    assert.equal((await request('/dashboard')).status, 303);
    assert.equal((await request('/api/assessments')).status, 401);
    assert.equal((await request('/api/export.csv')).status, 401);
    assert.equal((await request('/health')).status, 200);
    assert.equal((await request('/login')).status, 200);
    const login = value => request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: value }) });
    assert.equal((await login('errada')).status, 401);
    assert.equal((await request('/api/login', { method: 'POST', body: '{}' })).status, 403);
    const response = await login(password);
    assert.equal(response.status, 200);
    const setCookie = response.headers.get('set-cookie');
    for (const flag of ['HttpOnly', 'SameSite=Strict', 'Secure']) assert.ok(setCookie.includes(flag));
    const cookie = setCookie.split(';')[0];
    assert.equal((await request('/api/assessments', { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await request('/api/export.csv', { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await request('/logout', { method: 'POST', headers: { Cookie: cookie } })).status, 303);
    assert.equal((await request('/api/assessments', { headers: { Cookie: cookie } })).status, 401);
    for (let i = 0; i < 10; i++) assert.equal((await login('errada')).status, 401);
    assert.equal((await login(password)).status, 429);
  } finally {
    if (child.exitCode === null) { const ended = once(child, 'exit'); child.kill(); await ended; }
    rmSync(dir, { recursive: true, force: true });
  }
});
