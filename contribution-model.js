import { MOODS, neutralMoods } from './shared.js';
import { treatmentDay } from './health-model.js';

export const CONTRIBUTION_VERSION = 1;
export const MIN_CONTRIBUTORS = 5;
const clean = value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

export function buildContribution(assessments, start, end, maxDay = 14) {
  const records = [];
  for (const entry of [...assessments].sort((a, b) => b.date.localeCompare(a.date))) {
    if (entry.source === 'reference' || entry.date < start || entry.date > end || !entry.medicationsRecorded) continue;
    for (const med of entry.medications || []) {
      const day = treatmentDay(entry.date, med.startDate);
      if (day < 1 || day > maxDay) continue;
      records.push({ id: `${entry.id}:${med.id}`, medication: clean(med.name), dose: `${med.dose} ${med.unit}`, day, concomitant: entry.medications.length > 1, moods: neutralMoods(entry.moods) });
    }
  }
  return records.slice(0, 500);
}

export function validateContribution(body) {
  if (!body || body.consentVersion !== CONTRIBUTION_VERSION || !/^[a-f0-9]{64}$/.test(body.token || '') || !Array.isArray(body.records) || !body.records.length || body.records.length > 500) throw new Error('Contribuição inválida.');
  const seen = new Set();
  return body.records.map(record => {
    if (!record || Object.keys(record).some(key => !['id', 'medication', 'dose', 'day', 'concomitant', 'moods'].includes(key))) throw new Error('A contribuição contém campos não permitidos.');
    if (!/^[a-f0-9-]{36}:[a-f0-9-]{36}$/i.test(record.id || '') || seen.has(record.id)) throw new Error('Identificador inválido na contribuição.');
    if (typeof record.medication !== 'string' || !record.medication.trim() || record.medication.length > 80 || /[\r\n<>]/.test(record.medication)) throw new Error('Nome de medicamento inválido.');
    if (typeof record.dose !== 'string' || !/^\d+(\.\d+)? (mg|mcg|g|mL|gotas|comprimidos|unidades)$/.test(record.dose) || record.dose.length > 40) throw new Error('Dosagem inválida.');
    if (!Number.isInteger(record.day) || record.day < 1 || record.day > 90 || typeof record.concomitant !== 'boolean') throw new Error('Dia de tratamento inválido.');
    if (!Array.isArray(record.moods) || record.moods.length !== MOODS.length || new Set(record.moods.map(m => m?.id)).size !== MOODS.length || record.moods.some(m => !MOODS.some(item => item.id === m?.id) || ![0, 1, 2, 3].includes(m.level) || Object.keys(m).some(key => !['id', 'level'].includes(key)))) throw new Error('Humores inválidos.');
    seen.add(record.id);
    return { id: record.id, medication: clean(record.medication), dose: record.dose, day: record.day, concomitant: record.concomitant, moods: neutralMoods(record.moods) };
  });
}

export function aggregateCommunity(rows, minimum = MIN_CONTRIBUTORS) {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.medication, row.dose, row.day]);
    if (!groups.has(key)) groups.set(key, { medication: row.medication, dose: row.dose, day: row.day, participants: new Set(), evaluations: 0, moods: Object.fromEntries(MOODS.map(m => [m.id, [0, 0, 0, 0]])) });
    const group = groups.get(key); group.participants.add(row.participant); group.evaluations++;
    for (const mood of row.moods) if (group.moods[mood.id]) group.moods[mood.id][mood.level]++;
  }
  return [...groups.values()].filter(group => group.participants.size >= minimum).map(group => ({ ...group, participants: group.participants.size })).sort((a, b) => a.medication.localeCompare(b.medication) || a.dose.localeCompare(b.dose) || a.day - b.day);
}
