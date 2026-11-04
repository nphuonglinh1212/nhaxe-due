'use strict';
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('NGX','NV','QL','ADMIN')), code TEXT, user_type TEXT,
  pass_hash TEXT NOT NULL, salt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS directory(code TEXT PRIMARY KEY, full_name TEXT NOT NULL, user_type TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cards(
  id INTEGER PRIMARY KEY, card_code TEXT UNIQUE NOT NULL, owner_id INTEGER NOT NULL REFERENCES users(id),
  plate TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','locked')), passes INTEGER NOT NULL DEFAULT 0,
  valid_until INTEGER, zone_pref TEXT NOT NULL DEFAULT 'G', ticket_pref TEXT,
  issued_at INTEGER NOT NULL, replaced_from INTEGER);
CREATE TABLE IF NOT EXISTS registrations(
  id INTEGER PRIMARY KEY, full_name TEXT NOT NULL, user_type TEXT NOT NULL, code TEXT, plate TEXT NOT NULL,
  email TEXT, phone TEXT, username TEXT NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL,
  ticket_pref TEXT, zone_pref TEXT NOT NULL DEFAULT 'G',
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')), route TEXT NOT NULL,
  decided_by TEXT, decided_at INTEGER, note TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS topups(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, card_id INTEGER NOT NULL, product TEXT NOT NULL, packs INTEGER NOT NULL DEFAULT 0,
  method TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('pending_cash','awaiting_payment','confirmed','expired','failed','rejected')),
  ref TEXT UNIQUE, attempts INTEGER NOT NULL DEFAULT 0, expires_at INTEGER, created_at INTEGER NOT NULL,
  decided_by TEXT, decided_at INTEGER);
CREATE TABLE IF NOT EXISTS parking_sessions(
  id INTEGER PRIMARY KEY, card_id INTEGER NOT NULL, plate TEXT NOT NULL, entry_at INTEGER NOT NULL,
  exit_at INTEGER, status TEXT NOT NULL CHECK(status IN ('in','out','blocked')), zone TEXT, slot INTEGER, parked_at INTEGER);
CREATE TABLE IF NOT EXISTS gate_events(
  id INTEGER PRIMARY KEY, direction TEXT NOT NULL CHECK(direction IN ('in','out')), plate TEXT NOT NULL,
  card_id INTEGER, confidence REAL, attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('retry','assist','escalated','done','denied')),
  outcome TEXT, zone TEXT, session_id INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  assisted_by TEXT, manager_by TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS lost_reports(
  id INTEGER PRIMARY KEY, card_id INTEGER NOT NULL, user_id INTEGER NOT NULL, note TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','reissued','rejected')), new_card_id INTEGER,
  decided_by TEXT, decided_at INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS incidents(
  id INTEGER PRIMARY KEY, event_id INTEGER, card_id INTEGER, plate TEXT, kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('reported','held','closed')), note TEXT, reported_by TEXT, closed_by TEXT, created_at INTEGER NOT NULL, closed_at INTEGER);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, actor TEXT NOT NULL, role TEXT, action TEXT NOT NULL, detail TEXT);
CREATE TABLE IF NOT EXISTS gateway_log(id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, gw TEXT NOT NULL, branch TEXT NOT NULL, ref TEXT);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_cards_plate ON cards(plate);
CREATE INDEX IF NOT EXISTS ix_sess_card ON parking_sessions(card_id,status);
`;

function open(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys=ON');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode=WAL');
  db.exec(SCHEMA);
  const q = {
    run: (sql, ...p) => db.prepare(sql).run(...p),
    get: (sql, ...p) => db.prepare(sql).get(...p),
    all: (sql, ...p) => db.prepare(sql).all(...p),
    tx(fn) { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    db,
  };
  return q;
}
module.exports = { open };
