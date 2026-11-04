'use strict';
// Chạy 36 kịch bản trên bộ xử lý dữ liệu thuần JavaScript (không dùng SQLite) để đối chiếu kết quả.
const { createContext } = require('../lib/context');
const { open } = require('../lib/db.mini');
const { runAll } = require('../lib/scenarios');
const res = runAll((f) => createContext(f, { open }));
let ok = 0; for (const r of res) { if (r.pass) ok++; console.log((r.pass ? 'ĐẠT  ' : 'LỖI  ') + r.id + ' ' + r.title + (r.error ? '\n      → ' + r.error : '')); }
console.log(`${ok}/${res.length} kịch bản đạt (bộ xử lý thuần JS)`); process.exit(ok === res.length ? 0 : 1);
