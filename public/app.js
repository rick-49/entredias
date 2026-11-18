import { translate as t, locale } from '/i18n.js';
import { MOODS, neutralMoods, validateEntry } from '/shared.js';
import { allAssessments, allMedications, allIntakes, getSetting, setSetting, saveAssessment, downloadFile } from '/local-data.js';
import { medicationSnapshot, medicationLabel, intakeSnapshot, validDate, DEFAULT_REFERENCE, referenceTimeline } from '/health-model.js';
import { askDailyReference } from '/reference-dialog.js';
import { queueContribution, syncPendingContribution } from '/contribute.js';
import { entriesToCsv } from '/csv.js';
import { requireInstalled } from '/install.js';
await requireInstalled();

const $ = selector => document.querySelector(selector);
const romans = ['Neutro', 'I', 'II', 'III'];
const levels = ['Não estou sentindo', 'Leve', 'Moderada', 'Intensa'];
const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromKey = date => new Date(`${date}T12:00:00`);
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const monday = date => addDays(date, -((date.getDay() + 6) % 7));
const today = key(new Date());
const params = new URLSearchParams(location.search);
const requestedDate = params.get('date');
let selected = requestedDate && !validateEntry(requestedDate, { moods: [], note: '' }) ? requestedDate : today;
let weekStart = monday(fromKey(selected));
let assessments = [];
let draft = null;
let dirty = false;
let saving = false;
let ready = false;
let medications = [];
let reference = DEFAULT_REFERENCE;
let dailyReferences = {};
let intakes = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function dayAssessments(date = selected) {
  return assessments.filter(entry => entry.date === date).sort((a, b) => (b.time || '').localeCompare(a.time || '') || a.id.localeCompare(b.id));
}
function setStatus(message, error = false) {
  $('#save-status').textContent = message;
  $('#save-status').classList.toggle('error', error);
  $('#editor-status').textContent = message;
  $('#editor-status').classList.toggle('error', error);
}
function mayDiscard() {
  return !dirty || window.confirm(t('Há uma avaliação não salva. Deseja descartar as alterações?'));
}
function renderCalendar() {
  const end = addDays(weekStart, 6);
  const format = date => date.toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
  $('#week-range').textContent = `${format(weekStart)} a ${format(end)} de ${end.getFullYear()}`;
  $('#week-grid').replaceChildren();
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dateKey = key(date);
    const records = dayAssessments(dateKey);
    const button = el('button', `day-card${dateKey === selected ? ' selected' : ''}${dateKey === today ? ' is-today' : ''}`);
    button.type = 'button'; button.disabled = saving || !ready;
    button.setAttribute('aria-pressed', String(dateKey === selected));
    button.setAttribute('aria-label', `${format(date)}, ${records.length} avaliações${dateKey === today ? ', hoje' : ''}`);
    button.append(el('span', 'day-name', dayNames[date.getDay()]), el('span', 'day-number', date.getDate()));
    const dots = el('span', 'day-dots');
    const ids = [...new Set(records.flatMap(entry => entry.moods.filter(m => m.level > 0).map(m => m.id)))];
    ids.slice(0, 4).forEach(id => dots.append(el('i', `mood-dot ${MOODS.find(m => m.id === id).color}`)));
    if (!ids.length) dots.append(el('span', 'empty-day', records.length ? '○' : '—'));
    button.append(dots, el('span', 'day-caption', records.length ? `${records.length} aval.` : dateKey === today ? 'Hoje' : ''));
    button.addEventListener('click', () => selectDate(dateKey));
    $('#week-grid').append(button);
  }
  const weekDates = Array.from({ length: 7 }, (_, i) => key(addDays(weekStart, i)));
  const records = assessments.filter(entry => weekDates.includes(entry.date));
  const days = new Set(records.map(entry => entry.date)).size;
  $('#week-count').textContent = `${days} de 7 dias`;
  $('#recorded-count').textContent = days;
  $('#progress-fill').style.width = `${days / 7 * 100}%`;
  $('#week-assessments').textContent = `${records.length} ${records.length === 1 ? 'avaliação' : 'avaliações'} nesta semana`;
  const counts = {};
  records.forEach(entry => entry.moods.filter(m => m.level > 0).forEach(m => { counts[m.id] = (counts[m.id] || 0) + 1; }));
  $('#frequent-moods').replaceChildren();
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!top.length) $('#frequent-moods').append(el('p', 'empty-summary', 'Os humores de I a III aparecerão aqui. Neutro significa não estar sentindo.'));
  for (const [id, count] of top) {
    const mood = MOODS.find(m => m.id === id);
    const row = el('div', 'frequent-row');
    row.append(el('span', `mood-symbol ${mood.color}`, mood.icon), el('span', '', mood.name), el('small', '', `${count} aval.`));
    $('#frequent-moods').append(row);
  }
}
function renderDay() {
  $('#day-title').textContent = fromKey(selected).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
  const records = dayAssessments();
  $('#day-count').textContent = `${records.length} ${records.length === 1 ? 'avaliação' : 'avaliações'}`;
  $('#assessment-list').replaceChildren();
  if (!records.length) $('#assessment-list').append(el('p', 'day-empty', 'Como foi este momento do seu dia? Toque em “Iniciar avaliação” para registrar.'));
  for (const entry of records) {
    const card = el('article', `assessment-card${draft?.id === entry.id ? ' editing' : ''}`);
    const heading = el('div', 'assessment-card-heading');
    heading.append(el('strong', '', entry.time ?? 'Horário não informado'), el('span', '', entry.time === null ? 'Registro antigo' : 'Avaliação salva'));
    const edit = el('button', 'today-button', 'Editar');
    edit.disabled = saving; edit.setAttribute('aria-label', `Editar avaliação ${entry.time ?? 'antiga'}`);
    edit.addEventListener('click', () => openAssessment(entry));
    heading.append(edit);
    const chips = el('div', 'assessment-chips');
    const active = entry.moods.filter(m => m.level > 0);
    for (const item of active) {
      const mood = MOODS.find(m => m.id === item.id);
      chips.append(el('span', `history-pill ${mood.color}`, `${mood.name} ${romans[item.level]}`));
    }
    if (!active.length) chips.append(el('span', 'neutral-chip', 'Todos os humores neutros'));
    else chips.append(el('span', 'neutral-chip', `${MOODS.length - active.length} neutros`));
    card.append(heading, chips, el('p', 'assessment-note', entry.note || 'Sem resenha neste horário.'));
    card.append(el('p', 'medication-caption', entry.medicationsRecorded ? (entry.medications?.length ? entry.medications.map(medicationLabel).join(' | ') : 'Nenhum medicamento cadastrado em uso nesta avaliação.') : 'Medicamentos não informados neste registro antigo.'));
    $('#assessment-list').append(card);
  }
  $('#editor').hidden = !draft;
  $('#new-assessment').disabled = saving || !ready;
  const dayReference = dailyReferences[selected] ? { ...reference, ...dailyReferences[selected], enabled: true } : reference;
  const gaps = referenceTimeline(assessments, selected, dayReference).filter(point => point.source === 'reference');
  $('#reference-summary').textContent = gaps.length ? `${gaps.length} ${gaps.length === 1 ? 'intervalo sem avaliação usa' : 'intervalos sem avaliação usam'} ${MOODS.find(m => m.id === dayReference.moodId).name} ${romans[dayReference.level]} como referência estimada. As avaliações ocupam a duração informada (padrão de ${reference.durationMinutes} min). Veja no dashboard.` : 'Você pode configurar um humor de referência para comparar as lacunas de horários.';
}
function renderMoods() {
  const grid = $('#mood-grid');
  const focusId = document.activeElement?.dataset.mood;
  const focusLevel = document.activeElement?.dataset.level;
  grid.replaceChildren();
  if (!draft) return;
  for (const mood of MOODS) {
    const current = draft.moods.find(m => m.id === mood.id)?.level ?? 0;
    const row = el('div', `mood-row${current ? ' has-selection' : ''}`);
    const label = el('div', 'mood-label');
    label.append(el('span', `mood-symbol ${mood.color}`, mood.icon), el('span', '', mood.name));
    const group = el('div', 'level-buttons');
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', mood.name);
    for (let level = 0; level <= 3; level++) {
      const button = el('button', `level-button${current === level ? ' chosen' : ''}${level === 0 ? ' neutral-button' : ''}`, romans[level]);
      button.type = 'button'; button.dataset.mood = mood.id; button.dataset.level = level;
      button.disabled = saving;
      button.setAttribute('aria-label', `${mood.name} ${romans[level]}: ${levels[level]}`);
      button.setAttribute('aria-pressed', String(current === level));
      button.addEventListener('click', () => {
        draft.moods.find(m => m.id === mood.id).level = current === level && level !== 0 ? 0 : level;
        dirty = true; setStatus('Avaliação ainda não salva.'); renderMoods();
      });
      group.append(button);
    }
    row.append(label, group); grid.append(row);
  }
  if (focusId) grid.querySelector(`[data-mood="${focusId}"][data-level="${focusLevel}"]`)?.focus();
}
function selectDate(date) {
  if (saving || !ready || date === selected || !mayDiscard()) return;
  selected = date; draft = null; dirty = false;
  setStatus(''); renderDay(); renderCalendar();
}
function openAssessment(entry = null) {
  if (saving || !ready || !mayDiscard()) return;
  const now = new Date();
  draft = entry ? structuredClone(entry) : {
    id: crypto.randomUUID(), date: selected, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    moods: neutralMoods(), note: '', medications: medicationSnapshot(medications, selected, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`), medicationsRecorded: true, durationMinutes: reference.durationMinutes, durationSource: 'estimated',
  };
  if (!entry) draft.intakes = intakeSnapshot(intakes, selected, draft.time);
  dirty = !entry;
  $('#editor-title').textContent = entry ? 'Editar avaliação' : 'Como você se sente agora?';
  $('#selected-date').textContent = fromKey(selected).toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
  $('#assessment-time').value = draft.time ?? '';
  $('#assessment-time').required = draft.time !== null;
  $('#time-help').textContent = draft.time === null ? 'Registro antigo sem horário. Você pode informar um horário, se lembrar.' : 'O horário é preenchido ao iniciar. Você pode ajustá-lo.';
  $('#note').value = draft.note;
  $('#assessment-duration').value = draft.durationMinutes || reference.durationMinutes;
  renderMedicationContext();
  setStatus(entry ? 'Você pode ajustar este registro e salvar novamente.' : 'Todos começam em neutro. Marque apenas o que estiver sentindo.');
  renderDay(); renderMoods();
  $('#editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#assessment-time').focus({ preventScroll: true });
}
function closeEditor() {
  if (saving || !mayDiscard()) return;
  draft = null; dirty = false; renderDay();
}
async function save(event) {
  event.preventDefault();
  if (!draft || saving || !ready || !$('#assessment-form').reportValidity()) return;
  saving = true;
  $('#save').disabled = true; $('#save').textContent = 'Salvando…';
  $('#note').disabled = true; $('#assessment-time').disabled = true; $('#cancel-assessment').disabled = true;
  $('#assessment-duration').disabled = true; $('#complete-reference').disabled = true;
  renderDay(); renderMoods(); renderCalendar();
  try {
    const result = await saveAssessment(draft);
    assessments = assessments.filter(entry => entry.id !== result.id); assessments.push(result);
    draft = null; dirty = false;
    setStatus(`Avaliação das ${result.time ?? 'horas não informadas'} salva neste dispositivo.`);
    navigator.storage?.persist?.().catch(() => {});
    const contribution = await queueContribution().catch(() => ({ pending: true }));
    if (contribution.sent) setStatus('Avaliação salva no dispositivo e contribuição enviada sem resenha.');
    else if (contribution.pending) setStatus('Avaliação salva no dispositivo. Contribuição pendente: será tentada ao abrir o app com internet.');
    else if (contribution.empty) setStatus('Avaliação salva no dispositivo. Sem medicamento elegível para contribuição neste registro.');
  } catch (error) { setStatus(`${error.message} Suas alterações continuam aqui.`, true); }
  finally {
    saving = false;
    $('#save').disabled = false; $('#save').textContent = 'Salvar avaliação';
    $('#note').disabled = false; $('#assessment-time').disabled = false; $('#cancel-assessment').disabled = false;
    $('#assessment-duration').disabled = false; $('#complete-reference').disabled = false;
    renderDay(); renderMoods(); renderCalendar();
    if (!draft) { $('#new-assessment').focus({ preventScroll: true }); $('#day-records').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
}
$('#new-assessment').addEventListener('click', () => openAssessment());
$('#cancel-assessment').addEventListener('click', closeEditor);
$('#assessment-form').addEventListener('submit', save);
$('#note').addEventListener('input', event => { if (draft) { draft.note = event.target.value; dirty = true; setStatus('Avaliação ainda não salva.'); } });
$('#assessment-duration').addEventListener('input', event => { if (draft) { draft.durationMinutes = Number(event.target.value); draft.durationSource = 'reported'; dirty = true; setStatus('Avaliação ainda não salva.'); } });
$('#assessment-time').addEventListener('input', event => { if (draft) { draft.time = event.target.value || null; dirty = true; setStatus('Avaliação ainda não salva.'); } });
$('#assessment-time').addEventListener('change', () => {
  if (draft && !assessments.some(entry => entry.id === draft.id)) { draft.medications = medicationSnapshot(medications, selected, draft.time || '00:00'); draft.intakes = intakeSnapshot(intakes, selected, draft.time); renderMedicationContext(); }
});
function renderMedicationContext() {
  const meds = draft.medicationsRecorded ? (draft.medications?.length ? draft.medications.map(medicationLabel).join(' | ') : 'Nenhum medicamento em uso cadastrado para este horário.') : 'Medicamentos não foram informados nesta avaliação antiga.';
  const doses = (draft.intakes || []).map(intake => `${intake.name} ${intake.dose} ${intake.unit} em ${intake.date.split('-').reverse().join('/')} às ${intake.time}`).join('; ');
  $('#assessment-medications').textContent = meds + (doses ? ` Tomadas informadas nas últimas 24h: ${doses}.` : ' Nenhuma tomada informada nas últimas 24h.');
}
$('#complete-reference').addEventListener('click', async () => {
  const result = await askDailyReference(selected, reference);
  if (result) { dailyReferences[selected] = result; renderDay(); setStatus('Referência do dia salva como estimativa para as lacunas, sem alterar as avaliações.'); }
});
$('#prev-week').addEventListener('click', () => { weekStart = addDays(weekStart, -7); renderCalendar(); });
$('#next-week').addEventListener('click', () => { weekStart = addDays(weekStart, 7); renderCalendar(); });
$('#today').addEventListener('click', () => { selectDate(today); weekStart = monday(fromKey(selected)); renderCalendar(); });
$('#export').addEventListener('click', async () => {
  if (!ready) return;
  $('#export').disabled = true;
  try {
    downloadFile(entriesToCsv(await allAssessments()), 'text/csv;charset=utf-8', `entre-dias-${key(new Date())}.csv`);
    if (!dirty) setStatus('CSV exportado com todas as avaliações salvas.');
  } catch (error) { setStatus(error.message, true); }
  finally { $('#export').disabled = false; }
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
$('#today-label').textContent = new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
renderCalendar(); renderDay();
try {
  [assessments, medications, reference, dailyReferences, intakes] = await Promise.all([allAssessments(), allMedications(), getSetting('reference', DEFAULT_REFERENCE), getSetting('dailyReferences', {}), allIntakes()]); ready = true;
  renderCalendar(); renderDay();
  const requested = assessments.find(entry => entry.id === params.get('assessment'));
  if (requested) { selected = requested.date; weekStart = monday(fromKey(selected)); renderCalendar(); openAssessment(requested); }
  else setStatus('Selecione um dia e inicie uma avaliação.');
  syncPendingContribution().catch(() => {});
  if (params.has('referencia')) {
    const date = params.get('referencia') === 'hoje' ? today : params.get('referencia');
    if (validDate(date) && date <= today) { selected = date; weekStart = monday(fromKey(date)); renderCalendar(); renderDay(); const result = await askDailyReference(date, reference); if (result) { dailyReferences[date] = result; renderDay(); } }
  }
} catch (error) { setStatus(error.message, true); }
