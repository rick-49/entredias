import { MOODS } from './shared.js';

export function dateRange(start, end) {
  const result = [];
  const current = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (current <= last) { result.push(current.toISOString().slice(0, 10)); current.setUTCDate(current.getUTCDate() + 1); }
  return result;
}

export function analyze(assessments, start, end) {
  const records = assessments.filter(entry => entry.date >= start && entry.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '') || a.id.localeCompare(b.id));
  const counts = Object.fromEntries(MOODS.map(mood => [mood.id, { ...mood, count: 0, levels: [0, 0, 0] }]));
  const levels = [0, 0, 0];
  const weekdays = Array.from({ length: 7 }, () => ({ recorded: 0, possible: 0 }));
  const days = dateRange(start, end);
  for (const date of days) weekdays[new Date(`${date}T12:00:00Z`).getUTCDay()].possible++;
  const recordedDates = new Set(records.map(entry => entry.date));
  for (const date of recordedDates) weekdays[new Date(`${date}T12:00:00Z`).getUTCDay()].recorded++;
  for (const entry of records) for (const mood of entry.moods) {
    if (!counts[mood.id] || mood.level === 0) continue;
    counts[mood.id].count++;
    counts[mood.id].levels[mood.level - 1]++;
    levels[mood.level - 1]++;
  }
  const ranking = Object.values(counts).filter(mood => mood.count).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
  return { start, end, records, ranking, levels, total: levels.reduce((a, b) => a + b, 0), weekdays, days: days.length, recordedDays: recordedDates.size };
}
