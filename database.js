import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { validateEntry, validateAssessment, neutralMoods } from './shared.js';

export function openDiary(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'diary.sqlite'));
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS entries (
      date TEXT PRIMARY KEY,
      note TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entry_moods (
      entry_date TEXT NOT NULL REFERENCES entries(date) ON DELETE CASCADE,
      mood_id TEXT NOT NULL,
      level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 3),
      position INTEGER NOT NULL,
      PRIMARY KEY(entry_date, mood_id)
    );
    CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT,
      note TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS assessments_date ON assessments(date, time);
    CREATE TABLE IF NOT EXISTS assessment_moods (
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      mood_id TEXT NOT NULL,
      level INTEGER NOT NULL CHECK(level BETWEEN 0 AND 3),
      PRIMARY KEY(assessment_id, mood_id)
    );
  `);
  const upsert = db.prepare(`INSERT INTO entries(date, note, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at`);
  const deleteEntry = db.prepare('DELETE FROM entries WHERE date = ?');
  const clearMoods = db.prepare('DELETE FROM entry_moods WHERE entry_date = ?');
  const insertMood = db.prepare('INSERT INTO entry_moods(entry_date, mood_id, level, position) VALUES (?, ?, ?, ?)');

  function writeEntry(date, entry) {
    if (!entry.moods.length && !entry.note) { deleteEntry.run(date); return; }
    upsert.run(date, entry.note, entry.updatedAt);
    clearMoods.run(date);
    entry.moods.forEach((mood, position) => insertMood.run(date, mood.id, mood.level, position));
  }
  function transaction(action) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = action(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  try {
    // Importação única e atômica; o JSON original permanece como backup.
    transaction(() => {
      if (db.prepare('SELECT name FROM migrations WHERE name = ?').get('legacy-json')) return;
      let legacy = {};
      try { legacy = JSON.parse(readFileSync(path.join(dataDir, 'entries.json'), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!legacy || Array.isArray(legacy) || typeof legacy !== 'object') throw new Error('Formato do diário anterior inválido.');
      for (const [date, entry] of Object.entries(legacy)) {
        const error = validateEntry(date, entry);
        if (error) throw new Error(`Não foi possível importar ${date}: ${error}`);
        if (!db.prepare('SELECT date FROM entries WHERE date = ?').get(date)) {
          writeEntry(date, { ...entry, note: entry.note.trim(), updatedAt: entry.updatedAt || new Date().toISOString() });
        }
      }
      db.prepare('INSERT INTO migrations(name) VALUES (?)').run('legacy-json');
    });
  } catch (error) { db.close(); throw error; }

  const upsertAssessment = db.prepare(`INSERT INTO assessments(id, date, time, note, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET date=excluded.date, time=excluded.time, note=excluded.note, updated_at=excluded.updated_at`);
  const insertAssessmentMood = db.prepare('INSERT INTO assessment_moods(assessment_id, mood_id, level) VALUES (?, ?, ?)');
  function writeAssessment(id, input) {
    upsertAssessment.run(id, input.date, input.time, input.note.trim(), input.updatedAt);
    db.prepare('DELETE FROM assessment_moods WHERE assessment_id = ?').run(id);
    for (const mood of neutralMoods(input.moods)) insertAssessmentMood.run(id, mood.id, mood.level);
  }
  try {
    if (!db.prepare('SELECT name FROM migrations WHERE name = ?').get('timed-assessments-v1')) {
      const backup = path.join(dataDir, 'diary-before-assessments.sqlite');
      if (db.prepare('SELECT count(*) AS count FROM entries').get().count && !existsSync(backup)) {
        db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
      }
      transaction(() => {
        for (const row of db.prepare('SELECT * FROM entries ORDER BY date').all()) {
          const moods = db.prepare('SELECT mood_id AS id, level FROM entry_moods WHERE entry_date = ? ORDER BY position').all(row.date);
          // O diário antigo não guardava horário: a migração não inventa um.
          writeAssessment(randomUUID(), { date: row.date, time: null, moods, note: row.note, updatedAt: row.updated_at });
        }
        db.prepare('INSERT INTO migrations(name) VALUES (?)').run('timed-assessments-v1');
      });
    }
  } catch (error) { db.close(); throw error; }
  return {
    all() {
      const result = db.prepare('SELECT id, date, time, note, updated_at AS updatedAt FROM assessments ORDER BY date DESC, time DESC, id').all();
      const grouped = new Map(result.map(entry => [entry.id, { ...entry, moods: [] }]));
      for (const mood of db.prepare('SELECT * FROM assessment_moods').all()) {
        grouped.get(mood.assessment_id).moods.push({ id: mood.mood_id, level: mood.level });
      }
      return [...grouped.values()].map(entry => ({ ...entry, moods: neutralMoods(entry.moods) }));
    },
    save(id, input) {
      const existing = db.prepare('SELECT time FROM assessments WHERE id = ?').get(id);
      const error = validateAssessment(input, existing?.time === null);
      if (error) throw new Error(error);
      const entry = { id, date: input.date, time: input.time, note: input.note.trim(), moods: neutralMoods(input.moods), updatedAt: new Date().toISOString() };
      transaction(() => writeAssessment(id, entry));
      return entry;
    },
    remove(id) { return db.prepare('DELETE FROM assessments WHERE id = ?').run(id).changes > 0; },
    close() { db.close(); },
  };
}
