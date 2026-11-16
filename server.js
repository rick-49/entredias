import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MOODS, validateAssessment } from './shared.js';
import { openDiary } from './database.js';
import { entriesToCsv } from './csv.js';
import { runtimeConfig } from './config.js';
import { createAccess } from './auth.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = runtimeConfig(root);
const diary = openDiary(config.dataDir);
const access = createAccess(config);

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

const files = {
  '/login': ['public/login.html', 'text/html; charset=utf-8'],
  '/login.js': ['public/login.js', 'text/javascript; charset=utf-8'],
  '/session.js': ['public/session.js', 'text/javascript; charset=utf-8'],
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/dashboard': ['public/dashboard.html', 'text/html; charset=utf-8'],
  '/dashboard.js': ['public/dashboard.js', 'text/javascript; charset=utf-8'],
  '/dashboard.css': ['public/dashboard.css', 'text/css; charset=utf-8'],
  '/analytics.js': ['analytics.js', 'text/javascript; charset=utf-8'],
  '/app.js': ['public/app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['public/styles.css', 'text/css; charset=utf-8'],
  '/mobile.css': ['public/mobile.css', 'text/css; charset=utf-8'],
  '/shared.js': ['shared.js', 'text/javascript; charset=utf-8'],
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
    if (await access.handle(req, res, url)) return;
    if (req.headers['sec-fetch-site'] === 'cross-site' && !['GET', 'HEAD'].includes(req.method)) return json(res, 403, { error: 'Solicitação inválida.' });
    if (req.method === 'GET' && url.pathname === '/api/moods') return json(res, 200, MOODS);
    if (url.pathname.startsWith('/api/entries')) return json(res, 410, { error: 'O diário foi atualizado para avaliações por horário. Atualize a página para continuar.' });
    if (req.method === 'GET' && url.pathname === '/api/assessments') return json(res, 200, diary.all());
    if (req.method === 'GET' && url.pathname === '/api/export.csv') {
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="entre-dias.csv"',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      return res.end(entriesToCsv(diary.all()));
    }
    const assessmentRoute = /^\/api\/assessments\/([a-f0-9-]{36})$/i.exec(url.pathname);
    if (req.method === 'DELETE' && assessmentRoute) {
      const removed = diary.remove(assessmentRoute[1]);
      return json(res, removed ? 200 : 404, { ok: removed });
    }
    if (req.method === 'PUT' && assessmentRoute) {
      const id = assessmentRoute[1];
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 24000) return json(res, 413, { error: 'Registro muito grande.' });
      }
      let input;
      try { input = JSON.parse(body); } catch { return json(res, 400, { error: 'Registro inválido.' }); }
      const existing = diary.all().find(entry => entry.id === id);
      const error = validateAssessment(input, existing?.time === null);
      if (error) return json(res, 400, { error });
      const entry = diary.save(id, input);
      return json(res, 200, entry);
    }
    if (req.method === 'GET' && files[url.pathname]) {
      const [file, type] = files[url.pathname];
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(readFileSync(path.join(root, file)));
    }
    json(res, 404, { error: 'Página não encontrada.' });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: 'Não foi possível salvar. Tente novamente.' });
    else res.end();
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, config.host, () => console.log(`Entre dias disponível em http://localhost:${server.address().port}`));
