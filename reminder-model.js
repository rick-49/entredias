import { validTime } from './health-model.js';

export function localClock(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}
export function reminderDue(record, now = new Date()) {
  const local = localClock(now, record.timezone);
  const toMinutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const difference = toMinutes(local.time) - toMinutes(record.time);
  return record.lastDay !== local.date && difference >= 0 && difference <= 30 ? local.date : null;
}
export function validatePush(input) {
  if (!input || !/^[a-f0-9]{64}$/.test(input.token || '') || !validTime(input.time) || typeof input.timezone !== 'string' || input.timezone.length > 80) throw new Error('Configuração de lembrete inválida.');
  try { localClock(new Date(), input.timezone); } catch { throw new Error('Fuso horário inválido.'); }
  const subscription = input.subscription;
  if (!subscription || typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048) throw new Error('Assinatura de notificação inválida.');
  const endpoint = new URL(subscription.endpoint);
  const allowed = endpoint.hostname === 'fcm.googleapis.com' || endpoint.hostname === 'updates.push.services.mozilla.com' || endpoint.hostname.endsWith('.notify.windows.com') || endpoint.hostname === 'web.push.apple.com';
  if (endpoint.protocol !== 'https:' || !allowed || endpoint.username || endpoint.password || endpoint.port) throw new Error('Serviço de push não reconhecido.');
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(subscription.keys?.p256dh || '') || !/^[A-Za-z0-9_-]{16,40}$/.test(subscription.keys?.auth || '')) throw new Error('Chaves de push inválidas.');
  return { token: input.token, time: input.time, timezone: input.timezone, subscription: { endpoint: endpoint.href, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } } };
}
