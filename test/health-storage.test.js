import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MOODS, neutralMoods } from '../shared.js';
import { medicationSnapshot, intakeSnapshot, DEFAULT_REFERENCE } from '../health-model.js';

test('migra banco v1 sem perder dados, preserva esquema e tomadas no backup, sem restaurar consentimento', async () => {
  const oldId = randomUUID();
  await new Promise((resolve, reject) => {
    const request = indexedDB.open('entre-dias-local', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assessments', { keyPath: 'id' });
    request.onerror = reject;
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('assessments', 'readwrite');
      tx.objectStore('assessments').add({ id: oldId, date: '2026-11-01', time: '08:00', note: 'Registro anterior', moods: MOODS.slice(0, 12).map(m => ({ id: m.id, level: 0 })) });
      tx.oncomplete = () => { db.close(); resolve(); };
    };
  });
  const store = await import('../local-data.js');
  assert.equal((await store.allAssessments())[0].note, 'Registro anterior');
  assert.equal((await store.allAssessments())[0].moods.length, 14);
  const med = await store.addMedication({ id: randomUUID(), name: 'Exemplo', dose: 5, unit: 'mg', times: ['08:00'], startDate: '2026-11-01' });
  const intake = await store.addIntake({ id: randomUUID(), medicationId: med.id, name: med.name, dose: med.dose, unit: med.unit, date: '2026-11-02', time: '08:15' });
  const saved = await store.saveAssessment({ id: randomUUID(), date: '2026-11-02', time: '09:00', note: '', moods: neutralMoods([{ id: 'medo', level: 2 }]), medications: medicationSnapshot([med], '2026-11-02', '09:00'), medicationsRecorded: true, intakes: intakeSnapshot([intake], '2026-11-02', '09:00'), durationMinutes: 20 });
  await store.endMedication(med.id, '2026-11-02', '10:00');
  assert.equal((await store.allAssessments()).find(e => e.id === saved.id).medications[0].endDate, null);
  assert.equal((await store.allMedications())[0].endTime, '10:00');
  const backup = store.makeBackup(await store.allAssessments(), await store.allMedications(), DEFAULT_REFERENCE, { intakes: await store.allIntakes(), dailyReferences: { '2026-11-02': { moodId: 'alegria', level: 2 } }, contributionWithdrawalToken: 'a'.repeat(64) });
  globalThis.indexedDB = new IDBFactory();
  const other = await import('../local-data.js?new-device-health');
  await other.restoreBackup(backup);
  assert.equal((await other.allAssessments()).length, 2);
  assert.equal((await other.allMedications())[0].times[0], '08:00');
  assert.equal((await other.allIntakes())[0].time, '08:15');
  assert.equal(await other.getSetting('contributionConsent', false), false);
  assert.equal(await other.getSetting('contributionToken'), 'a'.repeat(64));
  assert.equal((await other.getSetting('dailyReferences'))['2026-11-02'].level, 2);
});
