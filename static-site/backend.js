/* Tự sinh bởi scripts/build-static.js — đừng sửa tay */
(function(){"use strict";
var defs={},cache={};
var assert=(function(){function F(m){var e=new Error(m);e.name="AssertionError";return e}
function eq(a,b){return a===b||(typeof a==="number"&&typeof b==="number"&&a!==a&&b!==b)}
function loose(a,b){return a==b}
var A={ok:function(v,m){if(!v)throw F(m||"giá trị không đúng: "+v)},equal:function(a,b,m){if(!loose(a,b))throw F(m||("khác nhau: "+JSON.stringify(a)+" != "+JSON.stringify(b)))},match:function(s,re,m){if(!re.test(String(s)))throw F(m||("không khớp "+re+": "+s))},throws:function(fn,re,m){var t=false;try{fn()}catch(e){t=true;if(re instanceof RegExp&&!re.test(String(e&&e.message)))throw F(m||("lỗi không khớp "+re+": "+(e&&e.message)))}if(!t)throw F(m||"cần có lỗi nhưng không có")}};return A})();
defs["util"]=function(module,exports,require){
'use strict';
const P = require('./platform');

class AppError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const bad = (m, code = 'bad_request') => new AppError(400, code, m);
const forbidden = (m = 'Không đủ quyền thực hiện thao tác này') => new AppError(403, 'forbidden', m);
const notFound = (m = 'Không tìm thấy dữ liệu') => new AppError(404, 'not_found', m);
const conflict = (m, code = 'conflict') => new AppError(409, code, m);

function hashPassword(pw, salt) { salt = salt || P.randomHex(16); return { salt, hash: P.kdf(pw, salt) }; }
function verifyPassword(pw, salt, hash) { return P.safeEqual(P.kdf(pw, salt), hash); }
const token = (n = 32) => P.randomHex(n);
const refCode = () => 'DUE' + P.randomHex(5).toUpperCase();

// bỏ dấu tiếng Việt, hạ chữ thường, gộp khoảng trắng: dùng để so khớp tên
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
// biển số: bỏ khoảng trắng, in hoa, kiểm tra dạng 43A-12345, 43B1-123.45
function normPlate(p) {
  const s = String(p || '').toUpperCase().replace(/\s+/g, '');
  if (!/^\d{2}[A-Z][A-Z0-9]?-?(\d{3}\.\d{2}|\d{4,5})$/.test(s)) return null;
  return s.includes('-') ? s : s.replace(/^(\d{2}[A-Z][A-Z0-9]?)(\d)/, (m, a, b) => a + '-' + b);
}
const str = (v, min, max, label) => {
  const s = String(v == null ? '' : v).trim();
  if (s.length < min || s.length > max) throw bad(`${label} phải dài ${min}–${max} ký tự`);
  return s;
};
const safeEqual = (a, b) => P.safeEqual(a, b);
module.exports = { safeEqual, AppError, bad, forbidden, notFound, conflict, hashPassword, verifyPassword, token, refCode, norm, normPlate, str };

};
defs["platform.browser"]=function(module,exports,require){
'use strict';
// Phần phụ thuộc nền tảng cho bản chạy trong trình duyệt (không cần máy chủ).
// Băm mật khẩu bằng SHA-256 lặp nhiều vòng có muối: đủ cho bản demo, KHÔNG thay thế scrypt/argon2 của bản máy chủ.
const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function utf8(s) { return new TextEncoder().encode(s); }
function sha256(bytes) {
  const l = bytes.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n);
  m.set(bytes); m[l] = 0x80; const dv = new DataView(m.buffer); dv.setUint32(n - 4, (l * 8) >>> 0); dv.setUint32(n - 8, Math.floor(l / 0x20000000));
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]), w = new Uint32Array(64);
  const rr = (x, k) => (x >>> k) | (x << (32 - k));
  for (let i = 0; i < n; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) { const a = w[t - 15], b = w[t - 2]; w[t] = (w[t - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[t - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) >>> 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32), o = new DataView(out.buffer); for (let i = 0; i < 8; i++) o.setUint32(i * 4, H[i]); return out;
}
const hex = (u) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('');
module.exports = {
  sha256hex: (s) => hex(sha256(utf8(s))),
  randomHex(n) { const u = new Uint8Array(n); (globalThis.crypto || {}).getRandomValues ? globalThis.crypto.getRandomValues(u) : u.forEach((_, i) => { u[i] = Math.floor(Math.random() * 256); }); return hex(u); },
  kdf(pw, salt) { let h = sha256(utf8(salt + '|' + pw)); const sp = utf8(salt + pw); for (let i = 0; i < 4000; i++) { const b = new Uint8Array(h.length + sp.length); b.set(h); b.set(sp, h.length); h = sha256(b); } return hex(h); },
  safeEqual(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; },
};

};
defs["flows"]=function(module,exports,require){
'use strict';
// Các cổng quyết định (gateway) lấy từ mô hình BPMN To-Be, kèm trang mô hình và chức năng phần mềm tương ứng.
const GATEWAYS = [
  { id: 'G01', name: 'Người đăng ký có trong CSDL SV/CB DUE?', type: 'XOR', page: 'Trang 2 – Đăng ký', lane: 'Hệ thống',
    branches: { trong_csdl: 'Có: tự duyệt, cấp thẻ ảo', khach_vang_lai: 'Không / khách vãng lai: chuyển Quản lý' }, impl: 'POST /api/public/register' },
  { id: 'G02', name: 'Quản lý duyệt đăng ký?', type: 'XOR duyệt', page: 'Trang 2 – Đăng ký', lane: 'Quản lý',
    branches: { duyet: 'Duyệt: cấp thẻ ảo', tu_choi: 'Từ chối: thông báo kết quả' }, impl: 'POST /api/manager/registrations/:id' },
  { id: 'G03', name: 'Thẻ hợp lệ (đúng chủ, đúng biển số, không bị khóa)?', type: 'XOR', page: 'Trang 3, 5 – Vào/Ra bãi', lane: 'Hệ thống',
    branches: { hop_le: 'Hợp lệ: tiếp tục', khong_hop_le: 'Không hợp lệ: từ chối' }, impl: 'POST /api/gate/:direction' },
  { id: 'G04', name: 'Thẻ còn hiệu lực hoặc còn lượt?', type: 'XOR', page: 'Trang 3 – Vào bãi', lane: 'Hệ thống',
    branches: { con_luot: 'Còn quyền gửi (vé tháng hiệu lực hoặc còn lượt)', het_luot: 'Hết hạn / hết lượt: chuyển nạp hoặc nhân viên hỗ trợ' }, impl: 'POST /api/gate/in' },
  { id: 'G05', name: 'Khu G hoặc Khu D còn chỗ trống (cảm biến)?', type: 'XOR', page: 'Trang 3 – Vào bãi', lane: 'Hệ thống',
    branches: { con_cho: 'Còn chỗ: AND mở barrier + LED + chụp ảnh', het_cho: 'Hết chỗ: báo và chờ tín hiệu' }, impl: 'POST /api/gate/in' },
  { id: 'G06', name: 'Độ tin cậy AI đạt ngưỡng?', type: 'XOR', page: 'Trang 5 – Ra bãi', lane: 'Hệ thống',
    branches: { dat_nguong: 'Đạt ngưỡng: tự mở cổng', duoi_nguong: 'Dưới ngưỡng: ghi nhận lần thất bại' }, impl: 'POST /api/gate/:direction' },
  { id: 'G07', name: 'Đã thất bại đủ số lần tối đa?', type: 'XOR', page: 'Trang 5 – Ra bãi', lane: 'Hệ thống',
    branches: { chua_du: 'Chưa đủ: thử lại', du_lan: 'Đủ lần: nhân viên hỗ trợ tại chỗ' }, impl: 'POST /api/gate/:direction' },
  { id: 'G08', name: 'Nhân viên xác minh được danh tính?', type: 'XOR duyệt', page: 'Trang 4 – Xác minh thủ công', lane: 'Nhân viên',
    branches: { xac_minh_duoc: 'Được: cho qua cổng', khong_xac_minh_duoc: 'Không: leo thang Quản lý' }, impl: 'POST /api/staff/assist/:id' },
  { id: 'G09', name: 'Quản lý cho phép sau leo thang?', type: 'XOR duyệt', page: 'Trang 4 – Xác minh thủ công', lane: 'Quản lý',
    branches: { cho_phep: 'Cho phép: mở cổng', khoa_phien: 'Khóa phiên và báo an ninh' }, impl: 'POST /api/manager/escalations/:id' },
  { id: 'G10', name: 'Phương thức nạp lượt?', type: 'XOR', page: 'Trang 6 – Nạp lượt', lane: 'Người gửi xe',
    branches: { tien_mat: 'Tiền mặt: nhân viên xác nhận', vietqr: 'VietQR: ngân hàng xác nhận' }, impl: 'POST /api/me/topups' },
  { id: 'G11', name: 'Nhân viên xác nhận đã nhận tiền mặt?', type: 'XOR duyệt', page: 'Trang 6 – Nạp lượt', lane: 'Nhân viên',
    branches: { xac_nhan: 'Xác nhận: cộng lượt', tu_choi: 'Từ chối' }, impl: 'POST /api/staff/topups/:id' },
  { id: 'G12', name: 'Ngân hàng xác nhận VietQR trong hạn?', type: 'Event-based', page: 'Trang 6 – Nạp lượt', lane: 'Ngân hàng',
    branches: { xac_nhan: 'Xác nhận: cộng lượt', het_han_thu_lai: 'Hết hạn: cho thử lại', het_han_that_bai: 'Hết hạn và hết lần thử: thất bại' }, impl: 'POST /api/webhook/bank' },
  { id: 'G13', name: 'Quản lý duyệt cấp lại thẻ?', type: 'XOR duyệt', page: 'Trang 7 – Báo mất thẻ', lane: 'Quản lý',
    branches: { duyet: 'Duyệt: cấp thẻ mới, chuyển lượt', tu_choi: 'Từ chối: kết thúc' }, impl: 'POST /api/manager/lost/:id' },
];
GATEWAYS.splice(0, 0, { id: 'G15', name: 'Thông tin đăng ký hợp lệ (định dạng, không trùng biển số)?', type: 'XOR', page: 'Trang 2 – Đăng ký', lane: 'Hệ thống',
    branches: { hop_le: 'Hợp lệ: tiếp tục đối chiếu CSDL', khong_hop_le: 'Sai định dạng hoặc trùng biển số: yêu cầu sửa' }, impl: 'POST /api/public/register' });
GATEWAYS.push({ id: 'G14', name: 'Nhân viên giải quyết được sự cố ở cổng vào?', type: 'XOR duyệt', page: 'Trang 3 – GĐ2b Hỗ trợ cổng vào', lane: 'Nhân viên',
    branches: { giai_quyet_duoc: 'Được: thu tiền / cấp lượt tạm, cho vào', tu_choi_vao_bai: 'Không: từ chối vào bãi' }, impl: 'POST /api/staff/support/:id' });
GATEWAYS.sort((a, b) => a.id.localeCompare(b.id));
const PRODUCTS = {
  thang: { label: 'Vé tháng', desc: 'Không giới hạn lượt gửi trong thời gian thẻ còn hiệu lực', for: ['sv', 'cb'] },
  luot100: { label: 'Vé 100 lượt', desc: 'Gồm sẵn 100 lượt, hết lượt thì nạp thêm', for: ['sv', 'cb'] },
  khach: { label: 'Vé khách vãng lai', desc: 'Dành cho khách ngoài trường, 2.000 đ mỗi lượt, do Quản lý duyệt đăng ký', for: ['kh'] },
};
const ZONES = ['G', 'D'];
const DEFAULT_SETTINGS = {
  site_name: 'Nhà xe DUE',
  address: '71 Ngũ Hành Sơn, Đà Nẵng',
  // Thông tin liên hệ và ngân hàng dưới đây là DỮ LIỆU GIẢ để demo, cần thay bằng thông tin thật trước khi dùng.
  phone: '0900 000 000', email: 'nhaxe@due-demo.example', open_hours: '06:00 – 21:00, Thứ Hai đến Chủ nhật',
  price_thang: '50000', days_thang: '30',
  price_luot100: '100000', passes_luot100: '100',
  price_khach: '2000', passes_khach: '1',
  cap_G: '400', cap_D: '500', guide_timeout_min: '3',
  ai_threshold: '0.95',
  max_retries: '3',
  qr_ttl_seconds: '180',
  bank_bin: '970422', bank_account: '0000000000', bank_holder: 'NHA XE DUE DEMO',
  show_demo_accounts: '1',
  retention_days: '30',
};
module.exports = { GATEWAYS, DEFAULT_SETTINGS, PRODUCTS, ZONES };

};
defs["minisql"]=function(module,exports,require){
'use strict';
/* Bộ xử lý lệnh dữ liệu nhỏ (một tập con của SQL) chạy thuần JavaScript, dùng cho bản trình duyệt.
   Hỗ trợ đúng những câu lệnh mà ứng dụng dùng: SELECT (JOIN, LEFT JOIN, WHERE, GROUP BY, ORDER BY, LIMIT, COUNT/SUM/MAX/COALESCE),
   INSERT (OR REPLACE/IGNORE, ON CONFLICT DO UPDATE), UPDATE, DELETE. Kết quả được đối chiếu với SQLite bằng bộ 36 kịch bản. */
const TOK = /\s+|('(?:[^']|'')*')|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|<>|!=|\|\||[=<>+\-*(),.?])/y;
function lex(sql) {
  const out = []; TOK.lastIndex = 0; let n = 0;
  while (TOK.lastIndex < sql.length) {
    const st = TOK.lastIndex, m = TOK.exec(sql);
    if (!m || m.index !== st) throw new Error('SQL lỗi gần: ' + sql.slice(st, st + 20));
    if (m[1] !== undefined) out.push({ t: 's', v: m[1].slice(1, -1).replace(/''/g, "'") });
    else if (m[2] !== undefined) out.push({ t: 'n', v: Number(m[2]) });
    else if (m[3] !== undefined) out.push({ t: 'i', v: m[3], u: m[3].toUpperCase() });
    else if (m[4] !== undefined) out.push({ t: 'o', v: m[4], i: m[4] === '?' ? n++ : -1 });
  }
  return out;
}
class Parser {
  constructor(sql) { this.k = lex(sql); this.p = 0; }
  peek() { return this.k[this.p]; }
  isKw(...w) { const t = this.k[this.p]; return t && t.t === 'i' && w.includes(t.u); }
  isOp(v) { const t = this.k[this.p]; return t && t.t === 'o' && t.v === v; }
  eatKw(...w) { if (this.isKw(...w)) return this.k[this.p++].u; return null; }
  eatOp(v) { if (this.isOp(v)) { this.p++; return true; } return false; }
  needKw(w) { if (!this.eatKw(w)) throw new Error('SQL cần ' + w); }
  needOp(v) { if (!this.eatOp(v)) throw new Error('SQL cần ' + v); }
  ident() { const t = this.k[this.p++]; if (!t || t.t !== 'i') throw new Error('SQL cần tên'); return t.v; }
  /* biểu thức */
  or() { let l = this.and(); while (this.eatKw('OR')) l = { k: 'or', a: l, b: this.and() }; return l; }
  and() { let l = this.not(); while (this.eatKw('AND')) l = { k: 'and', a: l, b: this.not() }; return l; }
  not() { if (this.eatKw('NOT')) return { k: 'not', a: this.not() }; return this.cmp(); }
  cmp() {
    const l = this.add(); const t = this.peek();
    if (t && t.t === 'o' && ['=', '!=', '<>', '<', '>', '<=', '>='].includes(t.v)) { this.p++; return { k: 'cmp', op: t.v === '<>' ? '!=' : t.v, a: l, b: this.add() }; }
    if (this.eatKw('IS')) { const neg = !!this.eatKw('NOT'); this.needKw('NULL'); return { k: 'isnull', a: l, neg }; }
    let neg = false; if (this.isKw('NOT')) { neg = true; this.p++; }
    if (this.eatKw('IN')) { this.needOp('('); const list = [this.or()]; while (this.eatOp(',')) list.push(this.or()); this.needOp(')'); return { k: 'in', a: l, list, neg }; }
    if (this.eatKw('LIKE')) return { k: 'like', a: l, b: this.add(), neg };
    if (neg) throw new Error('SQL NOT không hợp lệ');
    return l;
  }
  add() { let l = this.prim(); for (;;) { const t = this.peek(); if (t && t.t === 'o' && ['+', '-', '||'].includes(t.v)) { this.p++; l = { k: 'bin', op: t.v, a: l, b: this.prim() }; } else return l; } }
  prim() {
    const t = this.k[this.p++]; if (!t) throw new Error('SQL kết thúc đột ngột');
    if (t.t === 'n') return { k: 'lit', v: t.v };
    if (t.t === 's') return { k: 'lit', v: t.v };
    if (t.t === 'o' && t.v === '?') return { k: 'par', i: t.i };
    if (t.t === 'o' && t.v === '(') { const e = this.or(); this.needOp(')'); return e; }
    if (t.t === 'o' && t.v === '-') return { k: 'bin', op: '-', a: { k: 'lit', v: 0 }, b: this.prim() };
    if (t.t === 'i') {
      if (t.u === 'NULL') return { k: 'lit', v: null };
      if (this.isOp('(')) { this.p++; const args = []; let star = false; if (this.eatOp('*')) star = true; else if (!this.isOp(')')) { args.push(this.or()); while (this.eatOp(',')) args.push(this.or()); } this.needOp(')'); return { k: 'fn', name: t.u, args, star }; }
      if (this.eatOp('.')) { const c = this.ident(); return { k: 'col', a: t.v, c }; }
      return { k: 'col', a: null, c: t.v };
    }
    throw new Error('SQL không hiểu: ' + t.v);
  }
}
const AGG = new Set(['COUNT', 'SUM', 'MAX']);
const hasAgg = (n) => !!n && typeof n === 'object' && (n.k === 'fn' && AGG.has(n.name) || ['a', 'b'].some((x) => n[x] && hasAgg(n[x])) || (n.args || n.list || []).some(hasAgg));
const truthy = (v) => v !== null && v !== undefined && v !== 0 && v !== '' && v !== false;
function cmpv(a, b) { const ta = typeof a, tb = typeof b; if (ta === tb) return a < b ? -1 : a > b ? 1 : 0; return ta === 'number' ? -1 : 1; }
const RESERVED_ALIAS = new Set(['FROM', 'WHERE', 'JOIN', 'LEFT', 'INNER', 'ON', 'ORDER', 'GROUP', 'LIMIT', 'AS', 'VALUES', 'SET', 'DESC', 'ASC']);

function parse(sql) {
  const P = new Parser(sql); const w = P.eatKw('SELECT', 'INSERT', 'UPDATE', 'DELETE'); if (!w) throw new Error('SQL không hỗ trợ: ' + sql.slice(0, 30));
  if (w === 'SELECT') {
    const items = [];
    do {
      if (P.isOp('*')) { P.p++; items.push({ star: true }); continue; }
      const t = P.peek(), t2 = P.k[P.p + 1], t3 = P.k[P.p + 2];
      if (t && t.t === 'i' && t2 && t2.t === 'o' && t2.v === '.' && t3 && t3.t === 'o' && t3.v === '*') { P.p += 3; items.push({ star: true, a: t.v }); continue; }
      const e = P.or(); let alias = null;
      if (P.eatKw('AS')) alias = P.ident(); else if (P.peek() && P.peek().t === 'i' && !RESERVED_ALIAS.has(P.peek().u)) alias = P.ident();
      items.push({ e, alias });
    } while (P.eatOp(','));
    P.needKw('FROM'); const tables = [];
    const tref = () => { const name = P.ident(); let alias = name; if (P.peek() && P.peek().t === 'i' && !RESERVED_ALIAS.has(P.peek().u)) alias = P.ident(); return { name, alias }; };
    const from = tref(); const joins = [];
    for (;;) { let left = false; if (P.eatKw('LEFT')) left = true; else P.eatKw('INNER'); if (!P.eatKw('JOIN')) break; const t = tref(); P.needKw('ON'); joins.push({ ...t, left, on: P.or() }); }
    const st = { type: 'select', items, from, joins, where: null, group: [], order: [], limit: null };
    if (P.eatKw('WHERE')) st.where = P.or();
    if (P.eatKw('GROUP')) { P.needKw('BY'); do st.group.push(P.or()); while (P.eatOp(',')); }
    if (P.eatKw('ORDER')) { P.needKw('BY'); do { const e = P.or(); const d = P.eatKw('DESC', 'ASC'); st.order.push({ e, desc: d === 'DESC' }); } while (P.eatOp(',')); }
    if (P.eatKw('LIMIT')) st.limit = P.or();
    return st;
  }
  if (w === 'INSERT') {
    let mode = null; if (P.eatKw('OR')) mode = P.eatKw('REPLACE', 'IGNORE'); P.needKw('INTO'); const table = P.ident(); P.needOp('(');
    const cols = [P.ident()]; while (P.eatOp(',')) cols.push(P.ident()); P.needOp(')'); P.needKw('VALUES'); P.needOp('(');
    const vals = [P.or()]; while (P.eatOp(',')) vals.push(P.or()); P.needOp(')');
    const st = { type: 'insert', table, cols, vals, mode, upsert: null };
    if (P.eatKw('ON')) { P.needKw('CONFLICT'); P.needOp('('); const key = P.ident(); P.needOp(')'); P.needKw('DO'); P.needKw('UPDATE'); P.needKw('SET'); const set = []; do { const c = P.ident(); P.needOp('='); set.push({ c, e: P.or() }); } while (P.eatOp(',')); st.upsert = { key, set }; }
    return st;
  }
  if (w === 'UPDATE') {
    const table = P.ident(); P.needKw('SET'); const set = []; do { const c = P.ident(); P.needOp('='); set.push({ c, e: P.or() }); } while (P.eatOp(','));
    return { type: 'update', table, set, where: P.eatKw('WHERE') ? P.or() : null };
  }
  P.needKw('FROM'); const table = P.ident();
  return { type: 'delete', table, where: P.eatKw('WHERE') ? P.or() : null };
}

class Engine {
  constructor(schema) { this.schema = schema; this.cache = new Map(); this.data = {}; this.depth = 0; this.dirty = false; this.clear(); }
  clear() { this.data = {}; for (const t of Object.keys(this.schema)) this.data[t] = []; }
  load(obj) { this.clear(); if (obj) for (const t of Object.keys(this.schema)) this.data[t] = Array.isArray(obj[t]) ? obj[t] : []; }
  dump() { return this.data; }
  stmt(sql) { let s = this.cache.get(sql); if (!s) { s = parse(sql); this.cache.set(sql, s); } return s; }
  /* đánh giá biểu thức: ctx = {alias: row|null}, grp = mảng ctx của nhóm (cho hàm gộp) */
  ev(n, ctx, par, grp) {
    switch (n.k) {
      case 'lit': return n.v;
      case 'par': return par[n.i] === undefined ? null : par[n.i];
      case 'col': {
        if (n.a) { const r = ctx[n.a]; return r ? (r[n.c] === undefined ? null : r[n.c]) : null; }
        for (const a of Object.keys(ctx)) { const tn = ctx.__t[a]; if (tn && this.schema[tn].cols.includes(n.c)) { const r = ctx[a]; return r ? r[n.c] : null; } }
        throw new Error('Không có cột ' + n.c);
      }
      case 'and': { const a = this.ev(n.a, ctx, par, grp), b = this.ev(n.b, ctx, par, grp); if ((a !== null && !truthy(a)) || (b !== null && !truthy(b))) return 0; return a === null || b === null ? null : 1; }
      case 'or': { const a = this.ev(n.a, ctx, par, grp), b = this.ev(n.b, ctx, par, grp); if (truthy(a) || truthy(b)) return 1; return a === null || b === null ? null : 0; }
      case 'not': { const a = this.ev(n.a, ctx, par, grp); return a === null ? null : truthy(a) ? 0 : 1; }
      case 'cmp': {
        const a = this.ev(n.a, ctx, par, grp), b = this.ev(n.b, ctx, par, grp); if (a === null || b === null) return null; const c = cmpv(a, b);
        return (n.op === '=' ? c === 0 : n.op === '!=' ? c !== 0 : n.op === '<' ? c < 0 : n.op === '>' ? c > 0 : n.op === '<=' ? c <= 0 : c >= 0) ? 1 : 0;
      }
      case 'isnull': { const a = this.ev(n.a, ctx, par, grp); return (a === null) !== n.neg ? 1 : 0; }
      case 'in': {
        const a = this.ev(n.a, ctx, par, grp); if (a === null) return null; let nul = false, hit = false;
        for (const e of n.list) { const v = this.ev(e, ctx, par, grp); if (v === null) nul = true; else if (cmpv(a, v) === 0) { hit = true; break; } }
        const r = hit ? 1 : nul ? null : 0; return r === null ? null : (n.neg ? 1 - r : r);
      }
      case 'like': {
        const a = this.ev(n.a, ctx, par, grp), b = this.ev(n.b, ctx, par, grp); if (a === null || b === null) return null;
        const re = new RegExp('^' + String(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i'); const r = re.test(String(a)) ? 1 : 0; return n.neg ? 1 - r : r;
      }
      case 'bin': {
        const a = this.ev(n.a, ctx, par, grp), b = this.ev(n.b, ctx, par, grp); if (a === null || b === null) return null;
        return n.op === '+' ? Number(a) + Number(b) : n.op === '-' ? Number(a) - Number(b) : String(a) + String(b);
      }
      case 'fn': {
        if (n.name === 'COALESCE') { for (const e of n.args) { const v = this.ev(e, ctx, par, grp); if (v !== null) return v; } return null; }
        if (AGG.has(n.name)) {
          const g = grp || [ctx]; if (n.name === 'COUNT') return n.star ? g.length : g.filter((c) => this.ev(n.args[0], c, par) !== null).length;
          const vs = g.map((c) => this.ev(n.args[0], c, par)).filter((v) => v !== null); if (!vs.length) return null;
          return n.name === 'SUM' ? vs.reduce((x, y) => x + Number(y), 0) : vs.reduce((x, y) => (cmpv(x, y) >= 0 ? x : y));
        }
        throw new Error('Hàm không hỗ trợ: ' + n.name);
      }
    }
    throw new Error('Biểu thức không hỗ trợ');
  }
  select(st, par) {
    const T = { [st.from.alias]: st.from.name }; for (const j of st.joins) T[j.alias] = j.name;
    for (const n of Object.values(T)) if (!this.data[n]) throw new Error('Không có bảng ' + n);
    let rows = this.data[st.from.name].map((r) => ({ [st.from.alias]: r }));
    for (const j of st.joins) {
      const out = [];
      for (const c of rows) { let hit = false; for (const jr of this.data[j.name]) { const x = { ...c, [j.alias]: jr }; Object.defineProperty(x, '__t', { value: T, enumerable: false }); if (truthy(this.ev(j.on, x, par))) { out.push(x); hit = true; } } if (!hit && j.left) out.push({ ...c, [j.alias]: null }); }
      rows = out;
    }
    rows.forEach((r) => Object.defineProperty(r, '__t', { value: T, enumerable: false }));
    if (st.where) rows = rows.filter((c) => truthy(this.ev(st.where, c, par)));
    const aggregated = st.items.some((i) => i.e && hasAgg(i.e)) || st.group.length > 0;
    let units; // mỗi đơn vị: {ctx, grp}
    if (aggregated) {
      if (st.group.length) { const m = new Map(); for (const c of rows) { const k = JSON.stringify(st.group.map((g) => this.ev(g, c, par))); if (!m.has(k)) m.set(k, []); m.get(k).push(c); } units = [...m.values()].map((g) => ({ ctx: g[0], grp: g })); }
      else { const ctx = rows[0] || Object.defineProperty({}, '__t', { value: T }); units = [{ ctx, grp: rows }]; }
    } else units = rows.map((c) => ({ ctx: c, grp: null }));
    if (st.order.length) {
      const keyed = units.map((u, i) => ({ u, i, k: st.order.map((o) => this.ev(o.e, u.ctx, par, u.grp)) }));
      keyed.sort((x, y) => { for (let j = 0; j < st.order.length; j++) { const a = x.k[j], b = y.k[j]; let c = a === b ? 0 : a === null ? -1 : b === null ? 1 : cmpv(a, b); if (st.order[j].desc) c = -c; if (c) return c; } return x.i - y.i; });
      units = keyed.map((x) => x.u);
    }
    if (st.limit) { const n = Number(this.ev(st.limit, {}, par)); units = units.slice(0, n); }
    return units.map(({ ctx, grp }) => {
      const o = {};
      for (const it of st.items) {
        if (it.star) { for (const a of it.a ? [it.a] : Object.keys(T)) { const tn = T[a]; for (const c of this.schema[tn].cols) o[c] = ctx[a] ? ctx[a][c] : null; } }
        else { const e = it.e; o[it.alias || (e.k === 'col' ? e.c : e.k === 'fn' ? e.name.toLowerCase() : 'expr')] = this.ev(e, ctx, par, grp); }
      }
      return o;
    });
  }
  blank(table) { const sc = this.schema[table], r = {}; for (const c of sc.cols) r[c] = sc.def && c in sc.def ? sc.def[c] : null; return r; }
  conflict(table, row, ignoreRow) {
    const sc = this.schema[table];
    for (const u of sc.uniq || []) { if (row[u] === null || row[u] === undefined) continue; const f = this.data[table].find((r) => r !== ignoreRow && r[u] === row[u]); if (f) return { f, col: u }; }
    return null;
  }
  exec(sql, par) {
    const st = this.stmt(sql);
    if (st.type === 'select') return this.select(st, par);
    const tb = this.data[st.table]; if (!tb) throw new Error('Không có bảng ' + st.table);
    const T = { [st.table]: st.table };
    if (st.type === 'insert') {
      const row = this.blank(st.table); const ctx = Object.defineProperty({}, '__t', { value: T });
      st.cols.forEach((c, i) => { if (!this.schema[st.table].cols.includes(c)) throw new Error('Không có cột ' + c); row[c] = this.ev(st.vals[i], ctx, par); });
      if (this.schema[st.table].auto && (row.id === null || row.id === undefined)) row.id = tb.reduce((m, r) => Math.max(m, r.id), 0) + 1;
      const cf = this.conflict(st.table, row);
      if (cf) {
        if (st.mode === 'IGNORE') return { lastInsertRowid: 0, changes: 0 };
        if (st.mode === 'REPLACE') tb.splice(tb.indexOf(cf.f), 1);
        else if (st.upsert) { const x = Object.defineProperty({ [st.table]: cf.f, excluded: row }, '__t', { value: { [st.table]: st.table, excluded: st.table } }); const nv = st.upsert.set.map((s) => [s.c, this.ev(s.e, x, par)]); nv.forEach(([c, v]) => { cf.f[c] = v; }); return { lastInsertRowid: cf.f.id || 0, changes: 1 }; }
        else throw new Error(`UNIQUE constraint failed: ${st.table}.${cf.col}`);
      }
      tb.push(row); return { lastInsertRowid: row.id || 0, changes: 1 };
    }
    let n = 0;
    if (st.type === 'update') {
      for (const r of tb) {
        const ctx = Object.defineProperty({ [st.table]: r }, '__t', { value: T });
        if (st.where && !truthy(this.ev(st.where, ctx, par))) continue;
        const nv = st.set.map((s) => [s.c, this.ev(s.e, ctx, par)]); const old = { ...r }; nv.forEach(([c, v]) => { r[c] = v; });
        const cf = this.conflict(st.table, r, r); if (cf) { Object.assign(r, old); throw new Error(`UNIQUE constraint failed: ${st.table}.${cf.col}`); }
        n++;
      }
      return { lastInsertRowid: 0, changes: n };
    }
    const keep = []; for (const r of tb) { const ctx = Object.defineProperty({ [st.table]: r }, '__t', { value: T }); if (!st.where || truthy(this.ev(st.where, ctx, par))) n++; else keep.push(r); }
    this.data[st.table] = keep; return { lastInsertRowid: 0, changes: n };
  }
}
module.exports = { Engine };

};
defs["db.mini"]=function(module,exports,require){
'use strict';
// CSDL chạy thuần JavaScript (không cần SQLite / Node). Dùng cho bản trình duyệt: dữ liệu lưu trong localStorage.
const { Engine } = require('./minisql');
const T = (cols, o = {}) => ({ cols: cols.split(' '), ...o });
const SCHEMA = {
  users: T('id username display_name role code user_type pass_hash salt active created_at', { def: { active: 1 }, uniq: ['username'], auto: true }),
  directory: T('code full_name user_type', { uniq: ['code'] }),
  cards: T('id card_code owner_id plate status passes valid_until zone_pref ticket_pref issued_at replaced_from', { def: { passes: 0, zone_pref: 'G' }, uniq: ['card_code'], auto: true }),
  registrations: T('id full_name user_type code plate email phone username pass_hash salt ticket_pref zone_pref status route decided_by decided_at note created_at', { def: { zone_pref: 'G' }, auto: true }),
  topups: T('id user_id card_id product packs method amount status ref attempts expires_at created_at decided_by decided_at', { def: { packs: 0, amount: 0, attempts: 0 }, uniq: ['ref'], auto: true }),
  parking_sessions: T('id card_id plate entry_at exit_at status zone slot parked_at', { auto: true }),
  gate_events: T('id direction plate card_id confidence attempts status outcome zone session_id created_at updated_at assisted_by manager_by note', { def: { attempts: 0 }, auto: true }),
  lost_reports: T('id card_id user_id note status new_card_id decided_by decided_at created_at', { auto: true }),
  incidents: T('id event_id card_id plate kind status note reported_by closed_by created_at closed_at', { auto: true }),
  audit: T('id ts actor role action detail', { auto: true }),
  gateway_log: T('id ts gw branch ref', { auto: true }),
  sessions: T('token user_id expires_at', { uniq: ['token'] }),
  settings: T('key value', { uniq: ['key'] }),
};
// open(':memory:') -> chỉ trong bộ nhớ. open('browser') -> lưu bằng globalThis.DUE_STORAGE {load(), save(text), stamp()}
function open(file) {
  const e = new Engine(SCHEMA); const store = file !== ':memory:' ? globalThis.DUE_STORAGE : null; let stamp = null;
  const reload = () => { if (!store) return; stamp = store.stamp(); const t = store.load(); try { e.load(t ? JSON.parse(t) : null); } catch { e.load(null); } };
  const flush = () => { if (store && e.dirty) { store.save(JSON.stringify(e.dump())); stamp = store.stamp(); e.dirty = false; } };
  reload();
  const mark = () => { e.dirty = true; };
  return {
    run: (sql, ...p) => { const r = e.exec(sql, p); mark(); return r; },
    get: (sql, ...p) => e.exec(sql, p)[0],
    all: (sql, ...p) => e.exec(sql, p),
    tx(fn) {
      if (e.depth++ > 0) { try { return fn(); } finally { e.depth--; } }
      const snap = JSON.stringify(e.dump());
      try { const r = fn(); return r; } catch (err) { e.load(JSON.parse(snap)); throw err; } finally { e.depth--; }
    },
    // đồng bộ giữa các tab: nếu tab khác đã ghi thì nạp lại trước khi xử lý
    sync() { if (store && store.stamp() !== stamp) reload(); },
    flush, reload,
  };
}
module.exports = { open, SCHEMA };

};
defs["service"]=function(module,exports,require){
'use strict';
const U = require('./util');
const { GATEWAYS, DEFAULT_SETTINGS, PRODUCTS, ZONES } = require('./flows');
const { bad, forbidden, notFound, conflict } = U;

function createService(q, clock) {
  const now = () => (clock ? clock.now() : Date.now());
  const SYS = { id: 0, username: 'HT', role: 'HT' };

  /* ---------- tiện ích ---------- */
  function setting(key) {
    const r = q.get('SELECT value FROM settings WHERE key=?', key);
    return r ? r.value : DEFAULT_SETTINGS[key];
  }
  const nset = (k) => Number(setting(k));
  function allSettings() { const o = { ...DEFAULT_SETTINGS }; for (const r of q.all('SELECT key,value FROM settings')) o[r.key] = r.value; return o; }
  function audit(actor, action, detail) { q.run('INSERT INTO audit(ts,actor,role,action,detail) VALUES(?,?,?,?,?)', now(), actor.username, actor.role, action, detail ? String(detail).slice(0, 500) : null); }
  function gw(id, branch, ref) { q.run('INSERT INTO gateway_log(ts,gw,branch,ref) VALUES(?,?,?,?)', now(), id, branch, ref == null ? null : String(ref)); }
  function newCardCode() { const r = q.get('SELECT COALESCE(MAX(id),0)+1 AS n FROM cards'); return 'DUE-' + String(100000 + r.n); }
  function need(user, ...roles) { if (!user || !roles.includes(user.role)) throw forbidden(); }
  function inLot() { return q.get("SELECT COUNT(*) c FROM parking_sessions WHERE status='in'").c; }
  const inZone = (z) => q.get("SELECT COUNT(*) c FROM parking_sessions WHERE status='in' AND zone=?", z).c;
  const capZone = (z) => nset('cap_' + z);
  const capTotal = () => ZONES.reduce((a, z) => a + capZone(z), 0);
  const monthlyActive = (c) => !!(c.valid_until && c.valid_until > now());
  const price = (p) => nset({ thang: 'price_thang', luot100: 'price_luot100', khach: 'price_khach' }[p]);
  function incident(kind, ev, note, status, by) {
    q.run('INSERT INTO incidents(event_id,card_id,plate,kind,status,note,reported_by,created_at) VALUES(?,?,?,?,?,?,?,?)', ev ? ev.id : null, ev ? ev.card_id : null, ev ? ev.plate : null, kind, status, note || null, by || null, now());
  }

  function createUserAndCard({ username, display_name, role, code, user_type, pass_hash, salt, plate, passes, valid_until, zone_pref, ticket_pref }) {
    const r = q.run('INSERT INTO users(username,display_name,role,code,user_type,pass_hash,salt,created_at) VALUES(?,?,?,?,?,?,?,?)', username, display_name, role, code || null, user_type || null, pass_hash, salt, now());
    const uid = Number(r.lastInsertRowid);
    let cardId = null;
    if (plate) {
      const c = q.run("INSERT INTO cards(card_code,owner_id,plate,status,passes,valid_until,zone_pref,ticket_pref,issued_at) VALUES(?,?,?,'active',?,?,?,?,?)", newCardCode(), uid, plate, passes || 0, valid_until || null, zone_pref || 'G', ticket_pref || null, now());
      cardId = Number(c.lastInsertRowid);
    }
    return { uid, cardId };
  }

  /* ---------- đăng nhập ---------- */
  const fails = new Map();
  function login(username, password, ip) {
    const key = String(username).toLowerCase() + '|' + ip;
    const f = fails.get(key);
    if (f && f.n >= 5 && now() - f.t < 10 * 60 * 1000) throw new U.AppError(429, 'too_many', 'Đăng nhập sai quá nhiều lần, thử lại sau 10 phút');
    const u = q.get('SELECT * FROM users WHERE username=?', String(username).trim());
    const ok = u && u.active && U.verifyPassword(String(password || ''), u.salt, u.pass_hash);
    if (!ok) {
      fails.set(key, { n: (f && now() - f.t < 600000 ? f.n : 0) + 1, t: now() });
      audit({ username: String(username).slice(0, 40), role: '-' }, 'LOGIN_FAIL', ip);
      throw new U.AppError(401, 'bad_login', 'Sai tên đăng nhập hoặc mật khẩu');
    }
    fails.delete(key);
    const tk = U.token();
    q.run('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)', tk, u.id, now() + 8 * 3600 * 1000);
    audit(u, 'LOGIN', null);
    return { token: tk, user: publicUser(u) };
  }
  const publicUser = (u) => ({ id: u.id, username: u.username, display_name: u.display_name, role: u.role, code: u.code, user_type: u.user_type });
  function userByToken(tk) {
    if (!tk) return null;
    const s = q.get('SELECT * FROM sessions WHERE token=?', tk);
    if (!s || s.expires_at < now()) { if (s) q.run('DELETE FROM sessions WHERE token=?', tk); return null; }
    const u = q.get('SELECT * FROM users WHERE id=? AND active=1', s.user_id);
    return u ? publicUser(u) : null;
  }
  function logout(tk, user) { q.run('DELETE FROM sessions WHERE token=?', tk); if (user) audit(user, 'LOGOUT'); }

  /* ---------- 1. Đăng ký (To-Be trang 2): G15, G01, G02 ---------- */
  function register(d) {
    const full_name = U.str(d.full_name, 2, 80, 'Họ tên');
    const user_type = ['sv', 'cb', 'kh'].includes(d.user_type) ? d.user_type : (() => { throw bad('Đối tượng không hợp lệ'); })();
    const username = U.str(d.username, 3, 30, 'Tên đăng nhập'); if (!/^[a-zA-Z0-9._-]+$/.test(username)) throw bad('Tên đăng nhập chỉ gồm chữ, số, . _ -');
    const password = String(d.password || ''); if (password.length < 8) throw bad('Mật khẩu tối thiểu 8 ký tự');
    let code = null;
    if (user_type === 'sv') { code = String(d.code || '').trim(); if (!/^\d{6,12}$/.test(code)) throw bad('Sinh viên cần nhập MSSV (6–12 chữ số)'); }
    else if (user_type === 'cb') { code = String(d.code || '').trim(); if (!/^[A-Za-z0-9]{4,12}$/.test(code)) throw bad('Cán bộ cần nhập mã cán bộ (4–12 chữ và số)'); }
    const email = d.email ? U.str(d.email, 5, 100, 'Email') : null;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Email không hợp lệ');
    const phone = d.phone ? U.str(d.phone, 8, 15, 'Số điện thoại') : null;
    const zone_pref = ZONES.includes(d.zone_pref) ? d.zone_pref : 'G';
    const ticket_pref = user_type === 'kh' ? 'khach' : (['thang', 'luot100'].includes(d.ticket_pref) ? d.ticket_pref : 'thang');
    const plate = U.normPlate(d.plate);
    // G15: định dạng và trùng biển số
    if (!plate) { gw('G15', 'khong_hop_le'); throw bad('Biển số chưa đúng dạng, ví dụ 43A-12345'); }
    if (q.get("SELECT 1 x FROM cards WHERE plate=? AND status='active'", plate) || q.get("SELECT 1 x FROM registrations WHERE plate=? AND status='pending'", plate)) { gw('G15', 'khong_hop_le'); throw conflict('Biển số này đã có thẻ hoặc đang chờ duyệt', 'plate_taken'); }
    if (q.get('SELECT 1 x FROM users WHERE username=?', username) || q.get("SELECT 1 x FROM registrations WHERE username=? AND status='pending'", username)) throw conflict('Tên đăng nhập đã được dùng', 'username_taken');
    gw('G15', 'hop_le');
    const { salt, hash } = U.hashPassword(password);
    return q.tx(() => {
      const dir = code ? q.get('SELECT * FROM directory WHERE code=?', code) : null;
      const inDir = !!(dir && dir.user_type === user_type && U.norm(dir.full_name) === U.norm(full_name));
      const reg = q.run("INSERT INTO registrations(full_name,user_type,code,plate,email,phone,username,pass_hash,salt,ticket_pref,zone_pref,status,route,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'pending',?,?)",
        full_name, user_type, code, plate, email, phone, username, hash, salt, ticket_pref, zone_pref, inDir ? 'auto' : 'manager', now());
      const rid = Number(reg.lastInsertRowid);
      if (inDir) {
        gw('G01', 'trong_csdl', rid);
        const { cardId } = createUserAndCard({ username, display_name: full_name, role: 'NGX', code, user_type, pass_hash: hash, salt, plate, passes: 0, zone_pref, ticket_pref });
        q.run("UPDATE registrations SET status='approved',decided_by='HT',decided_at=? WHERE id=?", now(), rid);
        audit(SYS, 'REGISTER_AUTO', `reg#${rid} ${username}`);
        return { id: rid, status: 'approved', route: 'auto', card: q.get('SELECT card_code FROM cards WHERE id=?', cardId).card_code };
      }
      gw('G01', 'khach_vang_lai', rid);
      audit(SYS, 'REGISTER_PENDING', `reg#${rid} ${username}`);
      return { id: rid, status: 'pending', route: 'manager' };
    });
  }
  function registrationStatus(username) {
    const r = q.get('SELECT id,status,route,note,created_at,decided_at FROM registrations WHERE username=? ORDER BY id DESC', String(username || ''));
    if (!r) throw notFound('Không có hồ sơ đăng ký với tên đăng nhập này');
    return r;
  }
  function decideRegistration(user, id, approve, note) {
    need(user, 'QL', 'ADMIN');
    return q.tx(() => {
      const r = q.get('SELECT * FROM registrations WHERE id=?', id); if (!r) throw notFound();
      if (r.status !== 'pending') throw conflict('Hồ sơ đã được xử lý', 'already_decided');
      if (approve) {
        if (q.get('SELECT 1 x FROM users WHERE username=?', r.username)) throw conflict('Tên đăng nhập đã tồn tại');
        const { cardId } = createUserAndCard({ username: r.username, display_name: r.full_name, role: 'NGX', code: r.code, user_type: r.user_type, pass_hash: r.pass_hash, salt: r.salt, plate: r.plate, passes: 0, zone_pref: r.zone_pref, ticket_pref: r.ticket_pref });
        q.run("UPDATE registrations SET status='approved',decided_by=?,decided_at=?,note=? WHERE id=?", user.username, now(), note || null, id);
        gw('G02', 'duyet', id); audit(user, 'REGISTER_APPROVE', `reg#${id}`);
        return { status: 'approved', card: q.get('SELECT card_code FROM cards WHERE id=?', cardId).card_code };
      }
      q.run("UPDATE registrations SET status='rejected',decided_by=?,decided_at=?,note=? WHERE id=?", user.username, now(), note || null, id);
      gw('G02', 'tu_choi', id); audit(user, 'REGISTER_REJECT', `reg#${id}`);
      return { status: 'rejected' };
    });
  }

  /* ---------- thẻ của tôi ---------- */
  function cardView(c) {
    return { ...c, entitled: entitled(c), monthly_active: monthlyActive(c), days_left: monthlyActive(c) ? Math.ceil((c.valid_until - now()) / 86400000) : 0 };
  }
  function myOverview(user) {
    need(user, 'NGX');
    expireTopups();
    const cards = q.all('SELECT * FROM cards WHERE owner_id=? ORDER BY id DESC', user.id).map(cardView);
    const ids = cards.map(c => c.id);
    const ph = ids.length ? ids.map(() => '?').join(',') : 'NULL';
    const u = q.get('SELECT user_type,code FROM users WHERE id=?', user.id);
    return {
      cards, user_type: u.user_type, code: u.code,
      products: Object.entries(PRODUCTS).filter(([, p]) => p.for.includes(u.user_type)).map(([k, p]) => ({ key: k, label: p.label, desc: p.desc, price: price(k) })),
      sessions: ids.length ? q.all(`SELECT * FROM parking_sessions WHERE card_id IN (${ph}) ORDER BY id DESC LIMIT 20`, ...ids) : [],
      topups: q.all('SELECT * FROM topups WHERE user_id=? ORDER BY id DESC LIMIT 20', user.id),
      lost: q.all('SELECT * FROM lost_reports WHERE user_id=? ORDER BY id DESC LIMIT 10', user.id),
    };
  }

  /* ---------- 6. Mua vé / nạp lượt (trang 6): G10, G11, G12 ---------- */
  function activeCardOf(user) {
    const c = q.get("SELECT * FROM cards WHERE owner_id=? AND status='active' ORDER BY id DESC", user.id);
    if (!c) throw conflict('Bạn chưa có thẻ đang hoạt động. Hãy báo mất thẻ hoặc liên hệ nhà xe.', 'no_active_card');
    return c;
  }
  function applyProduct(cardId, product) {
    const c = q.get('SELECT * FROM cards WHERE id=?', cardId);
    if (product === 'thang') {
      const base = Math.max(now(), c.valid_until || 0);
      q.run('UPDATE cards SET valid_until=? WHERE id=?', base + nset('days_thang') * 86400000, cardId);
    } else q.run('UPDATE cards SET passes=passes+?,valid_until=NULL WHERE id=?', product === 'luot100' ? nset('passes_luot100') : nset('passes_khach'), cardId); // chuyển sang chế độ theo lượt
  }
  function grantedUnits(product) { return product === 'thang' ? nset('days_thang') : product === 'luot100' ? nset('passes_luot100') : nset('passes_khach'); }
  function createTopup(user, product, method) {
    need(user, 'NGX');
    const u = q.get('SELECT user_type FROM users WHERE id=?', user.id);
    if (!PRODUCTS[product] || !PRODUCTS[product].for.includes(u.user_type)) throw bad('Loại vé không áp dụng cho tài khoản này');
    if (!['tien_mat', 'vietqr'].includes(method)) throw bad('Phương thức thanh toán không hợp lệ');
    const card = activeCardOf(user);
    if (product !== 'thang' && monthlyActive(card)) throw conflict('Vé tháng của bạn còn hiệu lực, chưa cần mua lượt', 'monthly_active');
    if (q.get("SELECT 1 x FROM topups WHERE user_id=? AND status IN ('pending_cash','awaiting_payment')", user.id)) throw conflict('Bạn đang có một yêu cầu chưa hoàn tất', 'topup_open');
    const amount = price(product), units = grantedUnits(product);
    gw('G10', method);
    if (method === 'tien_mat') {
      const r = q.run("INSERT INTO topups(user_id,card_id,product,packs,method,amount,status,created_at) VALUES(?,?,?,?,?,?,'pending_cash',?)", user.id, card.id, product, units, method, amount, now());
      audit(user, 'TOPUP_CASH_REQUEST', `topup#${r.lastInsertRowid} ${product}`);
      return q.get('SELECT * FROM topups WHERE id=?', Number(r.lastInsertRowid));
    }
    const r = q.run("INSERT INTO topups(user_id,card_id,product,packs,method,amount,status,ref,attempts,expires_at,created_at) VALUES(?,?,?,?,?,?,'awaiting_payment',?,1,?,?)", user.id, card.id, product, units, method, amount, U.refCode(), now() + nset('qr_ttl_seconds') * 1000, now());
    audit(user, 'TOPUP_QR_CREATED', `topup#${r.lastInsertRowid} ${product}`);
    return topupView(q.get('SELECT * FROM topups WHERE id=?', Number(r.lastInsertRowid)));
  }
  function topupView(t) {
    const out = { ...t, product_label: PRODUCTS[t.product] ? PRODUCTS[t.product].label : t.product };
    if (t.method === 'vietqr' && setting('bank_bin') && setting('bank_account')) {
      const p = new URLSearchParams({ amount: String(t.amount || 0), addInfo: t.ref || '', accountName: setting('bank_holder') });
      out.qr_url = `https://img.vietqr.io/image/${encodeURIComponent(setting('bank_bin'))}-${encodeURIComponent(setting('bank_account'))}-compact2.png?${p}`;
    }
    out.seconds_left = t.status === 'awaiting_payment' ? Math.max(0, Math.ceil((t.expires_at - now()) / 1000)) : 0;
    return out;
  }
  function expireTopups() {
    const rows = q.all("SELECT * FROM topups WHERE status='awaiting_payment' AND expires_at<?", now());
    for (const t of rows) {
      const max = nset('max_retries');
      if (t.attempts >= max) { q.run("UPDATE topups SET status='failed' WHERE id=?", t.id); gw('G12', 'het_han_that_bai', t.id); audit(SYS, 'TOPUP_FAILED', `topup#${t.id}`); }
      else { q.run("UPDATE topups SET status='expired' WHERE id=?", t.id); gw('G12', 'het_han_thu_lai', t.id); audit(SYS, 'TOPUP_EXPIRED', `topup#${t.id}`); }
    }
  }
  function getTopup(user, id) {
    expireTopups();
    const t = q.get('SELECT * FROM topups WHERE id=?', id);
    if (!t || (user.role === 'NGX' && t.user_id !== user.id)) throw notFound();
    return topupView(t);
  }
  function retryTopup(user, id) {
    need(user, 'NGX'); expireTopups();
    const t = q.get('SELECT * FROM topups WHERE id=? AND user_id=?', id, user.id); if (!t) throw notFound();
    if (t.status !== 'expired') throw conflict('Chỉ thử lại được khi mã đã hết hạn và còn lượt thử', 'cannot_retry');
    q.run("UPDATE topups SET status='awaiting_payment',attempts=attempts+1,expires_at=? WHERE id=?", now() + nset('qr_ttl_seconds') * 1000, id);
    audit(user, 'TOPUP_RETRY', `topup#${id} lần ${t.attempts + 1}`);
    return topupView(q.get('SELECT * FROM topups WHERE id=?', id));
  }
  // webhook từ ngân hàng (VietQR) hoặc giả lập
  function bankWebhook(ref, amount, by) {
    expireTopups();
    const t = q.get('SELECT * FROM topups WHERE ref=?', String(ref || ''));
    if (!t) throw notFound('Không tìm thấy giao dịch với mã tham chiếu này');
    if (t.status === 'confirmed') return { status: 'confirmed', duplicate: true };
    if (t.status !== 'awaiting_payment') throw conflict('Giao dịch đã hết hạn hoặc đã đóng', 'topup_closed');
    if (t.amount > 0 && Number(amount) < t.amount) throw bad('Số tiền chuyển thiếu so với yêu cầu', 'amount_short');
    return q.tx(() => {
      q.run("UPDATE topups SET status='confirmed',decided_by=?,decided_at=? WHERE id=?", by || 'bank', now(), t.id);
      applyProduct(t.card_id, t.product); gw('G12', 'xac_nhan', t.id); audit(SYS, 'TOPUP_CONFIRMED_BANK', `topup#${t.id} ${t.product}`);
      return { status: 'confirmed', product: t.product };
    });
  }
  function decideCash(user, id, confirm) {
    need(user, 'NV', 'ADMIN');
    return q.tx(() => {
      const t = q.get('SELECT * FROM topups WHERE id=?', id); if (!t) throw notFound();
      if (t.status !== 'pending_cash') throw conflict('Yêu cầu đã được xử lý', 'already_decided');
      if (confirm) { q.run("UPDATE topups SET status='confirmed',decided_by=?,decided_at=? WHERE id=?", user.username, now(), id); applyProduct(t.card_id, t.product); gw('G11', 'xac_nhan', id); audit(user, 'TOPUP_CASH_CONFIRM', `topup#${id} ${t.product} ${t.amount}`); return { status: 'confirmed' }; }
      q.run("UPDATE topups SET status='rejected',decided_by=?,decided_at=? WHERE id=?", user.username, now(), id);
      gw('G11', 'tu_choi', id); audit(user, 'TOPUP_CASH_REJECT', `topup#${id}`); return { status: 'rejected' };
    });
  }
  // nhân viên bán vé trực tiếp tại quầy (thu tiền mặt rồi xác nhận ngay)
  function staffSell(user, cardCode, product) {
    need(user, 'NV', 'ADMIN');
    const c = q.get('SELECT c.*,u.user_type FROM cards c JOIN users u ON u.id=c.owner_id WHERE c.card_code=?', String(cardCode || '').trim().toUpperCase()); if (!c) throw notFound('Không tìm thấy thẻ');
    if (c.status !== 'active') throw conflict('Thẻ đang bị khóa, cần Quản lý xử lý', 'card_locked');
    if (!PRODUCTS[product] || !PRODUCTS[product].for.includes(c.user_type)) throw bad('Loại vé không áp dụng cho thẻ này');
    return q.tx(() => {
      const r = q.run("INSERT INTO topups(user_id,card_id,product,packs,method,amount,status,created_at,decided_by,decided_at) VALUES(?,?,?,?,'tien_mat',?,'confirmed',?,?,?)", c.owner_id, c.id, product, grantedUnits(product), price(product), now(), user.username, now());
      applyProduct(c.id, product); gw('G11', 'xac_nhan', Number(r.lastInsertRowid)); audit(user, 'COUNTER_SALE', `${c.card_code} ${product} ${price(product)}`);
      return { status: 'confirmed', amount: price(product), card: cardView(q.get('SELECT * FROM cards WHERE id=?', c.id)) };
    });
  }

  /* ---------- 7. Báo mất thẻ (event sub-process): G13 ---------- */
  function reportLost(user, cardId, note) {
    need(user, 'NGX');
    return q.tx(() => {
      const c = q.get('SELECT * FROM cards WHERE id=? AND owner_id=?', cardId, user.id); if (!c) throw notFound('Không tìm thấy thẻ');
      if (c.status === 'locked') throw conflict('Thẻ đã bị khóa', 'already_locked');
      q.run("UPDATE cards SET status='locked' WHERE id=?", c.id);
      const r = q.run("INSERT INTO lost_reports(card_id,user_id,note,status,created_at) VALUES(?,?,?,'pending',?)", c.id, user.id, note ? String(note).slice(0, 300) : null, now());
      audit(user, 'LOST_REPORT_LOCK', `card ${c.card_code}`);
      return { id: Number(r.lastInsertRowid), status: 'pending', card_locked: true };
    });
  }
  function decideLost(user, id, approve) {
    need(user, 'QL', 'ADMIN');
    return q.tx(() => {
      const l = q.get('SELECT * FROM lost_reports WHERE id=?', id); if (!l) throw notFound();
      if (l.status !== 'pending') throw conflict('Yêu cầu đã được xử lý', 'already_decided');
      if (!approve) { q.run("UPDATE lost_reports SET status='rejected',decided_by=?,decided_at=? WHERE id=?", user.username, now(), id); gw('G13', 'tu_choi', id); audit(user, 'LOST_REJECT', `lost#${id}`); return { status: 'rejected' }; }
      const old = q.get('SELECT * FROM cards WHERE id=?', l.card_id);
      const c = q.run("INSERT INTO cards(card_code,owner_id,plate,status,passes,valid_until,zone_pref,ticket_pref,issued_at,replaced_from) VALUES(?,?,?,'active',?,?,?,?,?,?)", newCardCode(), old.owner_id, old.plate, old.passes, old.valid_until, old.zone_pref, old.ticket_pref, now(), old.id);
      q.run('UPDATE cards SET passes=0,valid_until=NULL WHERE id=?', old.id);
      q.run("UPDATE lost_reports SET status='reissued',new_card_id=?,decided_by=?,decided_at=? WHERE id=?", Number(c.lastInsertRowid), user.username, now(), id);
      gw('G13', 'duyet', id); audit(user, 'LOST_REISSUE', `lost#${id}`);
      return { status: 'reissued', card: q.get('SELECT card_code FROM cards WHERE id=?', Number(c.lastInsertRowid)).card_code };
    });
  }

  /* ---------- 3,5. Cổng vào/ra (G03–G09, G14) ---------- */
  function findCard(plate, credential) {
    if (credential) { const c = q.get('SELECT * FROM cards WHERE card_code=?', String(credential).trim().toUpperCase()); if (c) return c; }
    return q.get("SELECT * FROM cards WHERE plate=? ORDER BY (status='active') DESC, id DESC", plate);
  }
  function freeSlot(zone) {
    const used = new Set(q.all("SELECT slot FROM parking_sessions WHERE status='in' AND zone=?", zone).map(r => r.slot));
    for (let i = 1; i <= capZone(zone); i++) if (!used.has(i)) return i;
    return null;
  }
  // chọn khu: ưu tiên khu đã đăng ký, hết chỗ thì sang khu còn lại
  function pickZone(card, forced) {
    const order = forced && ZONES.includes(forced) ? [forced] : [card.zone_pref || 'G', ...ZONES.filter(z => z !== (card.zone_pref || 'G'))];
    for (const z of order) if (freeSlot(z) != null) return z;
    return null;
  }
  // thực hiện mở cổng sau khi đã qua mọi cổng quyết định
  function completeGate(ev, card, actor, forcedZone) {
    if (ev.direction === 'in') {
      const zone = pickZone(card, forcedZone), slot = freeSlot(zone);
      const monthly = monthlyActive(card);
      const s = q.run("INSERT INTO parking_sessions(card_id,plate,entry_at,status,zone,slot) VALUES(?,?,?,'in',?,?)", card.id, ev.plate, now(), zone, slot);
      if (!monthly) q.run('UPDATE cards SET passes=passes-1 WHERE id=?', card.id);
      // cổng AND: ba việc chạy song song
      audit(SYS, 'AND_OPEN_BARRIER', `khu ${zone} chỗ ${slot}`); audit(SYS, 'AND_LED_GUIDE', `khu ${zone} chỗ ${slot}`); audit(SYS, 'AND_CAPTURE_PHOTO', ev.plate);
      q.run("UPDATE gate_events SET status='done',outcome='entered',card_id=?,zone=?,session_id=?,updated_at=? WHERE id=?", card.id, zone, Number(s.lastInsertRowid), now(), ev.id);
      return { result: 'entered', zone, slot, monthly, passes_left: monthly ? null : card.passes - 1, card_code: card.card_code, session_id: Number(s.lastInsertRowid) };
    }
    const s = q.get("SELECT * FROM parking_sessions WHERE card_id=? AND status='in' ORDER BY id DESC", card.id);
    q.run("UPDATE parking_sessions SET status='out',exit_at=? WHERE id=?", now(), s.id);
    // cổng AND: bốn tác vụ sau khi ra chạy song song
    audit(SYS, 'AND_WRITE_LOG', `session#${s.id}`); audit(SYS, 'AND_UPDATE_OCCUPANCY', `còn ${inLot()}`); audit(SYS, 'AND_NOTIFY_OWNER', card.card_code); audit(SYS, 'AND_RELEASE_SLOT', `khu ${s.zone} chỗ ${s.slot}`);
    q.run("UPDATE gate_events SET status='done',outcome='exited',card_id=?,zone=?,session_id=?,updated_at=? WHERE id=?", card.id, s.zone, s.id, now(), ev.id);
    return { result: 'exited', zone: s.zone, minutes: Math.max(1, Math.round((now() - s.entry_at) / 60000)), card_code: card.card_code };
  }
  // vé tháng hết hạn là hết quyền gửi; thẻ theo lượt (không có vé tháng) cần còn lượt
  const entitled = (c) => monthlyActive(c) || (!c.valid_until && c.passes > 0);
  // kiểm tra G03/G04/G05 (hoặc phiên đang gửi khi ra); trả về lỗi nghiệp vụ nếu không qua
  function gateChecks(ev, card, forcedZone) {
    if (!card || card.status !== 'active' || card.plate !== ev.plate) {
      gw('G03', 'khong_hop_le', ev.id);
      q.run("UPDATE gate_events SET status='denied',outcome='invalid_card',updated_at=? WHERE id=?", now(), ev.id);
      return { result: 'invalid_card', message: !card ? 'Không tìm thấy thẻ cho biển số này' : card.status !== 'active' ? 'Thẻ đã bị khóa' : 'Biển số không khớp với thẻ' };
    }
    gw('G03', 'hop_le', ev.id);
    if (ev.direction === 'in') {
      if (q.get("SELECT 1 x FROM parking_sessions WHERE card_id=? AND status='in'", card.id)) { q.run("UPDATE gate_events SET status='denied',outcome='already_in',updated_at=? WHERE id=?", now(), ev.id); return { result: 'already_in', message: 'Xe này đang ở trong bãi' }; }
      if (!entitled(card)) { gw('G04', 'het_luot', ev.id); q.run("UPDATE gate_events SET status='denied',outcome='need_topup',updated_at=? WHERE id=?", now(), ev.id); return { result: 'need_topup', message: card.valid_until ? 'Vé tháng đã hết hạn, hãy gia hạn vé tháng hoặc mua vé 100 lượt' : 'Thẻ đã hết lượt, hãy nạp thêm' }; }
      gw('G04', 'con_luot', ev.id);
      if (pickZone(card, forcedZone) == null) { gw('G05', 'het_cho', ev.id); q.run("UPDATE gate_events SET status='denied',outcome='full',updated_at=? WHERE id=?", now(), ev.id); return { result: 'full', message: 'Cả Khu G và Khu D đã hết chỗ, đèn LED đỏ, vui lòng chờ' }; }
      gw('G05', 'con_cho', ev.id);
    } else if (!q.get("SELECT 1 x FROM parking_sessions WHERE card_id=? AND status='in'", card.id)) {
      q.run("UPDATE gate_events SET status='denied',outcome='no_session',updated_at=? WHERE id=?", now(), ev.id);
      return { result: 'no_session', message: 'Không có phiên gửi xe đang mở cho thẻ này' };
    }
    return null;
  }
  function gate(user, direction, d) {
    need(user, 'NV', 'ADMIN');
    if (!['in', 'out'].includes(direction)) throw bad('Hướng cổng không hợp lệ');
    const plate = U.normPlate(d.plate); if (!plate) throw bad('Biển số chưa đúng dạng');
    const conf = Number(d.confidence); if (!(conf >= 0 && conf <= 1)) throw bad('Độ tin cậy phải trong khoảng 0–1');
    const zone = d.zone && ZONES.includes(d.zone) ? d.zone : undefined;
    return q.tx(() => {
      let ev = q.get("SELECT * FROM gate_events WHERE plate=? AND direction=? AND status='retry' ORDER BY id DESC", plate, direction);
      if (!ev) { const r = q.run("INSERT INTO gate_events(direction,plate,confidence,attempts,status,created_at,updated_at) VALUES(?,?,?,0,'retry',?,?)", direction, plate, conf, now(), now()); ev = q.get('SELECT * FROM gate_events WHERE id=?', Number(r.lastInsertRowid)); }
      const card = findCard(plate, d.credential);
      q.run('UPDATE gate_events SET confidence=?,card_id=?,updated_at=? WHERE id=?', conf, card ? card.id : null, now(), ev.id);
      if (conf < nset('ai_threshold')) {
        gw('G06', 'duoi_nguong', ev.id);
        const attempts = ev.attempts + 1;
        if (attempts >= nset('max_retries')) { gw('G07', 'du_lan', ev.id); q.run("UPDATE gate_events SET attempts=?,status='assist',outcome='assist_required',updated_at=? WHERE id=?", attempts, now(), ev.id); audit(SYS, 'GATE_ASSIST_REQUIRED', `${direction} ${plate}`); return { result: 'assist_required', event_id: ev.id, attempts, message: 'Thất bại đủ số lần, cần nhân viên hỗ trợ tại chỗ' }; }
        gw('G07', 'chua_du', ev.id); q.run('UPDATE gate_events SET attempts=? WHERE id=?', attempts, ev.id);
        return { result: 'retry', event_id: ev.id, attempts, max: nset('max_retries'), message: `Độ tin cậy dưới ngưỡng, thử lại (${attempts}/${nset('max_retries')})` };
      }
      gw('G06', 'dat_nguong', ev.id);
      const bl = gateChecks(ev, card, zone); if (bl) return { event_id: ev.id, ...bl };
      return { event_id: ev.id, ...completeGate(ev, card, user, zone) };
    });
  }
  const assistQueue = () => q.all("SELECT g.*,c.card_code FROM gate_events g LEFT JOIN cards c ON c.id=g.card_id WHERE g.status='assist' ORDER BY g.id");
  // Xác minh thủ công ở cổng (trang 4)
  function staffAssist(user, id, verified, note) {
    need(user, 'NV', 'ADMIN');
    return q.tx(() => {
      const ev = q.get('SELECT * FROM gate_events WHERE id=?', id); if (!ev) throw notFound();
      if (ev.status !== 'assist') throw conflict('Trường hợp này không ở trạng thái chờ nhân viên', 'not_assist');
      const n = note ? String(note).slice(0, 300) : null;
      if (!verified) {
        gw('G08', 'khong_xac_minh_duoc', id);
        q.run("UPDATE gate_events SET status='escalated',assisted_by=?,note=?,updated_at=? WHERE id=?", user.username, n, now(), id);
        incident('bien_ban_xac_minh', ev, n || 'Không xác minh được danh tính', 'reported', user.username);
        audit(user, 'INCIDENT_REPORT', `event#${id} ${ev.plate}`); return { status: 'escalated' };
      }
      gw('G08', 'xac_minh_duoc', id);
      q.run('UPDATE gate_events SET assisted_by=?,note=? WHERE id=?', user.username, n, id);
      audit(user, 'VERIFY_LOG', `event#${id} đối chiếu ảnh/CCCD/thẻ SV${n ? ': ' + n : ''}`);
      const card = ev.card_id ? q.get('SELECT * FROM cards WHERE id=?', ev.card_id) : null;
      const fresh = q.get('SELECT * FROM gate_events WHERE id=?', id);
      const bl = gateChecks(fresh, card); if (bl) return bl;
      return completeGate(fresh, card, user);
    });
  }
  const escalationQueue = () => q.all("SELECT g.*,c.card_code,i.note AS incident_note FROM gate_events g LEFT JOIN cards c ON c.id=g.card_id LEFT JOIN incidents i ON i.event_id=g.id WHERE g.status='escalated' ORDER BY g.id");
  function decideEscalation(user, id, allow, note) {
    need(user, 'QL', 'ADMIN');
    return q.tx(() => {
      const ev = q.get('SELECT * FROM gate_events WHERE id=?', id); if (!ev) throw notFound();
      if (ev.status !== 'escalated') throw conflict('Trường hợp đã được xử lý', 'already_decided');
      q.run('UPDATE gate_events SET manager_by=?,note=COALESCE(?,note) WHERE id=?', user.username, note || null, id);
      const card = ev.card_id ? q.get('SELECT * FROM cards WHERE id=?', ev.card_id) : null;
      if (allow && card) {
        gw('G09', 'cho_phep', id);
        const fresh = q.get('SELECT * FROM gate_events WHERE id=?', id);
        const bl = gateChecks(fresh, card); if (bl) return bl;
        q.run("UPDATE incidents SET status='closed',closed_by=?,closed_at=? WHERE event_id=?", user.username, now(), id);
        audit(user, 'EXCEPTION_APPROVED', `event#${id} ghi ngoại lệ có phê duyệt`); return completeGate(fresh, card, user);
      }
      gw('G09', 'khoa_phien', id);
      q.run("UPDATE gate_events SET status='denied',outcome='session_locked',updated_at=? WHERE id=?", now(), id);
      if (ev.direction === 'out' && ev.card_id) q.run("UPDATE parking_sessions SET status='blocked' WHERE card_id=? AND status='in'", ev.card_id);
      q.run("UPDATE incidents SET status='held',note=COALESCE(note,'')||' | QL: '||?  WHERE event_id=?", note || 'khóa phiên', id);
      audit(user, 'SECURITY_ALERT', `event#${id} ${ev.plate} bị khóa phiên, chuyển bảo vệ xử lý`);
      return { status: 'denied', result: 'session_locked' };
    });
  }

  /* ---------- Nhân viên: hỗ trợ cổng vào (GĐ2b), bãi, sự cố, ca trực ---------- */
  // Xe bị từ chối ở cổng vào (hết lượt/thẻ lỗi) và chưa được nhân viên xử lý
  const entryRefusals = () => q.all("SELECT g.*,c.card_code,c.status AS card_status,c.valid_until,c.passes FROM gate_events g LEFT JOIN cards c ON c.id=g.card_id WHERE g.direction='in' AND g.status='denied' AND g.outcome IN ('need_topup','invalid_card') AND g.assisted_by IS NULL AND g.updated_at>? ORDER BY g.id DESC LIMIT 20", now() - 3600000);
  function staffSupport(user, id, action, d) {
    need(user, 'NV', 'ADMIN'); d = d || {};
    return q.tx(() => {
      const ev = q.get('SELECT * FROM gate_events WHERE id=?', id); if (!ev) throw notFound();
      if (ev.direction !== 'in' || ev.status !== 'denied' || ev.assisted_by || !['need_topup', 'invalid_card'].includes(ev.outcome)) throw conflict('Trường hợp này không cần hỗ trợ tại cổng vào', 'not_support');
      const note = d.note ? String(d.note).slice(0, 300) : null;
      if (action === 'refuse') {
        gw('G14', 'tu_choi_vao_bai', id); q.run("UPDATE gate_events SET assisted_by=?,outcome='refused',note=?,updated_at=? WHERE id=?", user.username, note, now(), id);
        audit(user, 'ENTRY_REFUSED', `event#${id} ${ev.plate}`); return { result: 'refused' };
      }
      const card = ev.card_id ? q.get('SELECT * FROM cards WHERE id=?', ev.card_id) : null;
      if (!card || card.plate !== ev.plate) throw conflict('Không xác định được thẻ khớp biển số, chỉ có thể từ chối vào bãi', 'no_card');
      if (card.status !== 'active') throw conflict('Thẻ đang bị khóa do báo mất, cần Quản lý xử lý', 'card_locked');
      if (action === 'sell_cash') {
        const owner = q.get('SELECT user_type FROM users WHERE id=?', card.owner_id);
        const product = d.product; if (!PRODUCTS[product] || !PRODUCTS[product].for.includes(owner.user_type)) throw bad('Loại vé không áp dụng cho thẻ này');
        const r = q.run("INSERT INTO topups(user_id,card_id,product,packs,method,amount,status,created_at,decided_by,decided_at) VALUES(?,?,?,?,'tien_mat',?,'confirmed',?,?,?)", card.owner_id, card.id, product, grantedUnits(product), price(product), now(), user.username, now());
        applyProduct(card.id, product); gw('G11', 'xac_nhan', Number(r.lastInsertRowid)); audit(user, 'COUNTER_SALE', `${card.card_code} ${product} (hỗ trợ cổng vào)`);
      } else if (action === 'temp_pass') {
        if (!note || note.length < 3) throw bad('Cấp lượt tạm phải ghi lý do');
        q.run('UPDATE cards SET passes=passes+1 WHERE id=?', card.id); audit(user, 'TEMP_PASS', `${card.card_code}: ${note}`);
      } else throw bad('Thao tác hỗ trợ không hợp lệ');
      gw('G14', 'giai_quyet_duoc', id); q.run('UPDATE gate_events SET assisted_by=?,note=? WHERE id=?', user.username, note, id);
      const fresh = q.get('SELECT * FROM gate_events WHERE id=?', id);
      const bl = gateChecks(fresh, q.get('SELECT * FROM cards WHERE id=?', card.id)); if (bl) return bl;
      return completeGate(fresh, q.get('SELECT * FROM cards WHERE id=?', card.id), user);
    });
  }
  // Xe đã vào nhưng chưa xác nhận đỗ (cảm biến) -> sau 3 phút nhắc nhân viên ra chỉ dẫn (timer không ngắt)
  function confirmParked(user, sessionId) {
    need(user, 'NV', 'ADMIN');
    const s = q.get("SELECT * FROM parking_sessions WHERE id=? AND status='in'", sessionId); if (!s) throw notFound('Không có phiên đang gửi');
    if (s.parked_at) throw conflict('Xe đã được xác nhận đỗ', 'already_parked');
    q.run('UPDATE parking_sessions SET parked_at=? WHERE id=?', now(), sessionId);
    audit(user, 'PARKED_CONFIRMED', `session#${sessionId} khu ${s.zone} chỗ ${s.slot}`); return { ok: true };
  }
  function closeIncident(user, id, note) {
    need(user, 'NV', 'ADMIN');
    const i = q.get('SELECT * FROM incidents WHERE id=?', id); if (!i) throw notFound();
    if (i.status !== 'held') throw conflict('Chỉ đóng được sự cố đang được giữ xe, bảo vệ xử lý', 'not_held');
    if (!note || String(note).trim().length < 3) throw bad('Cần ghi kết quả xử lý');
    q.run("UPDATE incidents SET status='closed',closed_by=?,closed_at=?,note=COALESCE(note,'')||' | Kết quả: '||? WHERE id=?", user.username, now(), String(note).slice(0, 200), id);
    audit(user, 'INCIDENT_CLOSED', `incident#${id}`); return { status: 'closed' };
  }
  function staffLookup(user, text) {
    need(user, 'NV', 'ADMIN');
    const s = String(text || '').trim(); if (s.length < 3) throw bad('Nhập ít nhất 3 ký tự: biển số, mã thẻ, MSSV hoặc tên đăng nhập');
    const plate = U.normPlate(s);
    const rows = q.all("SELECT c.*,u.display_name,u.username,u.code,u.user_type FROM cards c JOIN users u ON u.id=c.owner_id WHERE c.card_code=? OR c.plate=? OR u.username=? OR u.code=? ORDER BY c.id DESC LIMIT 5", s.toUpperCase(), plate || s.toUpperCase(), s, s);
    return rows.map(c => ({ ...cardView(c), session: q.get("SELECT * FROM parking_sessions WHERE card_id=? AND status IN ('in','blocked') ORDER BY id DESC", c.id) || null,
      lost: q.get('SELECT status FROM lost_reports WHERE card_id=? ORDER BY id DESC', c.id) || null,
      events: q.all('SELECT id,direction,status,outcome,confidence,created_at FROM gate_events WHERE card_id=? ORDER BY id DESC LIMIT 5', c.id) }));
  }
  function shiftReport(user) {
    need(user, 'NV', 'ADMIN');
    const d = new Date(now()); d.setHours(0, 0, 0, 0); const t0 = d.getTime();
    const cnt = (sql, ...p) => q.get(sql, ...p).c;
    const cash = q.get("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM topups WHERE method='tien_mat' AND status='confirmed' AND decided_by=? AND decided_at>=?", user.username, t0);
    return { since: t0, entered: cnt("SELECT COUNT(*) c FROM gate_events WHERE outcome='entered' AND updated_at>=?", t0), exited: cnt("SELECT COUNT(*) c FROM gate_events WHERE outcome='exited' AND updated_at>=?", t0),
      assisted: cnt('SELECT COUNT(*) c FROM gate_events WHERE assisted_by=? AND updated_at>=?', user.username, t0), refused: cnt("SELECT COUNT(*) c FROM gate_events WHERE outcome='refused' AND assisted_by=? AND updated_at>=?", user.username, t0),
      cash_count: cash.n, cash_total: cash.s, open_incidents: cnt("SELECT COUNT(*) c FROM incidents WHERE status IN ('reported','held')") };
  }
  function zoneStats() { return ZONES.map(z => ({ zone: z, used: inZone(z), capacity: capZone(z) })); }

  /* ---------- hàng đợi & thống kê ---------- */
  function staffQueue(user) {
    need(user, 'NV', 'ADMIN'); expireTopups();
    const limit = now() - nset('guide_timeout_min') * 60000;
    return {
      cash: q.all("SELECT t.*,u.display_name,u.username FROM topups t JOIN users u ON u.id=t.user_id WHERE t.status='pending_cash' ORDER BY t.id").map(topupView),
      assist: assistQueue(), refusals: entryRefusals(),
      unparked: q.all("SELECT s.id,s.plate,s.entry_at,s.zone,s.slot,c.card_code FROM parking_sessions s JOIN cards c ON c.id=s.card_id WHERE s.status='in' AND s.parked_at IS NULL ORDER BY s.id").map(s => ({ ...s, overdue: s.entry_at < limit })),
      held: q.all("SELECT * FROM incidents WHERE status='held' ORDER BY id"), reported: q.all("SELECT * FROM incidents WHERE status='reported' ORDER BY id"),
      zones: zoneStats(), occupancy: { used: inLot(), capacity: capTotal() },
      inside: q.all("SELECT s.id,s.plate,s.entry_at,s.zone,s.slot,s.parked_at,c.card_code FROM parking_sessions s JOIN cards c ON c.id=s.card_id WHERE s.status='in' ORDER BY s.id DESC LIMIT 60"),
    };
  }
  function managerQueue(user) {
    need(user, 'QL', 'ADMIN');
    return {
      registrations: q.all("SELECT id,full_name,user_type,code,plate,email,phone,username,ticket_pref,zone_pref,created_at FROM registrations WHERE status='pending' ORDER BY id"),
      lost: q.all("SELECT l.*,c.card_code,c.plate,u.display_name FROM lost_reports l JOIN cards c ON c.id=l.card_id JOIN users u ON u.id=l.user_id WHERE l.status='pending' ORDER BY l.id"),
      escalations: escalationQueue(), zones: zoneStats(),
      incidents: q.all("SELECT * FROM incidents ORDER BY id DESC LIMIT 15"),
    };
  }
  function stats(user) {
    need(user, 'ADMIN');
    const c = (sql) => q.get(sql).c;
    return {
      users: c('SELECT COUNT(*) c FROM users'), cards: c("SELECT COUNT(*) c FROM cards WHERE status='active'"),
      in_lot: inLot(), capacity: capTotal(), zones: zoneStats(),
      sessions_done: c("SELECT COUNT(*) c FROM parking_sessions WHERE status='out'"),
      registrations_pending: c("SELECT COUNT(*) c FROM registrations WHERE status='pending'"),
      topups_confirmed: c("SELECT COUNT(*) c FROM topups WHERE status='confirmed'"),
      revenue: q.get("SELECT COALESCE(SUM(amount),0) s FROM topups WHERE status='confirmed'").s,
      gate_assist: c("SELECT COUNT(*) c FROM gate_events WHERE outcome IN ('assist_required') OR assisted_by IS NOT NULL"),
      gate_total: c('SELECT COUNT(*) c FROM gate_events'), incidents_open: c("SELECT COUNT(*) c FROM incidents WHERE status!='closed'"),
      gateway_hits: c('SELECT COUNT(*) c FROM gateway_log'),
    };
  }
  function flows(user) {
    need(user, 'ADMIN');
    const counts = {}; for (const r of q.all('SELECT gw,branch,COUNT(*) n FROM gateway_log GROUP BY gw,branch')) counts[r.gw + '/' + r.branch] = r.n;
    return GATEWAYS.map(g => ({ ...g, branches: Object.entries(g.branches).map(([k, label]) => ({ key: k, label, count: counts[g.id + '/' + k] || 0 })) }));
  }
  function auditList(user, limit) { need(user, 'ADMIN'); return q.all('SELECT * FROM audit ORDER BY id DESC LIMIT ?', Math.min(Number(limit) || 100, 500)); }

  /* ---------- quản trị ---------- */
  function listUsers(user) { need(user, 'ADMIN'); return q.all('SELECT id,username,display_name,role,code,user_type,active,created_at FROM users ORDER BY id'); }
  function adminCreateUser(user, d) {
    need(user, 'ADMIN');
    const role = ['NGX', 'NV', 'QL', 'ADMIN'].includes(d.role) ? d.role : (() => { throw bad('Vai trò không hợp lệ'); })();
    const username = U.str(d.username, 3, 30, 'Tên đăng nhập'); if (!/^[a-zA-Z0-9._-]+$/.test(username)) throw bad('Tên đăng nhập chỉ gồm chữ, số, . _ -');
    const password = String(d.password || ''); if (password.length < 8) throw bad('Mật khẩu tối thiểu 8 ký tự');
    if (q.get('SELECT 1 x FROM users WHERE username=?', username)) throw conflict('Tên đăng nhập đã tồn tại');
    const plate = role === 'NGX' ? (U.normPlate(d.plate) || (() => { throw bad('Người gửi xe cần biển số hợp lệ'); })()) : null;
    const { salt, hash } = U.hashPassword(password);
    const days = Number(d.monthly_days) || 0;
    const r = createUserAndCard({ username, display_name: U.str(d.display_name, 2, 80, 'Họ tên'), role, code: d.code || null, user_type: role === 'NGX' ? (['sv', 'cb', 'kh'].includes(d.user_type) ? d.user_type : 'sv') : null, pass_hash: hash, salt, plate, passes: Number(d.passes) || 0, valid_until: days > 0 ? now() + days * 86400000 : null, zone_pref: ZONES.includes(d.zone_pref) ? d.zone_pref : 'G' });
    audit(user, 'USER_CREATE', `${username} (${role})`); return { id: r.uid };
  }
  function setUserActive(user, id, active) {
    need(user, 'ADMIN'); if (id === user.id) throw bad('Không thể tự khóa tài khoản của chính mình');
    const r = q.run('UPDATE users SET active=? WHERE id=?', active ? 1 : 0, id); if (!r.changes) throw notFound();
    if (!active) q.run('DELETE FROM sessions WHERE user_id=?', id);
    audit(user, active ? 'USER_ENABLE' : 'USER_DISABLE', `user#${id}`); return { ok: true };
  }
  function saveSettings(user, d) {
    need(user, 'ADMIN');
    const num = (k, min, max) => { if (d[k] !== undefined) { const v = Number(d[k]); if (!(v >= min && v <= max)) throw bad(`${k} phải trong khoảng ${min}–${max}`); } };
    ['price_thang', 'price_luot100', 'price_khach'].forEach(k => num(k, 0, 10000000)); ['cap_G', 'cap_D'].forEach(k => num(k, 0, 100000));
    num('days_thang', 1, 366); num('passes_luot100', 1, 10000); num('passes_khach', 1, 100); num('guide_timeout_min', 1, 120);
    num('ai_threshold', 0.5, 1); num('max_retries', 1, 10); num('qr_ttl_seconds', 10, 3600);
    for (const k of Object.keys(DEFAULT_SETTINGS)) if (d[k] !== undefined) q.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, String(d[k]).slice(0, 200));
    audit(user, 'SETTINGS_SAVE', Object.keys(d).join(',')); return allSettings();
  }
  function publicConfig() {
    const s = allSettings();
    return { site_name: s.site_name, address: s.address, phone: s.phone, email: s.email, open_hours: s.open_hours,
      products: Object.entries(PRODUCTS).map(([k, p]) => ({ key: k, label: p.label, desc: p.desc, price: price(k), for: p.for, units: grantedUnits(k) })),
      zones: zoneStats(), capacity: capTotal(), in_lot: inLot(), qr_ttl_seconds: Number(s.qr_ttl_seconds), ai_threshold: Number(s.ai_threshold), max_retries: Number(s.max_retries),
      guide_timeout_min: Number(s.guide_timeout_min), show_demo_accounts: s.show_demo_accounts === '1', retention_days: Number(s.retention_days) };
  }
  // nhập dữ liệu test của giảng viên
  function importData(user, d) {
    need(user, 'ADMIN');
    if (!d || typeof d !== 'object') throw bad('Dữ liệu nhập phải là JSON');
    return q.tx(() => {
      let nd = 0, nu = 0;
      for (const r of d.directory || []) { q.run('INSERT INTO directory(code,full_name,user_type) VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET full_name=excluded.full_name,user_type=excluded.user_type', U.str(r.code, 4, 12, 'code'), U.str(r.full_name, 2, 80, 'full_name'), ['sv', 'cb'].includes(r.user_type) ? r.user_type : (() => { throw bad('user_type trong directory phải là sv hoặc cb'); })()); nd++; }
      for (const u of d.users || []) {
        if (q.get('SELECT 1 x FROM users WHERE username=?', u.username)) continue;
        adminCreateUser(user, { password: 'Due@2026', ...u }); nu++;
      }
      if (d.settings) saveSettings(user, d.settings);
      audit(user, 'DATA_IMPORT', `directory ${nd}, users ${nu}`);
      return { directory: nd, users: nu };
    });
  }
  function exportData(user) {
    need(user, 'ADMIN');
    return {
      exported_at: now(), settings: allSettings(), users: listUsers(user), cards: q.all('SELECT * FROM cards'),
      registrations: q.all('SELECT id,full_name,user_type,code,plate,username,ticket_pref,zone_pref,status,route,decided_by,created_at FROM registrations'),
      topups: q.all('SELECT * FROM topups'), sessions: q.all('SELECT * FROM parking_sessions'), gate_events: q.all('SELECT * FROM gate_events'), incidents: q.all('SELECT * FROM incidents'),
      lost_reports: q.all('SELECT * FROM lost_reports'), gateway_log: q.all('SELECT * FROM gateway_log'), audit: q.all('SELECT * FROM audit ORDER BY id DESC LIMIT 1000'),
    };
  }
  function purgeOld(days) {
    const cutoff = now() - days * 86400000;
    const r = q.run("DELETE FROM gate_events WHERE updated_at<? AND status IN ('done','denied')", cutoff);
    return r.changes;
  }

  function webhookSecret() {
    const r = q.get("SELECT value FROM settings WHERE key='webhook_secret'"); if (r) return r.value;
    const v = U.token(16); q.run("INSERT INTO settings(key,value) VALUES('webhook_secret',?)", v); return v;
  }
  function checkSecret(given) { return U.safeEqual(given || '', webhookSecret()); }
  function openTopups(user) { need(user, 'ADMIN'); expireTopups(); return q.all("SELECT id,ref,product,packs,amount,attempts,expires_at,status FROM topups WHERE status='awaiting_payment'"); }
  function simulateBank(user, topupId) {
    need(user, 'ADMIN'); const t = q.get('SELECT * FROM topups WHERE id=?', topupId); if (!t) throw notFound('Không có giao dịch');
    audit(user, 'SIMULATE_BANK', `topup#${t.id}`); return bankWebhook(t.ref, t.amount, 'bank-sim');
  }
  function resetAll(user, confirmText) {
    need(user, 'ADMIN'); if (confirmText !== 'RESET') throw bad('Cần gửi confirm = "RESET"');
    const keep = webhookSecret();
    for (const t of ['sessions', 'audit', 'gateway_log', 'incidents', 'lost_reports', 'gate_events', 'parking_sessions', 'topups', 'registrations', 'cards', 'users', 'directory', 'settings']) q.run(`DELETE FROM ${t}`);
    require('./seed').seed(q, api); q.run("INSERT INTO settings(key,value) VALUES('webhook_secret',?)", keep);
    return { ok: true, note: 'Đã khôi phục dữ liệu mẫu. Hãy đăng nhập lại (mật khẩu mẫu Due@2026).' };
  }

  const api = { SYS, now, webhookSecret, checkSecret, openTopups, simulateBank, resetAll, setting, allSettings, audit, gw, login, logout, userByToken, publicUser, register, registrationStatus, decideRegistration, myOverview, createTopup, getTopup, retryTopup, bankWebhook, decideCash, staffSell, reportLost, decideLost, gate, staffAssist, staffSupport, confirmParked, closeIncident, staffLookup, shiftReport, decideEscalation, staffQueue, managerQueue, stats, flows, auditList, listUsers, adminCreateUser, setUserActive, saveSettings, publicConfig, importData, exportData, expireTopups, purgeOld, inLot, createUserAndCard };
  return api;
}
module.exports = { createService };

};
defs["seed"]=function(module,exports,require){
'use strict';
const U = require('./util');
const { DEFAULT_SETTINGS } = require('./flows');
const DEMO_PASSWORD = 'Due@2026';

const DIRECTORY = [
  ['2021001', 'Nguyễn Văn An', 'sv'], ['2021002', 'Trần Thị Bình', 'sv'], ['2021003', 'Lê Minh Châu', 'sv'],
  ['2022001', 'Phạm Quốc Dũng', 'sv'], ['2022002', 'Hoàng Thị Em', 'sv'],
  ['CB001', 'Võ Thanh Giang', 'cb'], ['CB002', 'Đặng Hữu Hải', 'cb'],
];
// Tài khoản mẫu (dùng chung cho bản máy chủ và bản trình duyệt)
const DEMO_USERS = [
  { username: 'admin', display_name: 'Giảng viên chấm / Quản trị', role: 'ADMIN' },
  { username: 'quanly', display_name: 'Quản lý nhà xe (mẫu)', role: 'QL' },
  { username: 'nhanvien', display_name: 'Nhân viên nhà xe (mẫu)', role: 'NV' },
  { username: 'sv2021001', display_name: 'Nguyễn Văn An', role: 'NGX', code: '2021001', user_type: 'sv', plate: '43A-12345', passes: 12, zone_pref: 'G', ticket_pref: 'luot100' },
  { username: 'cb001', display_name: 'Võ Thanh Giang', role: 'NGX', code: 'CB001', user_type: 'cb', plate: '43B1-123.45', passes: 0, monthly_days: 20, zone_pref: 'D', ticket_pref: 'thang' },
  { username: 'khach01', display_name: 'Khách mẫu', role: 'NGX', user_type: 'kh', plate: '43K-11111', passes: 1, zone_pref: 'G', ticket_pref: 'khach' },
];
function seed(q, svc) {
  q.tx(() => {
    for (const [code, name, t] of DIRECTORY) q.run('INSERT OR REPLACE INTO directory(code,full_name,user_type) VALUES(?,?,?)', code, name, t);
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) q.run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', k, v);
    const { salt, hash } = U.hashPassword(DEMO_PASSWORD);
    for (const u of DEMO_USERS) { const { monthly_days, ...rest } = u; svc.createUserAndCard({ pass_hash: hash, salt, ...rest, valid_until: monthly_days ? svc.now() + monthly_days * 86400000 : null }); }
    q.run('INSERT INTO audit(ts,actor,role,action,detail) VALUES(?,?,?,?,?)', svc.now(), 'HT', 'HT', 'SEED', 'Khởi tạo dữ liệu mẫu');
  });
}
module.exports = { seed, DEMO_PASSWORD, DIRECTORY, DEMO_USERS };

};
defs["context"]=function(module,exports,require){
'use strict';
const { open } = require('./db');
const { createService } = require('./service');
const { seed } = require('./seed');
// Tạo một ngữ cảnh ứng dụng (CSDL + dịch vụ + đồng hồ có thể chỉnh để kiểm thử)
function createContext(file, { withSeed = true, open: openFn } = {}) {
  const q = (openFn || open)(file);
  const clock = { offset: 0, now() { return Date.now() + this.offset; }, advance(ms) { this.offset += ms; } };
  const svc = createService(q, clock);
  if (withSeed && q.get('SELECT COUNT(*) c FROM users').c === 0) seed(q, svc);
  // tiện ích cho kiểm thử, tránh phụ thuộc SQL thô trong kịch bản
  const h = {
    card: (plate) => q.get('SELECT * FROM cards WHERE plate=? ORDER BY id DESC', plate),
    setCard: (plate, patch) => { for (const [k, v] of Object.entries(patch)) q.run(`UPDATE cards SET ${k}=? WHERE plate=?`, v, plate); },
    auditCount: (action, prefix) => q.get(prefix ? 'SELECT COUNT(*) c FROM audit WHERE action LIKE ?' : 'SELECT COUNT(*) c FROM audit WHERE action=?', prefix ? action + '%' : action).c,
    lastSession: () => q.get('SELECT * FROM parking_sessions ORDER BY id DESC'),
    incident: () => q.get('SELECT * FROM incidents ORDER BY id DESC'),
  };
  return { q, svc, clock, h };
}
module.exports = { createContext };

};
defs["scenarios"]=function(module,exports,require){
'use strict';
// Kịch bản kiểm thử bám mô hình To-Be. Dùng chung cho `npm test` và nút "Chạy kiểm thử" trong trang quản trị.
const assert = require('assert');

const U = (svc, name) => svc.userByToken(svc.login(name, 'Due@2026', 't').token);
const reg = (o) => ({ full_name: 'Khách Một', user_type: 'kh', plate: '43C-11111', username: 'khach1', password: 'matkhau123', ...o });
const G = (svc, dir, plate, conf = 0.99, extra = {}) => svc.gate(U(svc, 'nhanvien'), dir, { plate, confidence: conf, ...extra });
const fail3 = (svc, dir, plate) => { let r; for (let i = 0; i < 3; i++) r = G(svc, dir, plate, 0.5); return r; };

const SCENARIOS = [
  ['S01', 'Đăng ký: sinh viên nhập MSSV có trong CSDL được duyệt tự động (G15, G01)', 'Trang 2', ({ svc, h }) => {
    const r = svc.register(reg({ full_name: 'Trần Thị Bình', user_type: 'sv', code: '2021002', username: 'sv2021002', plate: '43A-22222', ticket_pref: 'thang', zone_pref: 'D' }));
    assert.equal(r.status, 'approved'); assert.equal(r.route, 'auto'); assert.match(r.card, /^DUE-/);
    const c = h.card('43A-22222'); assert.equal(c.zone_pref, 'D'); assert.equal(c.ticket_pref, 'thang');
  }],
  ['S02', 'Đăng ký: sinh viên bắt buộc có MSSV', 'Trang 2', ({ svc }) => {
    assert.throws(() => svc.register(reg({ user_type: 'sv', code: '', username: 'xyz1' })), /MSSV/);
  }],
  ['S03', 'Đăng ký: khách vãng lai chờ Quản lý duyệt rồi được cấp thẻ (G01→G02)', 'Trang 2', ({ svc }) => {
    const r = svc.register(reg({})); assert.equal(r.status, 'pending');
    const d = svc.decideRegistration(U(svc, 'quanly'), r.id, true, 'ok'); assert.equal(d.status, 'approved'); assert.ok(svc.login('khach1', 'matkhau123', 't').token);
  }],
  ['S04', 'Đăng ký: Quản lý từ chối hồ sơ (G02)', 'Trang 2', ({ svc }) => {
    const r = svc.register(reg({ username: 'khach2' }));
    assert.equal(svc.decideRegistration(U(svc, 'quanly'), r.id, false, 'thiếu giấy tờ').status, 'rejected'); assert.throws(() => svc.login('khach2', 'matkhau123', 't'));
  }],
  ['S05', 'Đăng ký: MSSV không khớp tên bị chuyển Quản lý (G01)', 'Trang 2', ({ svc }) => {
    assert.equal(svc.register(reg({ user_type: 'sv', code: '2021003', full_name: 'Người Khác', username: 'saiten' })).route, 'manager');
  }],
  ['S06', 'Đăng ký: trùng biển số bị chặn (G15)', 'Trang 2', ({ svc }) => {
    assert.throws(() => svc.register(reg({ plate: '43A-12345' })), /đã có thẻ/);
  }],
  ['S07', 'Vé 100 lượt: vào bãi trừ 1 lượt, được cấp khu và chỗ, chạy AND ba việc (G03–G06)', 'Trang 3', ({ svc, h }) => {
    const r = G(svc, 'in', '43A-12345'); assert.equal(r.result, 'entered'); assert.equal(r.passes_left, 11); assert.equal(r.zone, 'G'); assert.ok(r.slot >= 1);
    assert.equal(h.auditCount('AND_', true), 3);
  }],
  ['S08', 'Vé tháng: vào/ra nhiều lần không trừ lượt, ưu tiên khu đã chọn (Khu D)', 'Trang 3', ({ svc, h }) => {
    for (let i = 0; i < 3; i++) { const r = G(svc, 'in', '43B1-123.45'); assert.equal(r.result, 'entered'); assert.equal(r.monthly, true); assert.equal(r.zone, 'D'); assert.equal(G(svc, 'out', '43B1-123.45').result, 'exited'); }
    assert.equal(h.card('43B1-123.45').passes, 0);
  }],
  ['S09', 'Vé tháng hết hạn và không còn lượt: bị từ chối, yêu cầu gia hạn (G04)', 'Trang 3', ({ svc, h, clock }) => {
    clock.advance(21 * 86400000); assert.equal(G(svc, 'in', '43B1-123.45').result, 'need_topup');
  }],
  ['S10', 'Hết lượt: vào bãi bị từ chối (G04)', 'Trang 3', ({ svc, h }) => {
    h.setCard('43A-12345', { passes: 0 }); assert.equal(G(svc, 'in', '43A-12345').result, 'need_topup');
  }],
  ['S11', 'Hai khu: khu ưu tiên đầy thì sang khu kia, cả hai đầy thì báo hết chỗ (G05)', 'Trang 3', ({ svc }) => {
    svc.saveSettings(U(svc, 'admin'), { cap_G: 1, cap_D: 1 });
    assert.equal(G(svc, 'in', '43A-12345').zone, 'G'); const r2 = G(svc, 'in', '43K-11111'); assert.equal(r2.zone, 'D');
    assert.equal(G(svc, 'in', '43B1-123.45').result, 'full');
  }],
  ['S12', 'Thẻ bị khóa hoặc sai biển số không vào được (G03)', 'Trang 3', ({ svc, h }) => {
    assert.equal(G(svc, 'in', '43Z-99999').result, 'invalid_card'); h.setCard('43A-12345', { status: 'locked' }); assert.equal(G(svc, 'in', '43A-12345').result, 'invalid_card');
  }],
  ['S13', 'Mua vé tháng 50.000đ qua VietQR: webhook cộng 30 ngày; thiếu tiền bị từ chối (G10, G12)', 'Trang 6', ({ svc, h }) => {
    const u = U(svc, 'sv2021001'); const t = svc.createTopup(u, 'thang', 'vietqr'); assert.equal(t.amount, 50000); assert.ok(t.seconds_left > 170);
    assert.throws(() => svc.bankWebhook(t.ref, 10000), /thiếu/); assert.equal(svc.bankWebhook(t.ref, 50000).status, 'confirmed');
    const c = h.card('43A-12345'); assert.ok(Math.abs(c.valid_until - svc.now() - 30 * 86400000) < 5000); assert.equal(svc.bankWebhook(t.ref, 50000).duplicate, true);
  }],
  ['S14', 'Mua vé 100 lượt 100.000đ: cộng đúng 100 lượt', 'Trang 6', ({ svc, h }) => {
    const u = U(svc, 'sv2021001'); const t = svc.createTopup(u, 'luot100', 'vietqr'); assert.equal(t.amount, 100000); svc.bankWebhook(t.ref, 100000);
    assert.equal(h.card('43A-12345').passes, 112);
  }],
  ['S15', 'Gia hạn vé tháng khi còn hạn: cộng dồn thêm 30 ngày', 'Trang 6', ({ svc, h }) => {
    const u = U(svc, 'cb001'); const before = h.card('43B1-123.45').valid_until;
    svc.decideCash(U(svc, 'nhanvien'), svc.createTopup(u, 'thang', 'tien_mat').id, true);
    assert.equal(h.card('43B1-123.45').valid_until - before, 30 * 86400000);
  }],
  ['S16', 'Loại vé theo đối tượng: khách chỉ mua vé khách, sinh viên không mua vé khách', 'Trang 6', ({ svc }) => {
    assert.throws(() => svc.createTopup(U(svc, 'sv2021001'), 'khach', 'vietqr'), /không áp dụng/); assert.throws(() => svc.createTopup(U(svc, 'khach01'), 'thang', 'vietqr'), /không áp dụng/);
  }],
  ['S17', 'VietQR hết hạn, thử lại, sau 3 lần thì thất bại (G12)', 'Trang 6', ({ svc, clock }) => {
    const u = U(svc, 'sv2021001'); const t = svc.createTopup(u, 'luot100', 'vietqr');
    for (let i = 1; i <= 2; i++) { clock.advance(181000); assert.equal(svc.getTopup(u, t.id).status, 'expired'); assert.equal(svc.retryTopup(u, t.id).attempts, i + 1); }
    clock.advance(181000); assert.equal(svc.getTopup(u, t.id).status, 'failed'); assert.throws(() => svc.retryTopup(u, t.id)); assert.throws(() => svc.bankWebhook(t.ref, 100000));
  }],
  ['S18', 'Nạp tiền mặt: nhân viên xác nhận cộng lượt, hoặc từ chối (G11)', 'Trang 6', ({ svc, h }) => {
    const u = U(svc, 'sv2021001'), nv = U(svc, 'nhanvien'); const t = svc.createTopup(u, 'luot100', 'tien_mat'); assert.equal(t.status, 'pending_cash');
    assert.equal(svc.decideCash(nv, t.id, true).status, 'confirmed'); assert.equal(h.card('43A-12345').passes, 112);
    assert.equal(svc.decideCash(nv, svc.createTopup(u, 'thang', 'tien_mat').id, false).status, 'rejected');
  }],
  ['S19', 'Nhân viên bán vé tại quầy: thu tiền mặt và cộng quyền gửi ngay', 'Trang 6 / NV', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'); const code = h.card('43A-12345').card_code;
    assert.equal(svc.staffSell(nv, code, 'thang').amount, 50000); assert.ok(h.card('43A-12345').valid_until > svc.now());
    assert.equal(svc.shiftReport(nv).cash_total, 50000);
  }],
  ['S20', 'Camera dưới ngưỡng 3 lần thì cần nhân viên hỗ trợ (G06, G07)', 'Trang 5', ({ svc }) => {
    G(svc, 'in', '43A-12345'); assert.equal(G(svc, 'out', '43A-12345', 0.8).result, 'retry'); assert.equal(G(svc, 'out', '43A-12345', 0.85).result, 'retry'); assert.equal(G(svc, 'out', '43A-12345', 0.9).result, 'assist_required');
  }],
  ['S21', 'Xác minh thủ công được: ghi nhật ký xác minh, cho xe ra (G08)', 'Trang 4', ({ svc, h }) => {
    G(svc, 'in', '43A-12345'); const r = fail3(svc, 'out', '43A-12345');
    assert.equal(svc.staffAssist(U(svc, 'nhanvien'), r.event_id, true, 'đối chiếu thẻ SV').result, 'exited'); assert.equal(h.auditCount('VERIFY_LOG'), 1);
  }],
  ['S22', 'Không xác minh được: lập biên bản sự cố, Quản lý cho phép ngoại lệ (G08, G09)', 'Trang 4', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'), ql = U(svc, 'quanly'); G(svc, 'in', '43A-12345'); const r = fail3(svc, 'out', '43A-12345');
    assert.equal(svc.staffAssist(nv, r.event_id, false, 'không có CCCD').status, 'escalated'); assert.equal(h.incident().status, 'reported');
    assert.equal(svc.decideEscalation(ql, r.event_id, true).result, 'exited'); assert.equal(h.incident().status, 'closed');
  }],
  ['S23', 'Quản lý từ chối: khóa phiên, giữ xe, bảo vệ xử lý, nhân viên đóng sự cố (G09)', 'Trang 4', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'), ql = U(svc, 'quanly'); G(svc, 'in', '43A-12345'); const r = fail3(svc, 'out', '43A-12345');
    svc.staffAssist(nv, r.event_id, false, 'nghi vấn'); assert.equal(svc.decideEscalation(ql, r.event_id, false).result, 'session_locked');
    assert.equal(h.lastSession().status, 'blocked'); assert.equal(h.auditCount('SECURITY_ALERT'), 1);
    const held = svc.staffQueue(nv).held; assert.equal(held.length, 1); assert.throws(() => svc.closeIncident(nv, held[0].id, ''), /kết quả/);
    assert.equal(svc.closeIncident(nv, held[0].id, 'đã bàn giao bảo vệ').status, 'closed');
  }],
  ['S24', 'Hỗ trợ cổng vào: hết lượt, nhân viên thu tiền mặt và cho xe vào (G14)', 'GĐ2b', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'); h.setCard('43A-12345', { passes: 0 }); const r = G(svc, 'in', '43A-12345'); assert.equal(r.result, 'need_topup');
    assert.equal(svc.staffQueue(nv).refusals.length, 1); const s = svc.staffSupport(nv, r.event_id, 'sell_cash', { product: 'thang' }); assert.equal(s.result, 'entered'); assert.equal(s.monthly, true);
  }],
  ['S25', 'Hỗ trợ cổng vào: cấp lượt tạm phải có lý do; từ chối vào bãi (G14)', 'GĐ2b', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'); h.setCard('43A-12345', { passes: 0 }); const r = G(svc, 'in', '43A-12345');
    assert.throws(() => svc.staffSupport(nv, r.event_id, 'temp_pass', {}), /lý do/); assert.equal(svc.staffSupport(nv, r.event_id, 'temp_pass', { note: 'quên ví' }).result, 'entered');
    h.setCard('43K-11111', { passes: 0 }); h.setCard('43K-11111', { passes: 0 }); const g = G(svc, 'in', '43K-11111'); G(svc, 'out', '43A-12345');
    assert.equal(svc.staffSupport(nv, g.event_id, 'refuse', { note: 'không mua vé' }).result, 'refused'); assert.throws(() => svc.staffSupport(nv, g.event_id, 'refuse', {}), /không cần/);
  }],
  ['S26', 'Hỗ trợ cổng vào: thẻ khóa do báo mất thì nhân viên không được mở', 'GĐ2b', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'); const u = U(svc, 'sv2021001'); svc.reportLost(u, svc.myOverview(u).cards[0].id, '');
    const r = G(svc, 'in', '43A-12345'); assert.equal(r.result, 'invalid_card'); assert.throws(() => svc.staffSupport(nv, r.event_id, 'temp_pass', { note: 'thử' }), /khóa/);
  }],
  ['S27', 'Xe vào quá 3 phút chưa xác nhận đỗ: nhắc nhân viên ra chỉ dẫn (timer)', 'Trang 3', ({ svc, clock }) => {
    const nv = U(svc, 'nhanvien'); const r = G(svc, 'in', '43A-12345'); assert.equal(svc.staffQueue(nv).unparked[0].overdue, false);
    clock.advance(4 * 60000); assert.equal(svc.staffQueue(nv).unparked[0].overdue, true); svc.confirmParked(nv, r.session_id); assert.equal(svc.staffQueue(nv).unparked.length, 0); assert.throws(() => svc.confirmParked(nv, r.session_id));
  }],
  ['S28', 'Tra cứu của nhân viên theo biển số, mã thẻ, MSSV', 'NV', ({ svc }) => {
    const nv = U(svc, 'nhanvien'); assert.equal(svc.staffLookup(nv, '43A-12345')[0].username, 'sv2021001'); assert.equal(svc.staffLookup(nv, '2021001').length, 1); assert.throws(() => svc.staffLookup(nv, 'ab'));
  }],
  ['S29', 'Báo mất thẻ: khóa ngay, Quản lý cấp thẻ mới, chuyển cả vé tháng và lượt (G13)', 'Trang 7', ({ svc, h }) => {
    const u = U(svc, 'cb001'), ql = U(svc, 'quanly'); const old = svc.myOverview(u).cards[0]; const l = svc.reportLost(u, old.id, 'rơi ví'); assert.equal(l.card_locked, true);
    assert.equal(svc.decideLost(ql, l.id, true).status, 'reissued'); const cards = svc.myOverview(u).cards; assert.ok(cards[0].monthly_active); assert.equal(cards[1].valid_until, null);
  }],
  ['S30', 'Báo mất thẻ: Quản lý từ chối, kết thúc "từ chối" (G13)', 'Trang 7', ({ svc }) => {
    const u = U(svc, 'cb001'), ql = U(svc, 'quanly'); const l = svc.reportLost(u, svc.myOverview(u).cards[0].id, '');
    assert.equal(svc.decideLost(ql, l.id, false).status, 'rejected'); assert.throws(() => svc.decideLost(ql, l.id, true));
  }],
  ['S31', 'Phân quyền: mỗi vai trò chỉ thao tác trong phạm vi của mình', 'Bảo mật', ({ svc }) => {
    const sv = U(svc, 'sv2021001'), nv = U(svc, 'nhanvien'), ql = U(svc, 'quanly');
    assert.throws(() => svc.decideRegistration(sv, 1, true), /quyền/); assert.throws(() => svc.gate(sv, 'in', { plate: '43A-12345', confidence: 1 }), /quyền/);
    assert.throws(() => svc.managerQueue(nv), /quyền/); assert.throws(() => svc.listUsers(nv), /quyền/); assert.throws(() => svc.staffQueue(ql), /quyền/); assert.throws(() => svc.saveSettings(nv, { cap_G: 5 }), /quyền/);
  }],
  ['S32', 'Đăng nhập: sai mật khẩu 5 lần bị khóa tạm thời', 'Bảo mật', ({ svc }) => {
    for (let i = 0; i < 5; i++) assert.throws(() => svc.login('admin', 'sai', 'x'), /Sai/); assert.throws(() => svc.login('admin', 'Due@2026', 'x'), /quá nhiều/);
  }],
  ['S33', 'Đầu vào xấu: biển số, mật khẩu ngắn, loại vé lạ, độ tin cậy ngoài 0–1', 'Bảo mật', ({ svc }) => {
    assert.throws(() => svc.register(reg({ plate: 'abc' })), /Biển số/); assert.throws(() => svc.register(reg({ password: '123' })), /Mật khẩu/);
    assert.throws(() => svc.createTopup(U(svc, 'sv2021001'), 'vip', 'vietqr'), /không áp dụng/); assert.throws(() => G(svc, 'in', '43A-12345', 5), /0–1/);
  }],
  ['S34', 'Vé tháng hết hạn là hết quyền gửi dù từng còn lượt; mua vé 100 lượt thì chuyển sang theo lượt', 'Trang 3, 6', ({ svc, clock }) => {
    const u = U(svc, 'sv2021001'); svc.decideCash(U(svc, 'nhanvien'), svc.createTopup(u, 'thang', 'tien_mat').id, true);
    assert.equal(G(svc, 'in', '43A-12345').result, 'entered'); G(svc, 'out', '43A-12345');
    clock.advance(31 * 86400000); assert.equal(G(svc, 'in', '43A-12345').result, 'need_topup');
    svc.decideCash(U(svc, 'nhanvien'), svc.createTopup(u, 'luot100', 'tien_mat').id, true);
    const r = G(svc, 'in', '43A-12345'); assert.equal(r.result, 'entered'); assert.equal(r.monthly, false); assert.equal(r.passes_left, 111);
  }],
  ['S35', 'Còn vé tháng hiệu lực thì không bán thêm vé theo lượt', 'Trang 6', ({ svc }) => {
    assert.throws(() => svc.createTopup(U(svc, 'cb001'), 'luot100', 'vietqr'), /còn hiệu lực/);
  }],
  ['S36', 'Vé khách vãng lai giá 2.000đ mỗi lượt, mua qua VietQR', 'Trang 6', ({ svc, h }) => {
    const u = U(svc, 'khach01'); const t = svc.createTopup(u, 'khach', 'vietqr'); assert.equal(t.amount, 2000); svc.bankWebhook(t.ref, 2000);
    assert.equal(h.card('43K-11111').passes, 2);
  }],
];

