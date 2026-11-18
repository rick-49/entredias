import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function createInstallationStats(dataDir) {
  let connection;
  async function database() {
    if (!dataDir) throw new Error('Private storage unavailable');
    if (!connection) connection = (async () => {
      const { DatabaseSync } = await import('node:sqlite');
      mkdirSync(dataDir, { recursive: true });
      const db = new DatabaseSync(path.join(dataDir, 'installations.sqlite'));
      db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS installations (id TEXT PRIMARY KEY, first_seen TEXT NOT NULL); CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      db.prepare('INSERT OR IGNORE INTO metadata(key,value) VALUES (?,?)').run('startedAt', new Date().toISOString());
      return db;
    })().catch(error => { connection = null; throw error; });
    return connection;
  }
  return {
    async record(input) {
      if (!input || Object.keys(input).length !== 1 || !/^[a-f0-9]{64}$/.test(input.token || '')) throw Object.assign(new Error('Invalid installation'), { code: 'INVALID_INSTALLATION' });
      const db = await database();
      const id = createHash('sha256').update(input.token).digest('hex');
      db.prepare('INSERT OR IGNORE INTO installations(id,first_seen) VALUES (?,?)').run(id, new Date().toISOString());
    },
    async summary() {
      const db = await database();
      return { total: db.prepare('SELECT COUNT(*) AS total FROM installations').get().total, startedAt: db.prepare('SELECT value FROM metadata WHERE key=?').get('startedAt').value };
    },
    async close() { if(connection) (await connection).close(); connection = null; },
  };
}
