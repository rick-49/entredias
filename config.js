import path from 'node:path';

export function runtimeConfig(root, env = process.env) {
  const production = env.NODE_ENV === 'production';
  const host = env.HOST || (production ? '0.0.0.0' : '127.0.0.1');
  // A senha protege somente a exportação antiga. O diário da PWA é local;
  // dataDir também guarda assinaturas push, separadas da análise MySQL.
  const password = env.ENABLE_LEGACY_EXPORT === 'true' && (env.APP_PASSWORD || '').length >= 12 ? env.APP_PASSWORD : '';
  const marker = `${path.sep}hbuilds${path.sep}`;
  const buildIndex = root.indexOf(marker);
  const hostingerDir = buildIndex > 0 ? path.join(root.slice(0, buildIndex), 'entredias-data') : null;
  let dataDir = env.DATA_DIR || (production ? hostingerDir : path.join(root, 'data'));
  if (dataDir && !path.isAbsolute(dataDir)) dataDir = null;
  if (dataDir && production) {
    const relative = path.relative(root, dataDir);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) || dataDir.split(path.sep).some(part => ['public_html', 'hbuilds'].includes(part))) dataDir = null;
  }
  return { production, host, password, dataDir };
}
