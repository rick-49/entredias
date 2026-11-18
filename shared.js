export const MOODS = [
  { id: 'alegria', name: 'Alegria', icon: '☀', color: 'yellow' },
  { id: 'calma', name: 'Calma', icon: '❋', color: 'green' },
  { id: 'gratidao', name: 'Gratidão', icon: '♡', color: 'pink' },
  { id: 'disposicao', name: 'Disposição', icon: '↗', color: 'orange' },
  { id: 'ansiedade', name: 'Ansiedade', icon: '≈', color: 'purple' },
  { id: 'tristeza', name: 'Tristeza', icon: '☂', color: 'blue' },
  { id: 'humor-deprimido', name: 'Humor deprimido', icon: '☁', color: 'slate' },
  { id: 'agitacao', name: 'Agitação', icon: 'ϟ', color: 'orange' },
  { id: 'irritacao', name: 'Irritação', icon: '✳', color: 'pink' },
  { id: 'cansaco', name: 'Cansaço', icon: '☾', color: 'slate' },
  { id: 'estresse', name: 'Estresse', icon: '⌁', color: 'purple' },
  { id: 'solidao', name: 'Solidão', icon: '◌', color: 'blue' },
  { id: 'raiva', name: 'Raiva', icon: '♨', color: 'orange' },
  { id: 'medo', name: 'Medo', icon: '◇', color: 'purple' },
];

export function validateEntry(date, input) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) return 'Data inválida.';
  if (!input || !Array.isArray(input.moods) || typeof input.note !== 'string') return 'Registro inválido.';
  if (input.note.length > 2000) return 'A anotação deve ter até 2.000 caracteres.';
  const ids = new Set();
  for (const mood of input.moods) {
    if (!mood || !MOODS.some(m => m.id === mood.id) || ![0, 1, 2, 3].includes(mood.level) || ids.has(mood.id)) return 'Humor ou intensidade inválidos.';
    ids.add(mood.id);
  }
  return null;
}

export function neutralMoods(moods = []) {
  return MOODS.map(mood => ({ id: mood.id, level: moods.find(item => item.id === mood.id)?.level ?? 0 }));
}

export function validateAssessment(input, allowUnknownTime = false) {
  if (!input || typeof input.date !== 'string') return 'Data inválida.';
  const error = validateEntry(input.date, input);
  if (error) return error;
  if (input.time === null && allowUnknownTime) return null;
  if (typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return 'Informe um horário válido (HH:MM).';
  return null;
}
