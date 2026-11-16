import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { MOODS, validateAssessment, neutralMoods } from '../shared.js';

test('valida os quatro níveis, datas e horários, sem aceitar humores duplicados', () => {
  const base = { date: '2026-11-15', time: '08:30', moods: [], note: '' };
  for (const mood of MOODS) for (const level of [0, 1, 2, 3]) assert.equal(validateAssessment({ ...base, moods: [{ id: mood.id, level }] }), null);
  for (const time of ['24:00', '12:60', '8:30', '', null, undefined]) assert.ok(validateAssessment({ ...base, time }));
  assert.equal(validateAssessment({ ...base, time: null }, true), null);
  assert.ok(validateAssessment({ ...base, date: '2026-02-30' }));
  assert.ok(validateAssessment({ ...base, note: 'x'.repeat(2001) }));
  assert.ok(validateAssessment({ ...base, moods: [{ id: 'alegria', level: 4 }] }));
  assert.ok(validateAssessment({ ...base, moods: [{ id: 'alegria', level: 2 }, { id: 'alegria', level: 1 }] }));
  assert.deepEqual(neutralMoods().map(m => m.level), Array(MOODS.length).fill(0));
});

test('API preserva várias avaliações no mesmo dia e horário, neutros, edições e CSV após reiniciar', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'entre-dias-test-'));
  let child; let base;
  async function start() {
    child = spawn(process.execPath, ['server.js'], { env: { ...process.env, DATA_DIR: dir, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const output = await Promise.race([
      once(child.stdout, 'data').then(([data]) => data.toString()),
      once(child, 'exit').then(([code]) => { throw new Error(`Servidor encerrou: ${code}`); }),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Servidor não iniciou')), 10000); timer.unref(); }),
    ]);
    base = output.match(/http:\/\/localhost:\d+/)[0];
  }
  async function stop() { if (child && child.exitCode === null) { const ended = once(child, 'exit'); child.kill(); await ended; } }
  const put = (id, value) => fetch(`${base}/api/assessments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  const first = randomUUID(), second = randomUUID(), neutral = randomUUID();
  const entry = { date: '2026-11-15', time: '08:30', moods: [{ id: 'alegria', level: 3 }], note: '  Manhã tranquila.  ' };
  try {
    await start();
    for (const route of ['/', '/dashboard', '/dashboard.js', '/dashboard.css', '/analytics.js', '/mobile.css']) assert.equal((await fetch(`${base}${route}`)).status, 200);
    assert.equal((await put(first, entry)).status, 200);
    assert.equal((await put(second, { ...entry, moods: [{ id: 'ansiedade', level: 2 }], note: 'Outra avaliação no mesmo horário' })).status, 200);
    assert.equal((await put(neutral, { ...entry, time: '18:45', moods: [], note: '' })).status, 200);
    assert.equal((await put(first, { ...entry, note: 'Resenha editada' })).status, 200);
    await stop(); await start();
    const stored = await (await fetch(`${base}/api/assessments`)).json();
    assert.equal(stored.length, 3);
    assert.equal(stored.find(e => e.id === first).note, 'Resenha editada');
    assert.equal(stored.find(e => e.id === second).note, 'Outra avaliação no mesmo horário');
    assert.ok(stored.find(e => e.id === neutral).moods.every(m => m.level === 0));
    assert.equal(stored[0].time, '18:45');
    const exported = await fetch(`${base}/api/export.csv`);
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get('content-type'), /text\/csv/);
    const csv = await exported.text();
    assert.ok(csv.includes('"08:30"'));
    assert.ok(csv.includes('"Alegria";"III";"Intensa"'));
    assert.ok(csv.includes('"Neutro";"Não estou sentindo"'));
    assert.equal((await put(first, { ...entry, time: '25:00' })).status, 400);
    assert.equal((await put(first, { ...entry, time: null })).status, 400);
    assert.equal((await fetch(`${base}/api/assessments/${first}`, { method: 'PUT', body: '{invalid' })).status, 400);
    assert.equal((await fetch(`${base}/api/entries/2026-11-15`, { method: 'PUT', body: '{}' })).status, 410);
    assert.equal((await fetch(`${base}/api/assessments/${neutral}`, { method: 'DELETE' })).status, 200);
    assert.equal((await (await fetch(`${base}/api/assessments`)).json()).length, 2);
  } finally { await stop(); rmSync(dir, { recursive: true, force: true }); }
});
