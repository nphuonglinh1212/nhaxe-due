'use strict';
/* Máy chủ "ảo" chạy ngay trong trình duyệt: cùng bảng API (routes.js) và cùng quy tắc To-Be (service.js) với bản Node,
   dữ liệu lưu trong localStorage của trình duyệt. Không gửi dữ liệu đi đâu cả. */
const { AppError, bad } = require('./util');
const { createContext } = require('./context');
const { runAll } = require('./scenarios');
const { defineRoutes } = require('./routes');
const { open } = require('./db.mini');

const KEY = 'due_nhaxe_db_v1', STAMP = 'due_nhaxe_stamp_v1', SID = 'due_nhaxe_sid';
let mem = {}; // dự phòng khi trình duyệt chặn localStorage
function ls(kind) { try { return window[kind]; } catch (e) { return null; } }
function get(kind, k) { try { const s = ls(kind); return s ? s.getItem(k) : (mem[kind + k] || null); } catch (e) { return mem[kind + k] || null; } }
function set(kind, k, v) { try { const s = ls(kind); if (s) { s.setItem(k, v); return; } } catch (e) { /* hết dung lượng hoặc bị chặn */ } mem[kind + k] = v; }
function del(kind, k) { try { const s = ls(kind); if (s) s.removeItem(k); } catch (e) { /* bỏ qua */ } delete mem[kind + k]; }

globalThis.DUE_STORAGE = {
  load: () => get('localStorage', KEY),
  save: (t) => { set('localStorage', KEY, t); set('localStorage', STAMP, Date.now() + ':' + Math.random().toString(36).slice(2)); },
  stamp: () => get('localStorage', STAMP),
};
const ctx = createContext('browser', { open });
const { svc, q } = ctx;
const routes = [];
const on = (method, pattern, handler, opts = {}) => {
  const keys = []; const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, auth: opts.auth !== false });
};
const id = (p) => { const n = Number(p); if (!Number.isInteger(n) || n < 1) throw bad('Mã không hợp lệ'); return n; };
defineRoutes(on, { svc, runAll: () => runAll(), id, AppError });
q.flush();

function trimLogs() {
  for (const [t, keep] of [['audit', 3000], ['gateway_log', 3000]]) {
    const r = q.get(`SELECT COUNT(*) c, COALESCE(MAX(id),0) m FROM ${t}`);
    if (r.c > keep + 500) q.run(`DELETE FROM ${t} WHERE id<?`, r.m - keep);
  }
}
function call(path, method, bodyObj) {
  method = (method || 'GET').toUpperCase();
  const url = new URL(path, 'http://local'); const pathname = url.pathname;
  const route = routes.find((r) => r.method === method && r.re.test(pathname));
  if (!route) throw new AppError(404, 'not_found', 'Không có API này');
  const m = route.re.exec(pathname); const params = {}; route.keys.forEach((k, i) => { params[k] = m[i + 1]; });
  let body = {};
  if (method !== 'GET') { body = bodyObj == null ? {} : JSON.parse(JSON.stringify(bodyObj)); if (typeof body !== 'object' || Array.isArray(body)) throw bad('Nội dung phải là một đối tượng JSON'); }
  q.sync(); // lấy dữ liệu mới nhất nếu tab khác vừa ghi
  const token = get('sessionStorage', SID); let user = null;
  if (route.auth) { user = svc.userByToken(token); if (!user) throw new AppError(401, 'unauthorized', 'Bạn cần đăng nhập'); }
  const out = route.handler({
    params, body, user, token, query: Object.fromEntries(url.searchParams), ip: 'trinh-duyet', header: () => '',
    setSession: (tk) => set('sessionStorage', SID, tk), clearSession: () => del('sessionStorage', SID),
  });
  try { trimLogs(); } catch (e) { /* không chặn nghiệp vụ */ }
  return out === undefined ? { ok: true } : JSON.parse(JSON.stringify(out));
}
function api(path, method, body) {
  return new Promise((resolve, reject) => {
    try { const r = call(path, method, body); q.flush(); resolve(r); }
    catch (e) {
      try { q.flush(); } catch (e2) { /* bỏ qua */ }
      if (e instanceof AppError) { const er = new Error(e.message); er.status = e.status; er.code = e.code; reject(er); }
      else { console.error(e); const er = new Error('Lỗi hệ thống trong trình duyệt'); er.status = 500; er.code = 'server_error'; reject(er); }
    }
  });
}
api.mode = 'local';
window.DUE_LOCAL_API = api;
window.addEventListener('pagehide', () => { try { q.flush(); } catch (e) { /* bỏ qua */ } });