function runAll(createContext) {
  createContext = createContext || require('./context').createContext;
  return SCENARIOS.map(([id, title, page, fn]) => {
    const ctx = createContext(':memory:'); const t0 = Date.now();
    try { fn(ctx); return { id, title, page, pass: true, ms: Date.now() - t0 }; }
    catch (e) { return { id, title, page, pass: false, error: e.message, ms: Date.now() - t0 }; }
  });
}
module.exports = { SCENARIOS, runAll };

};
defs["routes"]=function(module,exports,require){
'use strict';
// Bảng API dùng chung cho máy chủ Node và bản chạy trong trình duyệt.
// Mỗi handler nhận { params, body, user, token, query, ip, header(), setSession(), clearSession() }.
function defineRoutes(on, { svc, runAll, id, AppError }) {
  const adminOnly = (user) => { if (user.role !== 'ADMIN') throw new AppError(403, 'forbidden', 'Không đủ quyền'); };
  /* công khai */
  on('GET', '/api/public/config', () => svc.publicConfig(), { auth: false });
  on('POST', '/api/public/register', ({ body }) => svc.register(body), { auth: false });
  on('GET', '/api/public/registration/:u', ({ params }) => { const r = svc.registrationStatus(decodeURIComponent(params.u)); return { status: r.status, route: r.route, note: r.note }; }, { auth: false });
  on('POST', '/api/auth/login', ({ body, ip, setSession }) => { const r = svc.login(String(body.username || ''), String(body.password || ''), ip || '-'); setSession(r.token); return r.user; }, { auth: false });
  on('POST', '/api/auth/logout', ({ user, token, clearSession }) => { svc.logout(token, user); clearSession(); return { ok: true }; });
  on('GET', '/api/auth/me', ({ user }) => user);
  // webhook ngân hàng: xác thực bằng bí mật dùng chung, không dùng phiên đăng nhập
  on('POST', '/api/webhook/bank', ({ header, body }) => {
    if (!svc.checkSecret(header('x-webhook-secret'))) throw new AppError(401, 'bad_secret', 'Sai bí mật webhook');
    return svc.bankWebhook(body.ref, body.amount, 'bank');
  }, { auth: false });
  /* người gửi xe */
  on('GET', '/api/me/overview', ({ user }) => svc.myOverview(user));
  on('POST', '/api/me/topups', ({ user, body }) => svc.createTopup(user, body.product, body.method));
  on('GET', '/api/me/topups/:id', ({ user, params }) => svc.getTopup(user, id(params.id)));
  on('POST', '/api/me/topups/:id/retry', ({ user, params }) => svc.retryTopup(user, id(params.id)));
  on('POST', '/api/me/lost', ({ user, body }) => svc.reportLost(user, id(body.card_id), body.note));
  /* nhân viên */
  on('GET', '/api/staff/queue', ({ user }) => svc.staffQueue(user));
  on('POST', '/api/staff/topups/:id', ({ user, params, body }) => svc.decideCash(user, id(params.id), body.confirm === true));
  on('POST', '/api/staff/assist/:id', ({ user, params, body }) => svc.staffAssist(user, id(params.id), body.verified === true, body.note));
  on('POST', '/api/staff/support/:id', ({ user, params, body }) => svc.staffSupport(user, id(params.id), body.action, body));
  on('POST', '/api/staff/sell', ({ user, body }) => svc.staffSell(user, body.card_code, body.product));
  on('POST', '/api/staff/parked/:id', ({ user, params }) => svc.confirmParked(user, id(params.id)));
  on('POST', '/api/staff/incidents/:id/close', ({ user, params, body }) => svc.closeIncident(user, id(params.id), body.note));
  on('GET', '/api/staff/lookup', ({ user, query }) => svc.staffLookup(user, query.q));
  on('GET', '/api/staff/shift', ({ user }) => svc.shiftReport(user));
  on('POST', '/api/gate/:direction', ({ user, params, body }) => svc.gate(user, params.direction, body));
  /* quản lý */
  on('GET', '/api/manager/queue', ({ user }) => svc.managerQueue(user));
  on('POST', '/api/manager/registrations/:id', ({ user, params, body }) => svc.decideRegistration(user, id(params.id), body.approve === true, body.note));
  on('POST', '/api/manager/lost/:id', ({ user, params, body }) => svc.decideLost(user, id(params.id), body.approve === true));
  on('POST', '/api/manager/escalations/:id', ({ user, params, body }) => svc.decideEscalation(user, id(params.id), body.allow === true, body.note));
  /* quản trị / giảng viên chấm */
  on('GET', '/api/admin/stats', ({ user }) => svc.stats(user));
  on('GET', '/api/admin/flows', ({ user }) => svc.flows(user));
  on('GET', '/api/admin/audit', ({ user, query }) => svc.auditList(user, query.limit));
  on('GET', '/api/admin/users', ({ user }) => svc.listUsers(user));
  on('POST', '/api/admin/users', ({ user, body }) => svc.adminCreateUser(user, body));
  on('POST', '/api/admin/users/:id/active', ({ user, params, body }) => svc.setUserActive(user, id(params.id), body.active === true));
  on('GET', '/api/admin/settings', ({ user }) => { adminOnly(user); return { ...svc.allSettings(), webhook_secret: svc.webhookSecret() }; });
  on('PUT', '/api/admin/settings', ({ user, body }) => svc.saveSettings(user, body));
  on('POST', '/api/admin/import', ({ user, body }) => svc.importData(user, body));
  on('GET', '/api/admin/export', ({ user }) => svc.exportData(user));
  on('POST', '/api/admin/selftest', ({ user }) => { adminOnly(user); const r = runAll(); svc.audit(user, 'SELFTEST', `${r.filter(x => x.pass).length}/${r.length} đạt`); return r; });
  on('GET', '/api/admin/open-topups', ({ user }) => svc.openTopups(user));
  on('POST', '/api/admin/simulate-bank', ({ user, body }) => svc.simulateBank(user, id(body.topup_id)));
  on('POST', '/api/admin/reset', ({ user, body }) => svc.resetAll(user, body.confirm));
}
module.exports = { defineRoutes };

};
defs["localapi"]=function(module,exports,require){
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

};
function norm(n){n=n.replace(/^\.\//,"");var a={"platform":"platform.browser","db":"db.mini"};return a[n]||n}
function req(n){if(n==="assert")return assert;var k=norm(n);if(cache[k])return cache[k].exports;if(!defs[k])throw new Error("thiếu module "+n);var m={exports:{}};cache[k]=m;defs[k](m,m.exports,req);return m.exports}
req("localapi");})();
