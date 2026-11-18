import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runtimeConfig } from './config.js';
import { createAccess } from './auth.js';
import { createCommunityDatabase, communityErrorDiagnostic } from './community-db.js';
import { validateContribution, CONTRIBUTION_VERSION, MIN_CONTRIBUTORS } from './contribution-model.js';
import { createPushService } from './push-server.js';
import { validatePush } from './reminder-model.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = runtimeConfig(root);
const access = createAccess(config);
const community = createCommunityDatabase();
const push = createPushService(config);
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
  '/saude': ['public/saude.html', 'text/html; charset=utf-8'],
  '/relatorio': ['public/relatorio.html', 'text/html; charset=utf-8'],
  '/comunidade': ['public/comunidade.html', 'text/html; charset=utf-8'],
  '/login': ['public/login.html', 'text/html; charset=utf-8'],
  '/manifest.webmanifest': ['public/manifest.webmanifest', 'application/manifest+json'],
};
for (const file of ['app.js', 'dashboard.js', 'dados.js', 'install.js', 'login.js', 'share.js', 'sw.js', 'saude.js', 'relatorio.js', 'comunidade.js', 'contribute.js', 'push-client.js', 'reference-dialog.js']) files[`/${file}`] = [`public/${file}`, 'text/javascript; charset=utf-8'];
for (const file of ['styles.css', 'mobile.css', 'dashboard.css', 'landing.css', 'share.css', 'features.css']) files[`/${file}`] = [`public/${file}`, 'text/css; charset=utf-8'];
for (const file of ['shared.js', 'analytics.js', 'csv.js', 'local-data.js', 'share-data.js', 'health-model.js', 'contribution-model.js', 'pdf-report.js', 'medication-catalog.js']) files[`/${file}`] = [file, 'text/javascript; charset=utf-8'];
files['/vendor/jspdf.umd.min.js'] = ['public/vendor/jspdf.umd.min.js', 'text/javascript; charset=utf-8'];
for (const file of ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png']) files[`/icons/${file}`] = [`public/icons/${file}`, 'image/png'];

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, mode: 'local-pwa' });
    if (req.method === 'GET' && url.pathname === '/api/community/status') return json(res, 200, { configured: community.configured, minimumContributors: MIN_CONTRIBUTORS });
    if (req.method === 'GET' && url.pathname === '/api/community/summary') {
      try { return json(res, 200, { groups: await community.summary(), minimumContributors: MIN_CONTRIBUTORS }); }
      catch (error) { console.error('Community:', communityErrorDiagnostic(error)); return json(res, 503, { error: 'Análise geral ainda indisponível. O diário local continua funcionando.' }); }
    }
    if (req.method === 'GET' && url.pathname === '/api/push/config') {
      try { return json(res, 200, await push.configuration()); }
      catch { return json(res, 200, { enabled: false, message: 'Armazenamento privado de lembretes indisponível.' }); }
    }
    if (['/api/community/contribution', '/api/push/subscription'].includes(url.pathname) && ['POST', 'DELETE'].includes(req.method)) {
      if (!req.headers['content-type']?.startsWith('application/json') || req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Solicitação inválida.' });
      let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 500000) return json(res, 413, { error: 'Envio muito grande.' }); }
      let body; try { body = JSON.parse(raw); } catch { return json(res, 400, { error: 'Formato inválido.' }); }
      try {
        if (req.method === 'DELETE' && !/^[a-f0-9]{64}$/.test(body?.token || '')) throw new Error('Chave de retirada inválida.');
        if (url.pathname === '/api/community/contribution') {
          const records = req.method === 'POST' ? validateContribution(body) : null;
          try { if (records) await community.save(body.token, records, CONTRIBUTION_VERSION); else await community.remove(body.token); }
          catch (error) { console.error('Community:', communityErrorDiagnostic(error)); return json(res, 503, { error: 'Análise geral indisponível. O registro permanece no dispositivo; o envio pode ser tentado depois.' }); }
        } else {
          const input = req.method === 'POST' ? validatePush(body) : null;
          try { if (input) await push.save(input); else await push.remove(body.token); }
          catch { return json(res, 503, { error: 'Servidor de lembretes indisponível.' }); }
        }
      } catch (error) { return json(res, 400, { error: error.message }); }
      return json(res, 200, { ok: true });
    }
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
push.start();
