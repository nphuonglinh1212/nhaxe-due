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
