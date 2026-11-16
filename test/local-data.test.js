import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { allAssessments, saveAssessment, makeBackup, restoreBackup, prepareBackup } from '../local-data.js';

test('banco local persiste ao reabrir, separa instalações e restaura backup sem sobrescrever dados', async () => {
  const first = { id: randomUUID(), date: '2026-11-15', time: '08:30', moods: [{ id: 'alegria', level: 3 }], note: 'Resenha da manhã' };
  const second = { ...first, id: randomUUID(), time: '18:45', moods: [], note: 'Resenha da tarde' };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Dados locais não podem fazer requisições de rede.'); };
  try {
    assert.equal((await allAssessments()).length, 0);
    await saveAssessment(first); await saveAssessment(second);
    assert.equal((await allAssessments()).length, 2);
    assert.ok((await allAssessments()).find(e => e.id === second.id).moods.every(m => m.level === 0));
    await assert.rejects(saveAssessment({ ...first, time: '25:00' }));
    assert.equal((await allAssessments()).find(e => e.id === first.id).time, '08:30');
    const reopened = await import('../local-data.js?reopened');
    assert.equal((await reopened.allAssessments()).length, 2);
    const backup = makeBackup(await allAssessments());
    await saveAssessment({ ...first, note: 'Versão mais recente' });
    assert.deepEqual(await restoreBackup(backup), { imported: 0, skipped: 2 });
    assert.equal((await allAssessments()).find(e => e.id === first.id).note, 'Versão mais recente');
    const invalid = structuredClone(backup); invalid.assessments.push({ ...second, id: randomUUID(), time: '25:00' });
    await assert.rejects(restoreBackup(invalid));
    assert.equal((await allAssessments()).length, 2);
    globalThis.indexedDB = new IDBFactory();
    const otherPhone = await import('../local-data.js?otherPhone');
    assert.equal((await otherPhone.allAssessments()).length, 0);
    assert.deepEqual(await otherPhone.restoreBackup(backup), { imported: 2, skipped: 0 });
    assert.equal((await otherPhone.allAssessments()).find(e => e.id === first.id).note, 'Resenha da manhã');
    assert.equal((await allAssessments()).find(e => e.id === first.id).note, 'Versão mais recente');
  } finally { globalThis.fetch = previousFetch; }
});

test('backup rejeita formatos estranhos e IDs repetidos antes de abrir transação', () => {
  assert.throws(() => prepareBackup({ assessments: [] }));
  const record = { id: randomUUID(), date: '2026-11-15', time: null, moods: [], note: 'Registro antigo' };
  assert.equal(prepareBackup(makeBackup([record]))[0].time, null);
  assert.throws(() => prepareBackup(makeBackup([record, record])));
});
