'use strict';
const { runAll } = require('../lib/scenarios');
const r = runAll();
for (const x of r) console.log(`${x.pass ? 'ĐẠT ' : 'LỖI '} ${x.id} [${x.page}] ${x.title}${x.error ? '  -> ' + x.error : ''}`);
console.log(`${r.filter(x => x.pass).length}/${r.length} kịch bản đạt`);
process.exit(r.every(x => x.pass) ? 0 : 1);
