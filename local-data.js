import { neutralMoods, validateAssessment } from './shared.js';
import { DEFAULT_REFERENCE, normalizeMedication, normalizeSnapshots, normalizeReference, normalizeIntake, validDate, validTime } from './health-model.js';

export function prepareBackup(input) {
  if (!input || input.app !== 'entre-dias' || ![1, 2].includes(input.version) || !Array.isArray(input.assessments)) throw new Error('Este arquivo não é um backup válido do Entre dias.');
  if (input.assessments.length > 25000) throw new Error('O backup excede o limite de 25 mil avaliações.');
  const ids = new Set();
  return input.assessments.map(entry => {
    if (!entry || typeof entry.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(entry.id) || ids.has(entry.id)) throw new Error('O backup contém avaliações inválidas ou duplicadas.');
    const error = validateAssessment(entry, true);
    if (error) throw new Error(error);
    ids.add(entry.id);
    if (entry.intakes && (!Array.isArray(entry.intakes) || entry.intakes.length > 200)) throw new Error('Tomadas do backup inválidas.');
    return { id: entry.id, date: entry.date, time: entry.time, note: entry.note.trim(), moods: neutralMoods(entry.moods), medications: normalizeSnapshots(entry.medications), medicationsRecorded: entry.medicationsRecorded === true, intakes: (entry.intakes || []).map(normalizeIntake), durationMinutes: validDuration(entry.durationMinutes), durationSource: entry.durationSource === 'reported' ? 'reported' : 'estimated', updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString() };
  });
}

export function makeBackup(assessments, medications = [], reference = {}, extras = {}) {
  return { app: 'entre-dias', version: 2, exportedAt: new Date().toISOString(), assessments, medications, reference: normalizeReference(reference), intakes: extras.intakes || [], dailyReferences: extras.dailyReferences || {}, contributionWithdrawalToken: extras.contributionWithdrawalToken || null };
}

let connection;
function database() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('Este navegador não permite salvar dados locais. Abra o app no Safari ou Chrome fora do modo privado.')); return; }
    const request = indexedDB.open('entre-dias-local', 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('assessments')) { const store = db.createObjectStore('assessments', { keyPath: 'id' }); store.createIndex('date', 'date'); }
      if (!db.objectStoreNames.contains('medications')) db.createObjectStore('medications', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('intakes')) db.createObjectStore('intakes', { keyPath: 'id' });
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
    transaction.oncomplete = () => resolve(request.result.map(entry => ({ ...entry, moods: neutralMoods(entry.moods), medications: entry.medications || [] })).sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '')));
    transaction.onabort = transaction.onerror = () => reject(new Error('Não foi possível ler os dados deste dispositivo.'));
  });
}

