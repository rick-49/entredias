import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDiary } from '../database.js';
import { makeBackup } from '../local-data.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const diary = openDiary(dataDir);
try {
  const records = diary.all();
  const output = path.join(dataDir, 'backup-para-pwa.json');
  writeFileSync(output, JSON.stringify(makeBackup(records), null, 2), { encoding: 'utf8', mode: 0o600 });
  console.log(`Backup criado: ${output} (${records.length} avaliações). Restaure em Dados e backup no app instalado.`);
} finally { diary.close(); }
