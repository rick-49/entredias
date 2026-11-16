import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

for (const dir of ['.', 'public']) {
  for (const file of readdirSync(dir).filter(name => name.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', path.join(dir, file)], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(1);
  }
}
for (const name of ['index.html', 'dashboard.html', 'login.html']) readFileSync(path.join('public', name));
console.log('Aplicativo pronto. Inicie com npm start. Não há arquivos estáticos para compilar.');
