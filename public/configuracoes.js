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
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
for (const mood of MOODS) { const option = element('option', mood.name); option.value = mood.id; $('#ref-mood').append(option); }
$('#reference-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await setSetting('reference', { enabled: $('#ref-enabled').checked, moodId: $('#ref-mood').value, level: Number($('#ref-level').value), durationMinutes: Number($('#ref-duration').value), start: '00:00', end: '23:59' });
    $('#ref-status').textContent = 'Referência salva. Lacunas são estimativas; as avaliações reais permanecem intactas.';
  } catch (error) { $('#ref-status').textContent = error.message; }
});
async function previewContribution() {
  const previous = Number($('#contribution-days').value);
  const records = buildContribution(await allAssessments(), '0000-01-01', '9999-12-31', previous);
  const meds = [...new Set(records.map(record => `${record.medication} · ${record.dose}`))];
  $('#contribution-preview').textContent = `${records.length} observações elegíveis dos primeiros ${previous} dias de cada esquema (limite de 500).
Medicamentos: ${meds.join('; ') || 'nenhum elegível ainda'}.
Campos: medicamento, dose, dia relativo, uso concomitante e níveis de humor.
Sem resenhas, datas, horários exatos ou estimativas.`;
}
$('#contribution-days').addEventListener('change', () => previewContribution().catch(error => { $('#contribution-status').textContent = error.message; }));
$('#save-contribution').addEventListener('click', async () => {
  const accepted = $('#contribution-consent').checked;
  if (!accepted) { await setSetting('contributionConsent', false); $('#contribution-status').textContent = 'Envio automático desligado. Para retirar o que já enviou, use o botão de retirada.'; return; }
  if (!confirm('Autoriza enviar as observações de medicamentos e sentimentos descritas acima e atualizar essa contribuição automaticamente ao salvar avaliações? As resenhas não serão enviadas.')) { $('#contribution-consent').checked = await getSetting('contributionConsent', false); return; }
  $('#save-contribution').disabled = true;
  try {
    await setSetting('contributionDays', Number($('#contribution-days').value));
    await setSetting('contributionConsent', true); await setSetting('contributionWithdrawalPending', false);
    const result = await queueContribution();
    $('#contribution-status').textContent = result.sent ? `${result.sent} observações enviadas. As próximas avaliações elegíveis serão sincronizadas ao salvar.` : result.empty ? 'Contribuição ativada. Nenhuma observação elegível ainda; novas avaliações com medicamento serão sincronizadas ao salvar.' : 'Contribuição ativada, mas o envio está pendente. O app tentará novamente ao abrir com internet.';
    await previewContribution();
  } catch (error) { $('#contribution-status').textContent = error.message; }
  finally { $('#save-contribution').disabled = false; }
});
$('#revoke-contribution').addEventListener('click', async () => {
  if (!confirm('Desligar a contribuição e retirar os dados desta instalação do banco de análise geral? O diário local será mantido.')) return;
  try { await revokeContribution(); $('#contribution-consent').checked = false; $('#contribution-status').textContent = 'Contribuição desligada e registros desta instalação retirados do servidor.'; }
  catch (error) { $('#contribution-consent').checked = false; $('#contribution-status').textContent = error.message; }
});
let pushConfig;
$('#enable-reminder').addEventListener('click', async () => {
  if (typeof Notification === 'undefined' || !('PushManager' in window)) { $('#reminder-status').textContent = 'Este navegador não oferece push. No iPhone, instale pelo Safari e abra pelo ícone da tela inicial.'; return; }
  const permission = Notification.requestPermission();
  try { await enableReminder($('#reminder-time').value, pushConfig, permission); $('#reminder-status').textContent = `Lembrete ativado para ${$('#reminder-time').value}, no fuso deste aparelho.`; }
  catch (error) { $('#reminder-status').textContent = error.message; }
});
$('#disable-reminder').addEventListener('click', async () => {
  try { await disableReminder(); $('#reminder-status').textContent = 'Lembrete desativado.'; }
  catch (error) { $('#reminder-status').textContent = error.message; }
});
try {
  const reference = await getSetting('reference', DEFAULT_REFERENCE);
  $('#ref-enabled').checked = reference.enabled; $('#ref-mood').value = reference.moodId; $('#ref-level').value = reference.level; $('#ref-duration').value = reference.durationMinutes || 20;
  $('#contribution-consent').checked = await getSetting('contributionConsent', false);
  $('#contribution-days').value = await getSetting('contributionDays', 14);
  const reminder = await getSetting('reminder', { enabled: false, time: '18:00' }); $('#reminder-time').value = reminder.time;
  await previewContribution();
  pushConfig = await pushAvailability();
  const supported = typeof Notification !== 'undefined' && 'PushManager' in window;
  $('#enable-reminder').disabled = !pushConfig.enabled || !supported;
  $('#reminder-status').textContent = !supported ? 'No iPhone, instale o app pelo Safari e abra pelo ícone na tela inicial para habilitar notificações.' : !pushConfig.enabled ? 'O servidor de lembretes ainda precisa ser ativado pelo administrador.' : reminder.enabled ? `Lembrete configurado para ${reminder.time}.` : 'Lembrete desligado. Só será ativado se você permitir notificações.';
} catch (error) { $('#ref-status').textContent = error.message; }
syncPendingContribution().catch(() => {});
