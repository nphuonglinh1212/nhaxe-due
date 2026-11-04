'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { AppError, bad } = require('./util');
const { createContext } = require('./context');
const { runAll } = require('./scenarios');
const { defineRoutes } = require('./routes');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const PUBLIC = path.join(__dirname, '..', 'public');

function createApp(dbFile) {
  const ctx = createContext(dbFile);
  const { svc, q } = ctx;
  const secret = () => svc.webhookSecret();
  const routes = [];
  const on = (method, pattern, handler, opts = {}) => {
    const keys = []; const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, auth: opts.auth !== false });
  };
  const id = (p) => { const n = Number(p); if (!Number.isInteger(n) || n < 1) throw bad('Mã không hợp lệ'); return n; };
  defineRoutes(on, { svc, runAll, id, AppError });

  /* ---- xử lý yêu cầu ---- */
  const ROLE_PAGES = { '/nguoi-gui-xe.html': 'NGX', '/nhan-vien.html': 'NV', '/quan-ly.html': 'QL', '/quan-tri.html': 'ADMIN' };
  const HOME = { NGX: '/nguoi-gui-xe.html', NV: '/nhan-vien.html', QL: '/quan-ly.html', ADMIN: '/quan-tri.html' };
  const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' };
  function parseCookies(h) { const o = {}; String(h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }); return o; }
  function send(res, status, obj) { const b = JSON.stringify(obj); res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC }); res.end(b); }
  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', c => { size += c.length; if (size > 1e6) { reject(new AppError(413, 'too_large', 'Dữ liệu quá lớn')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(bad('JSON không hợp lệ')); } });
      req.on('error', reject);
    });
  }
  function serveStatic(req, res, pathname) {
    if (ROLE_PAGES[pathname]) { // mỗi vai trò có trang riêng: sai vai trò thì chuyển về trang của mình hoặc về đăng nhập
      const u = svc.userByToken(parseCookies(req.headers.cookie).sid);
      if (!u || u.role !== ROLE_PAGES[pathname]) { res.writeHead(302, { Location: u ? HOME[u.role] : '/app.html' }); return res.end(); }
    }
    let rel = pathname === '/' ? '/index.html' : pathname;
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Không tìm thấy trang'); }
      const h = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', ...SEC };
      if (rel === '/app.html' || ROLE_PAGES[rel]) h['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data: https://img.vietqr.io; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
      res.writeHead(200, h); res.end(data);
    });
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x'); const pathname = decodeURIComponent(url.pathname);
      if (!pathname.startsWith('/api/')) { if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); } return serveStatic(req, res, pathname); }
      const route = routes.find(r => r.method === req.method && r.re.test(pathname));
      if (!route) { if (routes.some(r => r.re.test(pathname))) return send(res, 405, { error: 'method_not_allowed', message: 'Sai phương thức' }); return send(res, 404, { error: 'not_found', message: 'Không có API này' }); }
      const m = route.re.exec(pathname); const params = {}; route.keys.forEach((k, i) => params[k] = m[i + 1]);
      let body = {};
      if (req.method !== 'GET') {
        const ct = String(req.headers['content-type'] || '');
        if (!ct.includes('application/json') && route.auth) throw new AppError(415, 'bad_content_type', 'Cần Content-Type: application/json');
        body = await readBody(req); if (body === null || typeof body !== 'object' || Array.isArray(body)) throw bad('Nội dung phải là một đối tượng JSON');
      }
      const token = parseCookies(req.headers.cookie).sid; let user = null;
      if (route.auth) { user = svc.userByToken(token); if (!user) throw new AppError(401, 'unauthorized', 'Bạn cần đăng nhập'); }
      const out = route.handler({ params, body, user, token, query: Object.fromEntries(url.searchParams), ip: req.socket.remoteAddress,
        header: (n) => req.headers[n] || '',
        setSession: (tk) => res.setHeader('Set-Cookie', `sid=${tk}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`),
        clearSession: () => res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0') });
      send(res, 200, out === undefined ? { ok: true } : out);
    } catch (e) {
      if (e instanceof AppError) return send(res, e.status, { error: e.code, message: e.message });
      console.error(e); send(res, 500, { error: 'server_error', message: 'Lỗi hệ thống' });
    }
  });
  return { server, ctx, secret };
}
module.exports = { createApp };
