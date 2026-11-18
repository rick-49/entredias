import { createHash } from 'node:crypto';
import { aggregateCommunity } from './contribution-model.js';

export function createCommunityDatabase(env = process.env) {
  const configured = env.COMMUNITY_ENABLED === 'true' && ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].every(key => env[key]);
  let connection;
  async function pool() {
    if (!configured) throw Object.assign(new Error('Análise geral ainda não configurada.'), { code: 'NOT_CONFIGURED' });
    if (!connection) connection = (async () => {
      const mysql = await import('mysql2/promise');
      const client = mysql.createPool({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD, connectionLimit: 3, connectTimeout: 10000, charset: 'utf8mb4', ...(env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}) });
      try {
        await client.execute(`CREATE TABLE IF NOT EXISTS entredias_contributors (id CHAR(64) PRIMARY KEY, consent_version INT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
        await client.execute(`CREATE TABLE IF NOT EXISTS entredias_observations (
          contributor_id CHAR(64) NOT NULL, event_id CHAR(64) NOT NULL, medication VARCHAR(80) NOT NULL,
          dose VARCHAR(40) NOT NULL, treatment_day SMALLINT NOT NULL, concomitant BOOLEAN NOT NULL, moods TEXT NOT NULL,
          PRIMARY KEY(contributor_id,event_id), INDEX med_day (medication,treatment_day),
          FOREIGN KEY (contributor_id) REFERENCES entredias_contributors(id) ON DELETE CASCADE
        )`);
      } catch (error) { await client.end(); throw error; }
      return client;
    })().catch(error => { connection = null; throw error; });
    return connection;
  }
  const hash = token => createHash('sha256').update(token).digest('hex');
  return {
    configured: Boolean(configured),
    async save(token, records, version) {
      const db = await pool(); const client = await db.getConnection(); const participant = hash(token);
      try {
        await client.beginTransaction();
        await client.execute('INSERT INTO entredias_contributors(id,consent_version) VALUES (?,?) ON DUPLICATE KEY UPDATE consent_version=VALUES(consent_version),updated_at=CURRENT_TIMESTAMP', [participant, version]);
        await client.execute('DELETE FROM entredias_observations WHERE contributor_id=?', [participant]);
        const values = records.map(record => [participant, hash(record.id), record.medication, record.dose, record.day, record.concomitant, JSON.stringify(record.moods)]);
        if (values.length) await client.query('INSERT INTO entredias_observations(contributor_id,event_id,medication,dose,treatment_day,concomitant,moods) VALUES ?', [values]);
        await client.commit();
      } catch (error) { await client.rollback(); throw error; } finally { client.release(); }
    },
    async remove(token) { const db = await pool(); await db.execute('DELETE FROM entredias_contributors WHERE id=?', [hash(token)]); },
    async summary() {
      const db = await pool();
      // O banco só devolve grupos com amostra mínima; não expõe nomes raros ao cliente.
      const [rows] = await db.execute(`SELECT o.contributor_id,o.medication,o.dose,o.treatment_day,o.moods
        FROM entredias_observations o INNER JOIN (
          SELECT medication,dose,treatment_day FROM entredias_observations
          GROUP BY medication,dose,treatment_day HAVING COUNT(DISTINCT contributor_id)>=5
        ) g ON o.medication=g.medication AND o.dose=g.dose AND o.treatment_day=g.treatment_day`);
      return aggregateCommunity(rows.map(row => ({ participant: row.contributor_id, medication: row.medication, dose: row.dose, day: row.treatment_day, moods: JSON.parse(row.moods) })));
    },
  };
}
