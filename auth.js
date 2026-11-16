import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest();

export function createAccess({ password, production }) {
  const enabled = Boolean(password);
  const expected = hash(password);
  const sessions = new Map();
  const attempts = new Map();
  const lifetime = 8 * 60 * 60 * 1000;
  const cookieName = 'entredias_session';
  const cookie = (token, age) => `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${production ? '; Secure' : ''}`;
  function send(res, status, value) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  }
  function tokenOf(req) {
    return (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  }
  return {
    enabled,
    async handle(req, res, url) {
      const now = Date.now();
      for (const [key, expires] of sessions) if (expires <= now) sessions.delete(key);
      for (const [key, attempt] of attempts) if (attempt.until <= now) attempts.delete(key);
      if (url.pathname === '/api/login' && req.method === 'POST') {
        if (!enabled) { send(res, 200, { ok: true }); return true; }
        if (!req.headers['content-type']?.startsWith('application/json') || req.headers['sec-fetch-site'] === 'cross-site') { send(res, 403, { error: 'Solicitação inválida.' }); return true; }
        const address = req.socket.remoteAddress;
        const attempt = attempts.get(address) || { count: 0, until: now + 15 * 60 * 1000 };
        if (attempt.count >= 10) { res.setHeader('Retry-After', Math.ceil((attempt.until - now) / 1000)); send(res, 429, { error: 'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.' }); return true; }
        let body = '';
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 4096) { send(res, 413, { error: 'Solicitação muito grande.' }); return true; } }
        let input;
        try { input = JSON.parse(body); } catch { send(res, 400, { error: 'Solicitação inválida.' }); return true; }
        if (typeof input.password !== 'string' || !timingSafeEqual(hash(input.password), expected)) {
          attempt.count++; attempts.set(address, attempt);
          send(res, 401, { error: 'Senha incorreta.' }); return true;
        }
        attempts.delete(address);
        const token = randomBytes(32).toString('hex');
        sessions.set(hash(token).toString('hex'), now + lifetime);
        res.setHeader('Set-Cookie', cookie(token, lifetime / 1000));
        send(res, 200, { ok: true }); return true;
      }
      const token = tokenOf(req);
      const signedIn = !enabled || (token && sessions.has(hash(token).toString('hex')));
      if (url.pathname === '/logout' && req.method === 'POST') {
        if (token) sessions.delete(hash(token).toString('hex'));
        res.writeHead(303, { Location: '/login', 'Set-Cookie': cookie('', 0), 'Cache-Control': 'no-store' }); res.end(); return true;
      }
      if (url.pathname === '/api/session' && req.method === 'GET') { send(res, signedIn ? 200 : 401, { protected: enabled, signedIn: Boolean(signedIn) }); return true; }
      const publicFiles = ['/login', '/login.js', '/styles.css', '/mobile.css'];
      if (signedIn || publicFiles.includes(url.pathname)) return false;
      if (url.pathname.startsWith('/api/')) send(res, 401, { error: 'Entre novamente para acessar seu diário.' });
      else { res.writeHead(303, { Location: '/login', 'Cache-Control': 'no-store' }); res.end(); }
      return true;
    },
  };
}
