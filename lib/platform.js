'use strict';
// Phần phụ thuộc nền tảng (bản máy chủ Node). Bản trình duyệt dùng platform.browser.js.
const crypto = require('crypto');
module.exports = {
  randomHex: (n) => crypto.randomBytes(n).toString('hex'),
  kdf: (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex'),
  safeEqual(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); },
};
