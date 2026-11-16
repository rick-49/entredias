import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, dateRange } from '../analytics.js';

test('análise conta avaliações separadas, dias únicos e exclui neutros da frequência', () => {
  const assessments = [
    { id: 'a', date: '2026-11-15', time: '08:30', moods: [{ id: 'alegria', level: 3 }, { id: 'calma', level: 0 }] },
    { id: 'b', date: '2026-11-15', time: '19:00', moods: [{ id: 'alegria', level: 1 }, { id: 'ansiedade', level: 2 }] },
    { id: 'c', date: '2026-11-14', time: null, moods: [{ id: 'alegria', level: 0 }] },
    { id: 'd', date: '2026-11-13', time: '12:00', moods: [{ id: 'alegria', level: 3 }] },
  ];
  const result = analyze(assessments, '2026-11-14', '2026-11-15');
  assert.equal(result.days, 2);
  assert.equal(result.recordedDays, 2);
  assert.equal(result.records.length, 3);
  assert.deepEqual(result.records.map(e => e.id), ['b', 'a', 'c']);
  assert.equal(result.total, 3);
  assert.deepEqual(result.levels, [1, 1, 1]);
  assert.equal(result.ranking[0].id, 'alegria');
  assert.equal(result.ranking[0].count, 2);
  assert.ok(!result.ranking.some(m => m.id === 'calma'));
  assert.deepEqual(result.weekdays[0], { recorded: 1, possible: 1 });
});

test('datas atravessam ano e análise vazia não converte ausência em neutro', () => {
  assert.deepEqual(dateRange('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.equal(dateRange('2024-02-28', '2024-03-01').length, 3);
  const result = analyze([], '2026-11-01', '2026-11-30');
  assert.equal(result.days, 30);
  assert.equal(result.total, 0);
  assert.equal(result.recordedDays, 0);
  assert.deepEqual(result.ranking, []);
  assert.equal(result.weekdays.reduce((sum, day) => sum + day.possible, 0), 30);
});
