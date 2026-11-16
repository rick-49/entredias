import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runtimeConfig } from './config.js';
import { createAccess } from './auth.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = runtimeConfig(root);
const access = createAccess(config);
let legacyDiary;

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
const files = {
  '/': ['public/landing.html', 'text/html; charset=utf-8'],
  '/app': ['public/index.html', 'text/html; charset=utf-8'],
  '/dashboard': ['public/dashboard.html', 'text/html; charset=utf-8'],
  '/dados': ['public/dados.html', 'text/html; charset=utf-8'],
  '/login': ['public/login.html', 'text/html; charset=utf-8'],
  '/manifest.webmanifest': ['public/manifest.webmanifest', 'application/manifest+json'],
};
for (const file of ['app.js', 'dashboard.js', 'dados.js', 'install.js', 'login.js', 'share.js', 'sw.js']) files[`/${file}`] = [`public/${file}`, 'text/javascript; charset=utf-8'];
for (const file of ['styles.css', 'mobile.css', 'dashboard.css', 'landing.css', 'share.css']) files[`/${file}`] = [`public/${file}`, 'text/css; charset=utf-8'];
for (const file of ['shared.js', 'analytics.js', 'csv.js', 'local-data.js', 'share-data.js']) files[`/${file}`] = [file, 'text/javascript; charset=utf-8'];
for (const file of ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png']) files[`/icons/${file}`] = [`public/icons/${file}`, 'image/png'];

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, mode: 'local-pwa' });
    if (req.method === 'GET' && files[url.pathname]) {
      const [file, type] = files[url.pathname];
      if (url.pathname === '/sw.js') res.setHeader('Service-Worker-Allowed', '/');
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      return res.end(readFileSync(path.join(root, file)));
    }
    // Rota de migração opcional, nunca usada pela PWA e nunca armazenada pelo SW.
    if (['/api/legacy/backup', '/api/login', '/api/session', '/logout'].includes(url.pathname)) {
      if (!access.enabled) return json(res, 403, { error: 'Exportação da instalação antiga desabilitada.' });
      if (await access.handle(req, res, url)) return;
      if (req.method === 'GET' && url.pathname === '/api/legacy/backup') {
        if (!config.dataDir || !existsSync(path.join(config.dataDir, 'diary.sqlite'))) return json(res, 404, { error: 'Banco antigo não encontrado nesta instalação.' });
        if (!legacyDiary) { const { openDiary } = await import('./database.js'); legacyDiary = openDiary(config.dataDir); }
        res.setHeader('Content-Disposition', 'attachment; filename="entre-dias-backup-anterior.json"');
        return json(res, 200, { app: 'entre-dias', version: 1, exportedAt: new Date().toISOString(), assessments: legacyDiary.all() });
      }
    }
    if (url.pathname.startsWith('/api/')) return json(res, 410, { error: 'Esta versão salva seus registros somente no dispositivo. Instale o app pela página inicial.' });
    json(res, 404, { error: 'Página não encontrada.' });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: 'Não foi possível atender a solicitação.' }); else res.end();
  }
});
const port = Number(process.env.PORT || 3000);
server.listen(port, config.host, () => console.log(`Entre dias disponível em http://localhost:${server.address().port}`));
