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
