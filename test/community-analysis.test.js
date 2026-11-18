import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeGroups, groupSeries } from '../public/community-analysis.js';
test('BI pondera observações e diferencia amostra ausente de zero', () => {
  const rows = [{ day: 1, moods: { alegria: [9, 1, 0, 0] } }, { day: 2, moods: { alegria: [0, 0, 0, 2] } }];
  assert.deepEqual(summarizeGroups(rows, 'alegria'), { levels: [9, 1, 0, 2], total: 12, felt: 25, intense: 2 / 12 * 100 });
  assert.equal(summarizeGroups([], 'alegria').felt, null);
  assert.equal(summarizeGroups([rows[0]], 'alegria').intense, 0);
  assert.equal(groupSeries(rows, g => g.day, 'alegria').length, 2);
});
