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
