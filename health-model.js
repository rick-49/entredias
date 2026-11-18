import { MOODS, validateEntry } from './shared.js';

export const DEFAULT_REFERENCE = { enabled: false, moodId: 'alegria', level: 1, start: '00:00', end: '23:59', durationMinutes: 20 };
export const validId = value => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
export const validDate = value => typeof value === 'string' && !validateEntry(value, { moods: [], note: '' });
export const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function normalizeMedication(input) {
  if (!input || !validId(input.id)) throw new Error('Identificador do medicamento inválido.');
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > 80) throw new Error('Informe o nome do medicamento, com até 80 caracteres.');
  const dose = Number(input.dose);
  if (!Number.isFinite(dose) || dose <= 0 || dose > 100000) throw new Error('Informe uma dosagem maior que zero.');
  if (!['mg', 'mcg', 'g', 'mL', 'gotas', 'comprimidos', 'unidades'].includes(input.unit)) throw new Error('Unidade de dosagem inválida.');
  const times = Array.isArray(input.times) ? input.times.map(time => typeof time === 'string' && /^\d{1,2}:\d{2}$/.test(time.trim()) ? time.trim().padStart(5, '0') : time) : [];
  if (!times.length || times.length > 12 || times.some(time => !validTime(time))) throw new Error('Informe de 1 a 12 horários válidos, separados por vírgula. Exemplo: 9:30, 20:00.');
  const startTime = input.startTime || '00:00', endTime = input.endTime || '23:59';
  if (!validTime(startTime) || !validTime(endTime) || !validDate(input.startDate) || (input.endDate != null && (!validDate(input.endDate) || `${input.endDate}T${endTime}` < `${input.startDate}T${startTime}`))) throw new Error('Período do medicamento inválido.');
  return { id: input.id, name, dose, unit: input.unit, times: [...new Set(times)].sort(), startDate: input.startDate, startTime, endDate: input.endDate || null, endTime };
}

export function medicationSnapshot(medications, date, time = '12:00') {
  const stamp = `${date}T${time}`;
  return medications.map(normalizeMedication).filter(med => `${med.startDate}T${med.startTime}` <= stamp && (!med.endDate || `${med.endDate}T${med.endTime}` >= stamp));
}
export function normalizeSnapshots(input) {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 30) throw new Error('Lista de medicamentos inválida.');
  const result = input.map(normalizeMedication);
  if (new Set(result.map(m => m.id)).size !== result.length) throw new Error('Medicamento repetido na avaliação.');
  return result;
}
export const medicationLabel = med => `${med.name} · ${med.dose} ${med.unit} · ${med.times.join(', ')}`;

export function normalizeIntake(input) {
  if (!input || !validId(input.id) || !validId(input.medicationId) || !validDate(input.date) || !validTime(input.time)) throw new Error('Tomada de medicamento inválida.');
  const med = normalizeMedication({ id: input.medicationId, name: input.name, dose: input.dose, unit: input.unit, times: [input.time], startDate: input.date });
  return { id: input.id, medicationId: input.medicationId, name: med.name, dose: med.dose, unit: med.unit, date: input.date, time: input.time };
}
export function intakeSnapshot(intakes, date, time) {
  if (!time) return [];
  const moment = Date.parse(`${date}T${time}:00`);
  return intakes.filter(intake => { const taken = Date.parse(`${intake.date}T${intake.time}:00`); return taken <= moment && moment - taken <= 24 * 3600000; }).map(normalizeIntake).sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}

export function normalizeReference(input = {}) {
  const ref = { ...DEFAULT_REFERENCE, ...input };
  if (typeof ref.enabled !== 'boolean' || !MOODS.some(m => m.id === ref.moodId) || ![0, 1, 2, 3].includes(ref.level) || !validTime(ref.start) || !validTime(ref.end) || ref.start > ref.end || !Number.isInteger(ref.durationMinutes) || ref.durationMinutes < 1 || ref.durationMinutes > 1440) throw new Error('Configuração do humor de referência inválida.');
  return { enabled: ref.enabled, moodId: ref.moodId, level: ref.level, start: ref.start, end: ref.end, durationMinutes: ref.durationMinutes };
}

export function referenceTimeline(assessments, date, reference, now = new Date()) {
  const ref = normalizeReference(reference);
  const actual = assessments.filter(e => e.date === date).map(e => ({ ...e, source: 'recorded' })).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  if (!ref.enabled) return actual;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (date > today) return actual;
  const minute = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const clock = value => value >= 1440 ? '24:00' : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const limit = date === today ? now.getHours() * 60 + now.getMinutes() : 1440;
  const end = Math.min(limit, minute(ref.end) + 1); let cursor = Math.min(minute(ref.start), end);
  const points = actual.filter(entry => entry.time && minute(entry.time) < end);
  const result = actual.filter(entry => !entry.time);
  function gap(from, to) {
    if (to <= from) return;
    result.push({ id: `reference-${date}-${clock(from)}`, date, time: clock(from), endTime: clock(to), minutes: to - from, source: 'reference', moods: [{ id: ref.moodId, level: ref.level }] });
  }
  for (let index = 0; index < points.length; index++) {
    const entry = points[index]; const start = Math.max(cursor, minute(entry.time));
    gap(cursor, start);
    const next = points[index + 1]?.time;
    const finish = Math.max(start, Math.min(end, minute(entry.time) + (entry.durationMinutes || ref.durationMinutes), next ? minute(next) : end));
    result.push({ ...entry, time: clock(start), originalTime: entry.time, endTime: clock(finish), minutes: finish - start });
    cursor = finish;
  }
  gap(cursor, end);
  return result.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

export function treatmentDay(date, startDate) {
  return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86400000) + 1;
}

export function medicationComparisons(assessments) {
  const groups = new Map();
  for (const entry of assessments) for (const med of entry.medications || []) {
    if (!groups.has(med.id)) groups.set(med.id, { ...med, evaluations: 0, first14: 0, moodTotals: Object.fromEntries(MOODS.map(m => [m.id, 0])) });
    const group = groups.get(med.id); group.evaluations++;
    const day = treatmentDay(entry.date, med.startDate);
    if (day >= 1 && day <= 14) group.first14++;
    entry.moods.filter(m => m.level > 0).forEach(m => group.moodTotals[m.id]++);
  }
  return [...groups.values()];
}
