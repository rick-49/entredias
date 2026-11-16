import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDiary } from '../database.js';
import { entriesToCsv } from '../csv.js';
import { MOODS } from '../shared.js';

test('migra SQLite antigo com backup, mantém resenha e horário desconhecido, sem duplicar ao reiniciar', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'diary-sqlite-'));
  let diary;
  try {
    const old = new DatabaseSync(path.join(dir, 'diary.sqlite'));
    old.exec(`CREATE TABLE entries (date TEXT PRIMARY KEY, note TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE entry_moods (entry_date TEXT, mood_id TEXT, level INTEGER, position INTEGER);
      CREATE TABLE migrations (name TEXT PRIMARY KEY);
      INSERT INTO migrations VALUES ('legacy-json');
      INSERT INTO entries VALUES ('2026-11-05', 'Resenha preservada', '2026-11-05T12:00:00Z');
      INSERT INTO entry_moods VALUES ('2026-11-05', 'alegria', 3, 0);`);
    old.close();
    diary = openDiary(dir);
    const migrated = diary.all()[0];
    assert.equal(migrated.time, null);
    assert.equal(migrated.note, 'Resenha preservada');
    assert.equal(migrated.moods.find(m => m.id === 'alegria').level, 3);
    assert.equal(migrated.moods.find(m => m.id === 'calma').level, 0);
    assert.ok(existsSync(path.join(dir, 'diary-before-assessments.sqlite')));
    diary.save(migrated.id, { ...migrated, note: 'Editado sem inventar horário' });
    assert.equal(diary.all()[0].time, null);
    diary.close(); diary = openDiary(dir);
    assert.equal(diary.all().length, 1);
    assert.equal(diary.all()[0].note, 'Editado sem inventar horário');
    diary.remove(migrated.id);
    diary.close(); diary = openDiary(dir);
    assert.equal(diary.all().length, 0);
  } finally { diary?.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('importa JSON anterior, preserva backup e desfaz importação inválida', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'diary-json-'));
  let diary;
  try {
    const entry = { moods: [], note: 'Resenha antiga', updatedAt: '2026-11-05T12:00:00Z' };
    writeFileSync(path.join(dir, 'entries.json'), JSON.stringify({ '2026-11-04': entry, '2026-02-30': entry }));
    assert.throws(() => openDiary(dir), /Data inválida/);
    const legacy = JSON.stringify({ '2026-11-05': entry });
    writeFileSync(path.join(dir, 'entries.json'), legacy);
    diary = openDiary(dir);
    assert.equal(diary.all().length, 1);
    assert.equal(diary.all()[0].note, 'Resenha antiga');
    assert.equal(diary.all()[0].moods.length, MOODS.length);
    assert.equal(readFileSync(path.join(dir, 'entries.json'), 'utf8'), legacy);
    const saved = diary.save(randomUUID(), { date: '2026-11-05', time: '09:15', moods: [], note: '' });
    assert.ok(saved.moods.every(m => m.level === 0));
    assert.equal(diary.all().length, 2);
  } finally { diary?.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('CSV inclui avaliação, horário, neutros, resenha com aspas e proteção de fórmulas', () => {
  const csv = entriesToCsv([
    { id: 'a', date: '2026-11-05', time: '14:30', moods: [{ id: 'alegria', level: 3 }], note: 'Um dia; "especial"\nCom emoção', updatedAt: '' },
    { id: 'b', date: '2026-11-04', time: null, moods: [], note: '=SUM(1+1)', updatedAt: '' },
  ]);
  assert.ok(csv.startsWith('\uFEFF"Avaliação";"Data";"Horário"'));
  assert.ok(csv.includes('"Alegria";"III";"Intensa"'));
  assert.ok(csv.includes('"Calma";"Neutro";"Não estou sentindo"'));
  assert.ok(csv.includes('"14:30"'));
  assert.ok(csv.includes('Não informado (registro antigo)'));
  assert.ok(csv.includes('"Um dia; ""especial""\nCom emoção"'));
  assert.ok(csv.includes('"\'=SUM(1+1)"'));
  assert.ok(csv.indexOf('2026-11-04') < csv.indexOf('2026-11-05'));
  assert.equal(entriesToCsv([]).split('\r\n').length, 2);
});
