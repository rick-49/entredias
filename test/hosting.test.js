import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { runtimeConfig } from '../config.js';

test('landing pública não exige senha nem banco e mantém a exportação antiga desabilitada', () => {
  const config = runtimeConfig(path.resolve('example-app'), { NODE_ENV: 'production' });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.password, '');
  assert.equal(config.dataDir, null);
  assert.equal(runtimeConfig(path.resolve('example-app'), { NODE_ENV: 'production', APP_PASSWORD: 'curta' }).password, '');
});

test('servidor distribui shell instalável sem banco e não recebe avaliações pessoais', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'diary-pwa-test-'));
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, NODE_ENV: 'production', ENABLE_LEGACY_EXPORT: '', APP_PASSWORD: '', DATA_DIR: dir, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const output = await Promise.race([
      once(child.stdout, 'data').then(([data]) => data.toString()),
      once(child, 'exit').then(([code]) => { throw new Error(`Servidor encerrou: ${code}`); }),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Timeout ao iniciar')), 10000); timer.unref(); }),
    ]);
    const base = output.match(/http:\/\/localhost:\d+/)[0];
    const request = (route, options = {}) => fetch(`${base}${route}`, { redirect: 'manual', ...options });
    const landing = await request('/'); assert.equal(landing.status, 200); assert.ok((await landing.text()).includes('Instalar no celular'));
    for (const route of ['/app', '/dashboard', '/dados', '/install.js', '/local-data.js', '/csv.js', '/landing.css', '/health']) assert.equal((await request(route)).status, 200);
    const manifest = await (await request('/manifest.webmanifest')).json();
    assert.equal(manifest.start_url, '/app'); assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) {
      const response = await request(icon.src); assert.equal(response.status, 200);
      assert.equal(Buffer.from(await response.arrayBuffer()).subarray(1, 4).toString(), 'PNG');
    }
    const sw = await request('/sw.js'); assert.equal(sw.headers.get('service-worker-allowed'), '/');
    const shell = (await sw.text()).match(/const SHELL = (\[[^;]+\])/)[1];
    const paths = [...shell.matchAll(/'([^']+)'/g)].map(match => match[1]);
    for (const route of paths) assert.equal((await request(route)).status, 200, route);
    assert.ok(paths.every(route => !route.startsWith('/api/')));
    assert.equal((await request('/api/assessments')).status, 410);
    assert.equal((await request('/api/assessments/00000000-0000-0000-0000-000000000000', { method: 'PUT', body: '{}' })).status, 410);
    assert.equal((await request('/api/legacy/backup')).status, 403);
    assert.ok(!existsSync(path.join(dir, 'diary.sqlite')));
  } finally {
    if (child.exitCode === null) { const ended = once(child, 'exit'); child.kill(); await ended; }
    rmSync(dir, { recursive: true, force: true });
  }
});
