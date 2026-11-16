import path from 'node:path';

export function runtimeConfig(root, env = process.env) {
  const production = env.NODE_ENV === 'production';
  const password = env.APP_PASSWORD || '';
  if ((production || password) && password.length < 12) throw new Error('Defina APP_PASSWORD com pelo menos 12 caracteres para proteger o diário.');
  const host = env.HOST || (production ? '0.0.0.0' : '127.0.0.1');
  const marker = `${path.sep}hbuilds${path.sep}`;
  const buildIndex = root.indexOf(marker);
  const hostingerDir = buildIndex > 0 ? path.join(root.slice(0, buildIndex), 'entredias-data') : null;
  const dataDir = path.resolve(env.DATA_DIR || (production ? hostingerDir || '' : path.join(root, 'data')));
  if (production) {
    if (!env.DATA_DIR && !hostingerDir) throw new Error('Defina DATA_DIR com uma pasta persistente fora dos arquivos do site. Veja HOSTINGER.md.');
    if (env.DATA_DIR && !path.isAbsolute(env.DATA_DIR)) throw new Error('DATA_DIR precisa ser um caminho absoluto em produção.');
    const relative = path.relative(root, dataDir);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) || dataDir.split(path.sep).some(part => ['public_html', 'hbuilds'].includes(part))) {
      throw new Error('DATA_DIR deve ficar fora do código, hbuilds e public_html para preservar e proteger o banco.');
    }
  }
  return { production, password, host, dataDir };
}
