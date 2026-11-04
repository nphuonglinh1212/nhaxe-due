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
