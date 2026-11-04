'use strict';
// Gói ứng dụng thành thư mục tĩnh chạy hoàn toàn trong trình duyệt (mở file hoặc đưa lên GitHub Pages).
// Dùng: node scripts/build-static.js [thư-mục-đích]   (mặc định: static-site)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), lib = path.join(root, 'lib'), pub = path.join(root, 'public');
const out = path.resolve(process.argv[2] || path.join(root, 'static-site'));
// tên module yêu cầu -> tệp thực tế (bản trình duyệt thay SQLite và crypto của Node)
const ALIAS = { './platform': 'platform.browser.js', './db': 'db.mini.js' };
const FILES = ['util', 'platform.browser', 'flows', 'minisql', 'db.mini', 'service', 'seed', 'context', 'scenarios', 'routes', 'localapi'];
const key = (f) => f.replace(/\.js$/, '');
let src = '(function(){"use strict";\nvar defs={},cache={};\n';
src += 'var assert=(function(){function F(m){var e=new Error(m);e.name="AssertionError";return e}\n' +
  'function eq(a,b){return a===b||(typeof a==="number"&&typeof b==="number"&&a!==a&&b!==b)}\n' +
  'function loose(a,b){return a==b}\n' +
  'var A={ok:function(v,m){if(!v)throw F(m||"giá trị không đúng: "+v)},equal:function(a,b,m){if(!loose(a,b))throw F(m||("khác nhau: "+JSON.stringify(a)+" != "+JSON.stringify(b)))},' +
  'match:function(s,re,m){if(!re.test(String(s)))throw F(m||("không khớp "+re+": "+s))},' +
  'throws:function(fn,re,m){var t=false;try{fn()}catch(e){t=true;if(re instanceof RegExp&&!re.test(String(e&&e.message)))throw F(m||("lỗi không khớp "+re+": "+(e&&e.message)))}if(!t)throw F(m||"cần có lỗi nhưng không có")}};return A})();\n';
for (const f of FILES) src += `defs[${JSON.stringify(key(f))}]=function(module,exports,require){\n${fs.readFileSync(path.join(lib, f + '.js'), 'utf8')}\n};\n`;
src += `function norm(n){n=n.replace(/^\\.\\//,"");var a={"platform":"platform.browser","db":"db.mini"};return a[n]||n}
function req(n){if(n==="assert")return assert;var k=norm(n);if(cache[k])return cache[k].exports;if(!defs[k])throw new Error("thiếu module "+n);var m={exports:{}};cache[k]=m;defs[k](m,m.exports,req);return m.exports}
req("localapi");})();\n`;
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'backend.js'), '/* Tự sinh bởi scripts/build-static.js — đừng sửa tay */\n' + src);
for (const f of fs.readdirSync(pub)) {
  let c = fs.readFileSync(path.join(pub, f));
  if (f.endsWith('.html')) {
    let h = c.toString('utf8');
    if (f === 'index.html') h = h.replace('<script>\n/* Lấy thông số thật', '<script src="backend.js"></script>\n<script>\n/* Lấy thông số thật');
    else h = h.replace('<script src="common.js">', '<script src="backend.js"></script>\n<script src="common.js">');
    c = Buffer.from(h);
  }
  fs.writeFileSync(path.join(out, f), c);
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('Đã tạo bản trình duyệt tại ' + out + ' (' + Math.round(fs.statSync(path.join(out, 'backend.js')).size / 1024) + ' KB backend.js)');
