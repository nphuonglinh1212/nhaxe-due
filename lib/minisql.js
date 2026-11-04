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
