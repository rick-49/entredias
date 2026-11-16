import { neutralMoods, validateAssessment } from './shared.js';

export function prepareBackup(input) {
  if (!input || input.app !== 'entre-dias' || input.version !== 1 || !Array.isArray(input.assessments)) throw new Error('Este arquivo não é um backup válido do Entre dias.');
  if (input.assessments.length > 25000) throw new Error('O backup excede o limite de 25 mil avaliações.');
  const ids = new Set();
  return input.assessments.map(entry => {
    if (!entry || typeof entry.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(entry.id) || ids.has(entry.id)) throw new Error('O backup contém avaliações inválidas ou duplicadas.');
    const error = validateAssessment(entry, true);
    if (error) throw new Error(error);
    ids.add(entry.id);
    return { id: entry.id, date: entry.date, time: entry.time, note: entry.note.trim(), moods: neutralMoods(entry.moods), updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString() };
  });
}

export function makeBackup(assessments) {
  return { app: 'entre-dias', version: 1, exportedAt: new Date().toISOString(), assessments };
}

let connection;
function database() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('Este navegador não permite salvar dados locais. Abra o app no Safari ou Chrome fora do modo privado.')); return; }
    const request = indexedDB.open('entre-dias-local', 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('assessments', { keyPath: 'id' });
      store.createIndex('date', 'date');
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = null; };
      resolve(db);
    };
    request.onerror = () => reject(new Error('Não foi possível abrir o banco local. Confira o espaço disponível e as permissões do navegador.'));
    request.onblocked = () => reject(new Error('Feche outras abas do Entre dias e tente novamente.'));
  }).catch(error => { connection = null; throw error; });
  return connection;
}

export async function allAssessments() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('assessments', 'readonly');
    const request = transaction.objectStore('assessments').getAll();
    transaction.oncomplete = () => resolve(request.result.sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '')));
    transaction.onabort = transaction.onerror = () => reject(new Error('Não foi possível ler os dados deste dispositivo.'));
  });
}

export async function saveAssessment(input) {
  const db = await database();
  const record = { id: input.id, date: input.date, time: input.time, moods: neutralMoods(input.moods), note: input.note.trim(), updatedAt: new Date().toISOString() };
  if (typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.id)) throw new Error('Identificador da avaliação inválido.');
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('assessments', 'readwrite');
    const store = transaction.objectStore('assessments');
    let validationError;
    const previous = store.get(input.id);
    previous.onsuccess = () => {
      validationError = validateAssessment(input, previous.result?.time === null);
      if (validationError) { transaction.abort(); return; }
      store.put(record);
    };
    transaction.oncomplete = () => resolve(record);
    transaction.onabort = transaction.onerror = () => reject(new Error(validationError || 'Não foi possível salvar neste dispositivo. Confira o espaço disponível.'));
  });
}

export async function restoreBackup(input) {
  const records = prepareBackup(input);
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('assessments', 'readwrite');
    const store = transaction.objectStore('assessments');
    let imported = 0;
    for (const entry of records) {
      const request = store.get(entry.id);
      request.onsuccess = () => { if (!request.result) { store.add(entry); imported++; } };
    }
    transaction.oncomplete = () => resolve({ imported, skipped: records.length - imported });
    transaction.onabort = transaction.onerror = () => reject(new Error('A restauração não foi concluída. Os dados anteriores foram preservados.'));
  });
}

export function downloadFile(contents, type, filename) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
