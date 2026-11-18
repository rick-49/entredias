import { MOODS } from '/shared.js';
import { ACTIVE_INGREDIENTS } from '/medication-catalog.js';
import { allMedications, allIntakes, addIntake, addMedication, endMedication, allAssessments, getSetting, setSetting } from '/local-data.js';
import { buildContribution } from '/contribution-model.js';
import { DEFAULT_REFERENCE, medicationLabel } from '/health-model.js';
import { requireInstalled, isInstalled } from '/install.js';
import { queueContribution, revokeContribution, syncPendingContribution } from '/contribute.js';
import { pushAvailability, enableReminder, disableReminder } from '/push-client.js';
await requireInstalled();
const $ = selector => document.querySelector(selector);
const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
$('#med-start').value = today;
for (const name of ACTIVE_INGREDIENTS) { const option = document.createElement('option'); option.value = name; option.textContent = name; $('#med-name').append(option); }
const otherMedication = document.createElement('option'); otherMedication.value = '__other__'; otherMedication.textContent = 'Outro princípio ativo'; $('#med-name').append(otherMedication);
function syncCustomMedication() {
  const custom = $('#med-name').value === '__other__';
  $('#med-custom-label').hidden = !custom;
  $('#med-custom-name').disabled = !custom;
  $('#med-custom-name').required = custom;
}
$('#med-name').addEventListener('change', syncCustomMedication);
syncCustomMedication();
$('#intake-date').value = today; $('#intake-time').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
async function renderMedications() {
  const target = $('#medication-list'); target.replaceChildren();
  const medications = await allMedications();
  $('#intake-medication').replaceChildren();
  for (const med of medications) { const option = element('option', `${med.name} · ${med.dose} ${med.unit} · desde ${med.startDate} ${med.startTime || '00:00'}`); option.value = med.id; $('#intake-medication').append(option); }
  if (!medications.length) target.append(element('p', 'Nenhum medicamento cadastrado. Você pode usar o diário sem informar medicamentos.'));
  for (const med of medications) {
    const card = element('article', ''); card.className = 'medication-card';
    card.append(element('h3', medicationLabel(med)), element('p', `Início: ${med.startDate.split('-').reverse().join('/')} às ${med.startTime || '00:00'} · ${med.endDate ? 'Último horário: ' + med.endDate.split('-').reverse().join('/') + ' ' + (med.endTime || '23:59') : 'Em uso no cadastro'}`));
    if (!med.endDate) {
      const row = element('div', ''); row.className = 'end-medication';
      const label = element('label', 'Último dia em uso (inclusive)'); const date = document.createElement('input'); date.type = 'date'; date.value = today; date.min = med.startDate; label.append(date);
      const timeLabel = element('label', 'Último horário em uso (inclusive)'); const time = document.createElement('input'); time.type = 'time'; time.value = '23:59'; timeLabel.append(time);
      const end = element('button', 'Encerrar este esquema'); end.className = 'today-button';
      end.addEventListener('click', async () => {
        if (!confirm('Encerrar este esquema nessa data? As avaliações já salvas manterão os medicamentos informados na época.')) return;
        try { await endMedication(med.id, date.value, time.value); await renderMedications(); $('#med-status').textContent = 'Esquema encerrado. Para uma nova dose ou horário, faça outro cadastro com a data e hora de início.'; }
        catch (error) { $('#med-status').textContent = error.message; }
      });
      row.append(label, timeLabel, end); card.append(row);
    }
    target.append(card);
  }
}
$('#medication-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const name = $('#med-name').value === '__other__' ? $('#med-custom-name').value : $('#med-name').value;
    await addMedication({ id: crypto.randomUUID(), name, dose: Number($('#med-dose').value), unit: $('#med-unit').value, times: $('#med-times').value.split(',').map(value => value.trim()), startDate: $('#med-start').value, startTime: $('#med-start-time').value, endDate: $('#med-end').value || null, endTime: $('#med-end-time').value || '23:59' });
    $('#medication-form').reset(); $('#med-start').value = today; syncCustomMedication();
    $('#med-status').textContent = 'Medicamento salvo neste dispositivo. Ele será associado às novas avaliações dos dias em uso.';
    await renderMedications();
  } catch (error) { $('#med-status').textContent = error.message; }
});
async function renderIntakes() {
  $('#intake-list').replaceChildren();
  for (const intake of (await allIntakes()).slice(0, 30)) { const row = element('p', `${intake.date.split('-').reverse().join('/')} ${intake.time} · ${intake.name} · ${intake.dose} ${intake.unit}`); row.className = 'medication-caption'; $('#intake-list').append(row); }
}
$('#intake-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const med = (await allMedications()).find(med => med.id === $('#intake-medication').value);
    if (!med) throw new Error('Cadastre um medicamento primeiro.');
    await addIntake({ id: crypto.randomUUID(), medicationId: med.id, name: med.name, dose: med.dose, unit: med.unit, date: $('#intake-date').value, time: $('#intake-time').value });
    $('#intake-status').textContent = 'Tomada registrada com a data e hora informadas. O histórico das avaliações já salvas não foi modificado.';
    await renderIntakes();
  } catch (error) { $('#intake-status').textContent = error.message; }
});

try { await renderMedications(); await renderIntakes(); } catch (error) { $('#med-status').textContent = error.message; }
syncPendingContribution().catch(() => {});