export async function saveAssessment(input) {
  const db = await database();
  const record = { id: input.id, date: input.date, time: input.time, moods: neutralMoods(input.moods), note: input.note.trim(), medications: normalizeSnapshots(input.medications), medicationsRecorded: input.medicationsRecorded === true, intakes: (input.intakes || []).map(normalizeIntake), durationMinutes: validDuration(input.durationMinutes), durationSource: input.durationSource === 'reported' ? 'reported' : 'estimated', updatedAt: new Date().toISOString() };
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

function validDuration(value = 20) {
  if (!Number.isInteger(value) || value < 1 || value > 1440) throw new Error('Duração da avaliação deve ser de 1 a 1.440 minutos.');
  return value;
}

export async function restoreBackup(input) {
  const records = prepareBackup(input);
  const medications = input.version === 2 ? (Array.isArray(input.medications) && input.medications.length <= 500 ? input.medications.map(normalizeMedication) : (() => { throw new Error('Lista de medicamentos do backup inválida.'); })()) : [];
  const reference = input.version === 2 ? normalizeReference(input.reference) : null;
  if (input.intakes && (!Array.isArray(input.intakes) || input.intakes.length > 25000)) throw new Error('Lista de tomadas inválida.');
  const intakes = (input.intakes || []).map(normalizeIntake);
  const dailyReferences = {};
  for (const [date, value] of Object.entries(input.dailyReferences || {})) { if (!validDate(date)) throw new Error('Referência diária inválida.'); const ref = normalizeReference({ ...DEFAULT_REFERENCE, ...value }); dailyReferences[date] = { date, moodId: ref.moodId, level: ref.level }; }
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['assessments', 'medications', 'settings', 'intakes'], 'readwrite');
    const store = transaction.objectStore('assessments');
    let imported = 0;
    for (const entry of records) {
      const request = store.get(entry.id);
      request.onsuccess = () => { if (!request.result) { store.add(entry); imported++; } };
    }
    const meds = transaction.objectStore('medications');
    for (const med of medications) { const request = meds.get(med.id); request.onsuccess = () => { if (!request.result) meds.add(med); }; }
    if (reference) { const settings = transaction.objectStore('settings'); const request = settings.get('reference'); request.onsuccess = () => { if (!request.result) settings.add({ key: 'reference', value: reference }); }; }
    const intakeStore = transaction.objectStore('intakes');
    for (const intake of intakes) { const request = intakeStore.get(intake.id); request.onsuccess = () => { if (!request.result) intakeStore.add(intake); }; }
    const settings = transaction.objectStore('settings');
    const daily = settings.get('dailyReferences'); daily.onsuccess = () => settings.put({ key: 'dailyReferences', value: { ...dailyReferences, ...(daily.result?.value || {}) } });
    if (/^[a-f0-9]{64}$/.test(input.contributionWithdrawalToken || '')) { const token = settings.get('contributionToken'); token.onsuccess = () => { if (!token.result) settings.put({ key: 'contributionToken', value: input.contributionWithdrawalToken }); }; }
    transaction.oncomplete = () => resolve({ imported, skipped: records.length - imported });
    transaction.onabort = transaction.onerror = () => reject(new Error('A restauração não foi concluída. Os dados anteriores foram preservados.'));
  });
}

export async function allMedications() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('medications', 'readonly'); const request = tx.objectStore('medications').getAll();
    tx.oncomplete = () => resolve(request.result.sort((a, b) => b.startDate.localeCompare(a.startDate)));
    tx.onerror = tx.onabort = () => reject(new Error('Não foi possível ler os medicamentos.'));
  });
}
export async function addMedication(input) {
  const med = normalizeMedication(input); const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('medications', 'readwrite'); tx.objectStore('medications').add(med);
    tx.oncomplete = () => resolve(med); tx.onabort = tx.onerror = () => reject(new Error('Não foi possível cadastrar o medicamento.'));
  });
}
export async function endMedication(id, date, time = '23:59') {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('medications', 'readwrite'); const store = tx.objectStore('medications'); const request = store.get(id);
    let error;
    request.onsuccess = () => { if (!request.result || !validDate(date) || !validTime(time) || `${date}T${time}` < `${request.result.startDate}T${request.result.startTime || '00:00'}`) { error = 'Data ou hora de encerramento inválida.'; tx.abort(); return; } store.put({ ...request.result, endDate: date, endTime: time }); };
    tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(new Error(error || 'Não foi possível encerrar o medicamento.'));
  });
}

export async function allIntakes() {
  const db = await database();
  return new Promise((resolve, reject) => { const tx = db.transaction('intakes', 'readonly'); const request = tx.objectStore('intakes').getAll(); tx.oncomplete = () => resolve(request.result.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))); tx.onabort = tx.onerror = () => reject(new Error('Não foi possível ler as tomadas.')); });
}
export async function addIntake(input) {
  const intake = normalizeIntake(input); const db = await database();
  return new Promise((resolve, reject) => { const tx = db.transaction('intakes', 'readwrite'); tx.objectStore('intakes').add(intake); tx.oncomplete = () => resolve(intake); tx.onabort = tx.onerror = () => reject(new Error('Não foi possível registrar a tomada.')); });
}
export async function getSetting(key, fallback = null) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly'); const request = tx.objectStore('settings').get(key);
    tx.oncomplete = () => resolve(request.result?.value ?? fallback); tx.onabort = tx.onerror = () => reject(new Error('Não foi possível ler as configurações.'));
  });
}
export async function setSetting(key, value) {
  if (key === 'reference') value = normalizeReference(value);
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite'); tx.objectStore('settings').put({ key, value });
    tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(new Error('Não foi possível salvar a configuração.'));
  });
}

export function downloadFile(contents, type, filename) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
