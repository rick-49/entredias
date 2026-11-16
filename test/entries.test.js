import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOODS, validateAssessment, neutralMoods } from '../shared.js';

test('valida quatro níveis, datas e horários, sem aceitar humores duplicados', () => {
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
