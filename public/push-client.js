import { getSetting, setSetting } from '/local-data.js';
import { privateToken } from '/contribute.js';

export async function pushAvailability() {
  const response = await fetch('/api/push/config');
  if (!response.ok) throw new Error('Lembretes não disponíveis no servidor.');
  return response.json();
}
export async function enableReminder(time, config, permissionPromise) {
  if (!config?.enabled || !config.publicKey) throw new Error('O servidor de lembretes ainda não foi configurado.');
  const permission = await permissionPromise;
  if (permission !== 'granted') throw new Error('A permissão de notificações não foi concedida. Confira as permissões do app.');
  const registration = await navigator.serviceWorker.ready;
  const bytes = Uint8Array.from(atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  let token = await getSetting('pushToken');
  if (!token) { token = privateToken(); await setSetting('pushToken', token); }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const response = await fetch('/api/push/subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, time, timezone, subscription: subscription.toJSON() }) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível ativar o lembrete.');
  await setSetting('reminder', { enabled: true, time, timezone });
}
export async function disableReminder() {
  const token = await getSetting('pushToken');
  if (token) {
    const response = await fetch('/api/push/subscription', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    if (!response.ok) throw new Error('Não foi possível desativar no servidor. Conecte-se à internet e tente novamente.');
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
  const previous = await getSetting('reminder', { time: '18:00' });
  await setSetting('reminder', { ...previous, enabled: false });
}
