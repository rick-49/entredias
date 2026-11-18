import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { reminderDue } from './reminder-model.js';

export function createPushService(config, env = process.env) {
  const enabled = Boolean(config.dataDir && env.PUSH_ENABLED !== 'false' && (config.production || env.PUSH_ENABLED === 'true'));
  let ready; let running = false;
  const hash = value => createHash('sha256').update(value).digest('hex');
  async function initialize() {
    if (!enabled) throw new Error('Lembretes desabilitados.');
    if (!ready) ready = (async () => {
      const webpush = await import('web-push');
      const { DatabaseSync } = await import('node:sqlite');
      mkdirSync(config.dataDir, { recursive: true });
      const keyFile = path.join(config.dataDir, 'push-vapid-private.json'); let keys;
      try { keys = JSON.parse(readFileSync(keyFile, 'utf8')); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        keys = webpush.generateVAPIDKeys();
        try { writeFileSync(keyFile, JSON.stringify(keys), { mode: 0o600, flag: 'wx' }); }
        catch (writeError) { if (writeError.code !== 'EEXIST') throw writeError; keys = JSON.parse(readFileSync(keyFile, 'utf8')); }
      }
      const db = new DatabaseSync(path.join(config.dataDir, 'notifications.sqlite'));
      db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, endpoint_hash TEXT UNIQUE, subscription TEXT NOT NULL, time TEXT NOT NULL, timezone TEXT NOT NULL, last_day TEXT)');
      const vapidDetails = { subject: env.PUSH_SUBJECT || 'https://entredias.online/', publicKey: keys.publicKey, privateKey: keys.privateKey };
      return { webpush, keys, db, vapidDetails };
    })().catch(error => { ready = null; throw error; });
    return ready;
  }
  async function tick() {
    if (!enabled || running) return; running = true;
    try {
      const { db, webpush, vapidDetails } = await initialize();
      for (const row of db.prepare('SELECT * FROM subscriptions').all()) {
        const date = reminderDue({ time: row.time, timezone: row.timezone, lastDay: row.last_day });
        if (!date) continue;
        const claimed = db.prepare('UPDATE subscriptions SET last_day=? WHERE id=? AND (last_day IS NULL OR last_day<>?)').run(date, row.id, date);
        if (!claimed.changes) continue;
        try {
          await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify({ title: 'Um momento para você', body: 'Como foi o restante do dia? Informe a intensidade da sua referência de humor.', url: `/app?referencia=${date}` }), { vapidDetails, TTL: 3600, timeout: 10000 });
        } catch (error) {
          if ([404, 410].includes(error.statusCode)) db.prepare('DELETE FROM subscriptions WHERE id=?').run(row.id);
          else db.prepare('UPDATE subscriptions SET last_day=? WHERE id=?').run(row.last_day, row.id);
        }
      }
    } catch (error) { console.error('Push indisponível:', error.code || error.name); }
    finally { running = false; }
  }
  return {
    async configuration() { if (!enabled) return { enabled: false }; const { keys } = await initialize(); return { enabled: true, publicKey: keys.publicKey }; },
    async save(input) { const { db } = await initialize(); db.prepare('INSERT OR REPLACE INTO subscriptions(id,endpoint_hash,subscription,time,timezone,last_day) VALUES (?,?,?,?,?,NULL)').run(hash(input.token), hash(input.subscription.endpoint), JSON.stringify(input.subscription), input.time, input.timezone); },
    async remove(token) { const { db } = await initialize(); db.prepare('DELETE FROM subscriptions WHERE id=?').run(hash(token)); },
    start() { if (!enabled) return; tick(); const timer = setInterval(tick, 60000); timer.unref(); },
  };
}
