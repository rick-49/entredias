import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInstallationStats } from '../installation-stats.js';
test('contador persiste, deduplica reenvios e rejeita dados pessoais extras', async () => {
  const dir=mkdtempSync(path.join(tmpdir(),'entredias-count-')); let stats=createInstallationStats(dir);
  try {
    assert.equal((await stats.summary()).total,0);
    await Promise.all([stats.record({token:'a'.repeat(64)}),stats.record({token:'a'.repeat(64)})]);
    assert.equal((await stats.summary()).total,1);
    await stats.record({token:'b'.repeat(64)});
    await assert.rejects(stats.record({token:'c'.repeat(64),note:'private'}));
    await assert.rejects(stats.record({token:'invalid'}));
    await stats.close(); stats=createInstallationStats(dir);
    assert.equal((await stats.summary()).total,2);
  } finally { await stats.close(); rmSync(dir,{recursive:true,force:true}); }
});
