import { MOODS, neutralMoods } from './shared.js';

function cell(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function entriesToCsv(assessments) {
  const rows = [['Avaliação', 'Data', 'Horário', 'Dia da semana', 'Humor', 'Nível', 'Intensidade', 'Resenha', 'Atualizado em', 'Medicamentos no registro', 'Tomadas informadas nas últimas 24h', 'Duração (minutos)', 'Origem da duração']];
  const romans = ['Neutro', 'I', 'II', 'III'];
  const intensities = ['Não estou sentindo', 'Leve', 'Moderada', 'Intensa'];
  for (const entry of [...assessments].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '') || a.id.localeCompare(b.id))) {
    const weekday = new Date(`${entry.date}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
    for (const mood of neutralMoods(entry.moods)) {
      rows.push([entry.id, entry.date, entry.time ?? 'Não informado (registro antigo)', weekday,
        MOODS.find(m => m.id === mood.id).name, romans[mood.level], intensities[mood.level], entry.note, entry.updatedAt,
        entry.medicationsRecorded ? (entry.medications || []).map(m => `${m.name} ${m.dose} ${m.unit}; horários ${m.times.join(', ')}`).join(' | ') || 'Nenhum cadastrado' : 'Não informado',
        (entry.intakes || []).map(i => `${i.date} ${i.time}: ${i.name} ${i.dose} ${i.unit}`).join(' | '), entry.durationMinutes || 20, entry.durationSource === 'reported' ? 'Informada' : 'Estimada']);
    }
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
