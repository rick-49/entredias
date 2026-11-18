import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MOODS, neutralMoods } from '../shared.js';
import { DEFAULT_REFERENCE, normalizeMedication, medicationSnapshot, intakeSnapshot, referenceTimeline, medicationComparisons } from '../health-model.js';
import { buildContribution, validateContribution, aggregateCommunity } from '../contribution-model.js';
import { reminderDue, validatePush } from '../reminder-model.js';
import { jsPDF } from 'jspdf';
import { createMedicalReport } from '../pdf-report.js';

const medication = (extras = {}) => normalizeMedication({ id: randomUUID(), name: 'Medicamento de exemplo', dose: 5, unit: 'mg', times: ['08:00'], startDate: '2026-11-01', ...extras });
const record = (extras = {}) => ({ id: randomUUID(), date: '2026-11-05', time: '14:30', moods: neutralMoods([{ id: 'ansiedade', level: 2 }]), note: 'RESENHA_SIGILOSA_TESTE', medications: [], medicationsRecorded: true, ...extras });

test('horários dos esquemas são versionados e tomadas respeitam o momento da avaliação', () => {
  const before = medication({ endDate: '2026-11-05', endTime: '09:59' });
  const after = medication({ startDate: '2026-11-05', startTime: '10:00', times: ['15:00'] });
  assert.deepEqual(medicationSnapshot([before, after], '2026-11-05', '09:59').map(m => m.id), [before.id]);
  assert.deepEqual(medicationSnapshot([before, after], '2026-11-05', '10:00').map(m => m.id), [after.id]);
  const intake = { id: randomUUID(), medicationId: before.id, name: before.name, dose: 5, unit: 'mg', date: '2026-11-05', time: '08:10' };
  assert.equal(intakeSnapshot([intake], '2026-11-05', '08:09').length, 0);
  assert.equal(intakeSnapshot([intake], '2026-11-05', '08:10').length, 1);
  assert.equal(intakeSnapshot([intake], '2026-11-06', '08:11').length, 0);
  assert.throws(() => medication({ startTime: '25:00' }));
});

test('lacunas de 24h usam referência sem transformar estimativas em avaliações', () => {
  const entries = [record(), record({ time: '16:30', moods: neutralMoods([{ id: 'humor-deprimido', level: 3 }]) })];
  const timeline = referenceTimeline(entries, '2026-11-05', { ...DEFAULT_REFERENCE, enabled: true }, new Date('2026-11-07T12:00:00'));
  assert.deepEqual(timeline.map(e => [e.time, e.endTime, e.source]), [
    ['00:00', '14:30', 'reference'], ['14:30', '14:50', 'recorded'], ['14:50', '16:30', 'reference'], ['16:30', '16:50', 'recorded'], ['16:50', '24:00', 'reference'],
  ]);
  assert.equal(timeline.reduce((sum, e) => sum + e.minutes, 0), 1440);
  assert.equal(timeline.filter(e => e.source === 'recorded').length, entries.length);
  assert.equal(entries.length, 2);
  const overlapping = referenceTimeline([entries[0], record({ time: '14:40' })], '2026-11-05', { ...DEFAULT_REFERENCE, enabled: true }, new Date('2026-11-07T12:00:00'));
  assert.equal(overlapping.find(e => e.id === entries[0].id).endTime, '14:40');
});

test('contribuição exclui resenha, data, horário, estimativas e dados fora da janela', () => {
  const med = medication(); const entry = record({ medications: [med] });
  const records = buildContribution([entry, record({ date: '2026-11-25', medications: [med] }), { ...entry, id: randomUUID(), source: 'reference' }], '2026-11-01', '2026-11-30', 14);
  assert.equal(records.length, 1); assert.equal(records[0].day, 5);
  assert.ok(!JSON.stringify(records).includes('RESENHA')); assert.ok(!JSON.stringify(records).includes('2026-11-05')); assert.ok(!JSON.stringify(records).includes('14:30'));
  const valid = { token: 'a'.repeat(64), consentVersion: 1, records };
  assert.equal(validateContribution(valid).length, 1);
  assert.throws(() => validateContribution({ ...valid, records: [{ ...records[0], note: 'privada' }] }));
  assert.equal(medicationComparisons([entry])[0].first14, 1);
});

test('painel geral não publica grupos com menos de cinco instalações', () => {
  const base = { medication: 'exemplo', dose: '5 mg', day: 1, moods: neutralMoods() };
  assert.equal(aggregateCommunity(Array.from({ length: 4 }, (_, index) => ({ ...base, participant: String(index) }))).length, 0);
  const groups = aggregateCommunity(Array.from({ length: 5 }, (_, index) => ({ ...base, participant: String(index) })));
  assert.equal(groups.length, 1); assert.equal(groups[0].participants, 5); assert.equal(groups[0].moods.medo[0], 5);
  assert.equal(groups[0].moods.raiva[0], 5);
});

test('lembrete usa o fuso do aparelho, uma vez por dia, e recusa endpoints internos', () => {
  const reminder = { time: '18:00', timezone: 'America/Sao_Paulo', lastDay: null };
  assert.equal(reminderDue(reminder, new Date('2026-11-17T20:59:00Z')), null);
  assert.equal(reminderDue(reminder, new Date('2026-11-17T21:00:00Z')), '2026-11-17');
  assert.equal(reminderDue({ ...reminder, lastDay: '2026-11-17' }, new Date('2026-11-17T21:00:00Z')), null);
  assert.equal(reminderDue(reminder, new Date('2026-11-17T23:00:00Z')), null);
  assert.throws(() => validatePush({ token: 'a'.repeat(64), time: '18:00', timezone: reminder.timezone, subscription: { endpoint: 'https://127.0.0.1/private', keys: {} } }));
});

test('PDF omite completamente a resenha quando a opção está desligada', () => {
  const med = medication(); const entry = record({ medications: [med] });
  const options = { assessments: [entry], medications: [med], start: '2026-11-01', end: '2026-11-30' };
  const without = createMedicalReport(jsPDF, { ...options, includeNotes: false }).output();
  const withNotes = createMedicalReport(jsPDF, { ...options, includeNotes: true }).output();
  assert.ok(!without.includes('RESENHA_SIGILOSA_TESTE'));
  assert.ok(withNotes.includes('RESENHA_SIGILOSA_TESTE'));
  assert.ok(withNotes.startsWith('%PDF-'));
  assert.ok(without.includes('14:30'));
  assert.ok(MOODS.some(m => m.id === 'raiva') && MOODS.some(m => m.id === 'medo'));
});
