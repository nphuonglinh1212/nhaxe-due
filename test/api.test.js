'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../lib/app');
const { runAll } = require('../lib/scenarios');

let srv, base; const app = createApp(':memory:');
test.before(async () => { await new Promise(r => app.server.listen(0, r)); base = 'http://127.0.0.1:' + app.server.address().port; });
test.after(() => app.server.close());

async function call(method, path, body, cookie, extra = {}) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const login = async (u) => (await call('POST', '/api/auth/login', { username: u, password: 'Due@2026' })).cookie;

test('mọi kịch bản To-Be đạt (dịch vụ)', () => { for (const s of runAll()) assert.ok(s.pass, `${s.id}: ${s.error}`); });
test('API cần đăng nhập: không cookie -> 401', async () => { assert.equal((await call('GET', '/api/me/overview')).status, 401); });
test('đăng nhập sai -> 401, đúng -> 200 và đặt cookie HttpOnly', async () => {
  assert.equal((await call('POST', '/api/auth/login', { username: 'admin', password: 'sai' })).status, 401);
  const r = await call('POST', '/api/auth/login', { username: 'admin', password: 'Due@2026' }); assert.equal(r.status, 200); assert.ok(r.cookie.startsWith('sid='));
});
test('phân quyền: người gửi xe gọi API quản lý -> 403', async () => {
  const c = await login('sv2021001'); assert.equal((await call('GET', '/api/manager/queue', null, c)).status, 403); assert.equal((await call('GET', '/api/admin/users', null, c)).status, 403);
});
test('đăng ký công khai và Quản lý duyệt qua HTTP', async () => {
  const r = await call('POST', '/api/public/register', { full_name: 'Khách Hai', user_type: 'kh', plate: '43D-55555', username: 'khachhttp', password: 'matkhau123' });
  assert.equal(r.status, 200); assert.equal(r.body.status, 'pending');
  const ql = await login('quanly'); const q = await call('GET', '/api/manager/queue', null, ql); assert.ok(q.body.registrations.some(x => x.id === r.body.id));
  assert.equal((await call('POST', '/api/manager/registrations/' + r.body.id, { approve: true }, ql)).body.status, 'approved');
  assert.equal((await call('POST', '/api/auth/login', { username: 'khachhttp', password: 'matkhau123' })).status, 200);
});
test('webhook ngân hàng: sai bí mật -> 401, đúng -> cộng lượt', async () => {
  const sv = await login('sv2021001'); const t = await call('POST', '/api/me/topups', { product: 'luot100', method: 'vietqr' }, sv); assert.equal(t.status, 200);
  assert.equal((await call('POST', '/api/webhook/bank', { ref: t.body.ref, amount: 100000 }, null, { 'X-Webhook-Secret': 'sai' })).status, 401);
  const ok = await call('POST', '/api/webhook/bank', { ref: t.body.ref, amount: 100000 }, null, { 'X-Webhook-Secret': app.secret() }); assert.equal(ok.body.status, 'confirmed');
});
test('chặn POST không phải JSON (chống CSRF dạng form)', async () => {
  const r = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' }); assert.ok([401, 415].includes(r.status));
  const sv = await login('sv2021001');
  const r2 = await fetch(base + '/api/me/lost', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sv }, body: 'card_id=1' }); assert.equal(r2.status, 415);
});
test('mỗi vai trò có trang riêng: sai vai trò bị chuyển hướng', async () => {
  const sv = await login('sv2021001'), nv = await login('nhanvien');
  const go = (p, c) => fetch(base + p, { redirect: 'manual', headers: c ? { Cookie: c } : {} });
  assert.equal((await go('/nhan-vien.html')).status, 302);
  const r1 = await go('/nhan-vien.html', sv); assert.equal(r1.status, 302); assert.equal(r1.headers.get('location'), '/nguoi-gui-xe.html');
  assert.equal((await go('/nhan-vien.html', nv)).status, 200); assert.equal((await go('/nguoi-gui-xe.html', sv)).status, 200);
  assert.equal((await go('/quan-tri.html', nv)).headers.get('location'), '/nhan-vien.html');
});
test('nhân viên dùng API hỗ trợ: tra cứu, ca trực; người gửi xe bị chặn', async () => {
  const nv = await login('nhanvien'), sv = await login('sv2021001');
  assert.equal((await call('GET', '/api/staff/lookup?q=43A-12345', null, nv)).body[0].username, 'sv2021001');
  assert.equal((await call('GET', '/api/staff/shift', null, nv)).status, 200); assert.equal((await call('GET', '/api/staff/shift', null, sv)).status, 403);
});
test('ngăn đọc file ngoài thư mục public', async () => {
  const r = await fetch(base + '/..%2fserver.js'); assert.ok([403, 404].includes(r.status));
});
test('admin: chạy kiểm thử trong ứng dụng, nhập dữ liệu giảng viên, xuất dữ liệu', async () => {
  const ad = await login('admin');
  const st = await call('POST', '/api/admin/selftest', {}, ad); assert.ok(st.body.every(x => x.pass));
  const im = await call('POST', '/api/admin/import', { directory: [{ code: 'GV9001', full_name: 'Giảng Viên Chấm', user_type: 'cb' }], users: [{ username: 'gvtest', display_name: 'GV Test', role: 'NGX', plate: '43E-77777', passes: 5 }] }, ad); assert.equal(im.body.users, 1);
  assert.ok((await call('GET', '/api/admin/export', null, ad)).body.users.some(u => u.username === 'gvtest'));
  const fl = await call('GET', '/api/admin/flows', null, ad); assert.ok(fl.body.length >= 10);
});
test('JSON sai định dạng -> 400, mật khẩu không bị lộ trong dữ liệu xuất', async () => {
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' }); assert.equal(r.status, 400);
  const ad = await login('admin'); const ex = JSON.stringify((await call('GET', '/api/admin/export', null, ad)).body); assert.ok(!ex.includes('pass_hash'));
});
