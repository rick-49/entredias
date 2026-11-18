import { allAssessments, getSetting, setSetting } from '/local-data.js';
import { buildContribution, CONTRIBUTION_VERSION } from '/contribution-model.js';

let pendingRequest;
export function privateToken() {
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function contributionToken() {
  let token = await getSetting('contributionToken');
  if (!token) { token = privateToken(); await setSetting('contributionToken', token); }
  return token;
}
export async function contributionPreview() {
  const maxDay = await getSetting('contributionDays', 14);
  return buildContribution(await allAssessments(), '0000-01-01', '9999-12-31', maxDay);
}
export async function syncContribution() {
  if (pendingRequest) return pendingRequest;
  if (!await getSetting('contributionConsent', false)) return { enabled: false };
  if (!navigator.onLine) return { enabled: true, pending: true };
  pendingRequest = (async () => {
    const revision = await getSetting('contributionRevision', '');
    const records = await contributionPreview();
    if (!records.length) {
      const token = await getSetting('contributionToken');
      if (token && await getSetting('contributionLastSent')) {
        const response = await fetch('/api/community/contribution', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        if (!response.ok) throw new Error('Atualização da contribuição pendente.');
      }
      await setSetting('contributionPending', false);
      return { enabled: true, empty: true };
    }
    if (!await getSetting('contributionConsent', false)) return { enabled: false };
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/community/contribution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await contributionToken(), consentVersion: CONTRIBUTION_VERSION, records }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Envio não concluído.');
      if (revision === await getSetting('contributionRevision', '')) await setSetting('contributionPending', false);
      await setSetting('contributionLastSent', new Date().toISOString());
      return { enabled: true, sent: records.length };
    } finally { clearTimeout(timer); }
  })().catch(() => ({ enabled: true, pending: true })).finally(() => { pendingRequest = null; });
  return pendingRequest;
}
export async function queueContribution() {
  if (!await getSetting('contributionConsent', false)) return { enabled: false };
  await setSetting('contributionRevision', crypto.randomUUID()); await setSetting('contributionPending', true);
  if (pendingRequest) await pendingRequest;
  return syncContribution();
}
export async function revokeContribution() {
  await setSetting('contributionConsent', false); await setSetting('contributionPending', false);
  await setSetting('contributionWithdrawalPending', true);
  if (pendingRequest) await pendingRequest;
  return finishWithdrawal();
}
async function finishWithdrawal() {
  const token = await getSetting('contributionToken');
  if (!token) { await setSetting('contributionWithdrawalPending', false); return; }
  const response = await fetch('/api/community/contribution', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  if (!response.ok) throw new Error('Envio desligado. A retirada no servidor está pendente; abra o app com internet para concluir.');
  await setSetting('contributionWithdrawalPending', false);
}
export async function syncPendingContribution() {
  if (await getSetting('contributionWithdrawalPending', false)) { if (navigator.onLine) await finishWithdrawal(); return; }
  if (await getSetting('contributionPending', false)) await syncContribution();
}
window.addEventListener('online', () => syncPendingContribution().catch(() => {}));
