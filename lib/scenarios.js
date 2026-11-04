'use strict';
// Kịch bản kiểm thử bám mô hình To-Be. Dùng chung cho `npm test` và nút "Chạy kiểm thử" trong trang quản trị.
const assert = require('assert');

const U = (svc, name) => svc.userByToken(svc.login(name, 'Due@2026', 't').token);
const reg = (o) => ({ full_name: 'Khách Một', user_type: 'kh', plate: '43C-11111', username: 'khach1', password: 'matkhau123', ...o });
const G = (svc, dir, plate, conf = 0.99, extra = {}) => svc.gate(U(svc, 'nhanvien'), dir, { plate, confidence: conf, ...extra });
const fail3 = (svc, dir, plate) => { let r; for (let i = 0; i < 3; i++) r = G(svc, dir, plate, 0.5); return r; };

const SCENARIOS = [
  ['S01', 'Đăng ký: sinh viên nhập MSSV có trong CSDL được duyệt tự động (G15, G01)', 'Trang 2', ({ svc, h }) => {
    const r = svc.register(reg({ full_name: 'Trần Thị Bình', user_type: 'sv', code: '2021002', username: 'sv2021002', plate: '43A-22222', ticket_pref: 'thang', zone_pref: 'D' }));
    assert.equal(r.status, 'approved'); assert.equal(r.route, 'auto'); assert.match(r.card, /^DUE-/);
    const c = h.card('43A-22222'); assert.equal(c.zone_pref, 'D'); assert.equal(c.ticket_pref, 'thang');
  }],
  ['S02', 'Đăng ký: sinh viên bắt buộc có MSSV', 'Trang 2', ({ svc }) => {
    assert.throws(() => svc.register(reg({ user_type: 'sv', code: '', username: 'xyz1' })), /MSSV/);
  }],
  ['S03', 'Đăng ký: khách vãng lai chờ Quản lý duyệt rồi được cấp thẻ (G01→G02)', 'Trang 2', ({ svc }) => {
    const r = svc.register(reg({})); assert.equal(r.status, 'pending');
    const d = svc.decideRegistration(U(svc, 'quanly'), r.id, true, 'ok'); assert.equal(d.status, 'approved'); assert.ok(svc.login('khach1', 'matkhau123', 't').token);
  }],
  ['S04', 'Đăng ký: Quản lý từ chối hồ sơ (G02)', 'Trang 2', ({ svc }) => {
    const r = svc.register(reg({ username: 'khach2' }));
    assert.equal(svc.decideRegistration(U(svc, 'quanly'), r.id, false, 'thiếu giấy tờ').status, 'rejected'); assert.throws(() => svc.login('khach2', 'matkhau123', 't'));
  }],
  ['S05', 'Đăng ký: MSSV không khớp tên bị chuyển Quản lý (G01)', 'Trang 2', ({ svc }) => {
    assert.equal(svc.register(reg({ user_type: 'sv', code: '2021003', full_name: 'Người Khác', username: 'saiten' })).route, 'manager');
  }],
  ['S06', 'Đăng ký: trùng biển số bị chặn (G15)', 'Trang 2', ({ svc }) => {
    assert.throws(() => svc.register(reg({ plate: '43A-12345' })), /đã có thẻ/);
  }],
  ['S07', 'Vé 100 lượt: vào bãi trừ 1 lượt, được cấp khu và chỗ, chạy AND ba việc (G03–G06)', 'Trang 3', ({ svc, h }) => {
    const r = G(svc, 'in', '43A-12345'); assert.equal(r.result, 'entered'); assert.equal(r.passes_left, 11); assert.equal(r.zone, 'G'); assert.ok(r.slot >= 1);
    assert.equal(h.auditCount('AND_', true), 3);
  }],
  ['S08', 'Vé tháng: vào/ra nhiều lần không trừ lượt, ưu tiên khu đã chọn (Khu D)', 'Trang 3', ({ svc, h }) => {
    for (let i = 0; i < 3; i++) { const r = G(svc, 'in', '43B1-123.45'); assert.equal(r.result, 'entered'); assert.equal(r.monthly, true); assert.equal(r.zone, 'D'); assert.equal(G(svc, 'out', '43B1-123.45').result, 'exited'); }
    assert.equal(h.card('43B1-123.45').passes, 0);
  }],
  ['S09', 'Vé tháng hết hạn và không còn lượt: bị từ chối, yêu cầu gia hạn (G04)', 'Trang 3', ({ svc, h, clock }) => {
    clock.advance(21 * 86400000); assert.equal(G(svc, 'in', '43B1-123.45').result, 'need_topup');
  }],
  ['S10', 'Hết lượt: vào bãi bị từ chối (G04)', 'Trang 3', ({ svc, h }) => {
    h.setCard('43A-12345', { passes: 0 }); assert.equal(G(svc, 'in', '43A-12345').result, 'need_topup');
  }],
  ['S11', 'Hai khu: khu ưu tiên đầy thì sang khu kia, cả hai đầy thì báo hết chỗ (G05)', 'Trang 3', ({ svc }) => {
    svc.saveSettings(U(svc, 'admin'), { cap_G: 1, cap_D: 1 });
    assert.equal(G(svc, 'in', '43A-12345').zone, 'G'); const r2 = G(svc, 'in', '43K-11111'); assert.equal(r2.zone, 'D');
    assert.equal(G(svc, 'in', '43B1-123.45').result, 'full');
  }],
  ['S12', 'Thẻ bị khóa hoặc sai biển số không vào được (G03)', 'Trang 3', ({ svc, h }) => {
    assert.equal(G(svc, 'in', '43Z-99999').result, 'invalid_card'); h.setCard('43A-12345', { status: 'locked' }); assert.equal(G(svc, 'in', '43A-12345').result, 'invalid_card');
  }],
  ['S13', 'Mua vé tháng 50.000đ qua VietQR: webhook cộng 30 ngày; thiếu tiền bị từ chối (G10, G12)', 'Trang 6', ({ svc, h }) => {
    const u = U(svc, 'sv2021001'); const t = svc.createTopup(u, 'thang', 'vietqr'); assert.equal(t.amount, 50000); assert.ok(t.seconds_left > 170);
    assert.throws(() => svc.bankWebhook(t.ref, 10000), /thiếu/); assert.equal(svc.bankWebhook(t.ref, 50000).status, 'confirmed');
    const c = h.card('43A-12345'); assert.ok(Math.abs(c.valid_until - svc.now() - 30 * 86400000) < 5000); assert.equal(svc.bankWebhook(t.ref, 50000).duplicate, true);
  }],
  ['S14', 'Mua vé 100 lượt 100.000đ: cộng đúng 100 lượt', 'Trang 6', ({ svc, h }) => {
    const u = U(svc, 'sv2021001'); const t = svc.createTopup(u, 'luot100', 'vietqr'); assert.equal(t.amount, 100000); svc.bankWebhook(t.ref, 100000);
    assert.equal(h.card('43A-12345').passes, 112);
  }],
  ['S15', 'Gia hạn vé tháng khi còn hạn: cộng dồn thêm 30 ngày', 'Trang 6', ({ svc, h }) => {
    const u = U(svc, 'cb001'); const before = h.card('43B1-123.45').valid_until;
    svc.decideCash(U(svc, 'nhanvien'), svc.createTopup(u, 'thang', 'tien_mat').id, true);
    assert.equal(h.card('43B1-123.45').valid_until - before, 30 * 86400000);
  }],
  ['S16', 'Loại vé theo đối tượng: khách chỉ mua vé khách, sinh viên không mua vé khách', 'Trang 6', ({ svc }) => {
    assert.throws(() => svc.createTopup(U(svc, 'sv2021001'), 'khach', 'vietqr'), /không áp dụng/); assert.throws(() => svc.createTopup(U(svc, 'khach01'), 'thang', 'vietqr'), /không áp dụng/);
  }],
  ['S17', 'VietQR hết hạn, thử lại, sau 3 lần thì thất bại (G12)', 'Trang 6', ({ svc, clock }) => {
    const u = U(svc, 'sv2021001'); const t = svc.createTopup(u, 'luot100', 'vietqr');
    for (let i = 1; i <= 2; i++) { clock.advance(181000); assert.equal(svc.getTopup(u, t.id).status, 'expired'); assert.equal(svc.retryTopup(u, t.id).attempts, i + 1); }
    clock.advance(181000); assert.equal(svc.getTopup(u, t.id).status, 'failed'); assert.throws(() => svc.retryTopup(u, t.id)); assert.throws(() => svc.bankWebhook(t.ref, 100000));
  }],
  ['S18', 'Nạp tiền mặt: nhân viên xác nhận cộng lượt, hoặc từ chối (G11)', 'Trang 6', ({ svc, h }) => {
    const u = U(svc, 'sv2021001'), nv = U(svc, 'nhanvien'); const t = svc.createTopup(u, 'luot100', 'tien_mat'); assert.equal(t.status, 'pending_cash');
    assert.equal(svc.decideCash(nv, t.id, true).status, 'confirmed'); assert.equal(h.card('43A-12345').passes, 112);
    assert.equal(svc.decideCash(nv, svc.createTopup(u, 'thang', 'tien_mat').id, false).status, 'rejected');
  }],
  ['S19', 'Nhân viên bán vé tại quầy: thu tiền mặt và cộng quyền gửi ngay', 'Trang 6 / NV', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'); const code = h.card('43A-12345').card_code;
    assert.equal(svc.staffSell(nv, code, 'thang').amount, 50000); assert.ok(h.card('43A-12345').valid_until > svc.now());
    assert.equal(svc.shiftReport(nv).cash_total, 50000);
  }],
  ['S20', 'Camera dưới ngưỡng 3 lần thì cần nhân viên hỗ trợ (G06, G07)', 'Trang 5', ({ svc }) => {
    G(svc, 'in', '43A-12345'); assert.equal(G(svc, 'out', '43A-12345', 0.8).result, 'retry'); assert.equal(G(svc, 'out', '43A-12345', 0.85).result, 'retry'); assert.equal(G(svc, 'out', '43A-12345', 0.9).result, 'assist_required');
  }],
  ['S21', 'Xác minh thủ công được: ghi nhật ký xác minh, cho xe ra (G08)', 'Trang 4', ({ svc, h }) => {
    G(svc, 'in', '43A-12345'); const r = fail3(svc, 'out', '43A-12345');
    assert.equal(svc.staffAssist(U(svc, 'nhanvien'), r.event_id, true, 'đối chiếu thẻ SV').result, 'exited'); assert.equal(h.auditCount('VERIFY_LOG'), 1);
  }],
  ['S22', 'Không xác minh được: lập biên bản sự cố, Quản lý cho phép ngoại lệ (G08, G09)', 'Trang 4', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'), ql = U(svc, 'quanly'); G(svc, 'in', '43A-12345'); const r = fail3(svc, 'out', '43A-12345');
    assert.equal(svc.staffAssist(nv, r.event_id, false, 'không có CCCD').status, 'escalated'); assert.equal(h.incident().status, 'reported');
    assert.equal(svc.decideEscalation(ql, r.event_id, true).result, 'exited'); assert.equal(h.incident().status, 'closed');
  }],
  ['S23', 'Quản lý từ chối: khóa phiên, giữ xe, bảo vệ xử lý, nhân viên đóng sự cố (G09)', 'Trang 4', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'), ql = U(svc, 'quanly'); G(svc, 'in', '43A-12345'); const r = fail3(svc, 'out', '43A-12345');
    svc.staffAssist(nv, r.event_id, false, 'nghi vấn'); assert.equal(svc.decideEscalation(ql, r.event_id, false).result, 'session_locked');
    assert.equal(h.lastSession().status, 'blocked'); assert.equal(h.auditCount('SECURITY_ALERT'), 1);
    const held = svc.staffQueue(nv).held; assert.equal(held.length, 1); assert.throws(() => svc.closeIncident(nv, held[0].id, ''), /kết quả/);
    assert.equal(svc.closeIncident(nv, held[0].id, 'đã bàn giao bảo vệ').status, 'closed');
  }],
  ['S24', 'Hỗ trợ cổng vào: hết lượt, nhân viên thu tiền mặt và cho xe vào (G14)', 'GĐ2b', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'); h.setCard('43A-12345', { passes: 0 }); const r = G(svc, 'in', '43A-12345'); assert.equal(r.result, 'need_topup');
    assert.equal(svc.staffQueue(nv).refusals.length, 1); const s = svc.staffSupport(nv, r.event_id, 'sell_cash', { product: 'thang' }); assert.equal(s.result, 'entered'); assert.equal(s.monthly, true);
  }],
  ['S25', 'Hỗ trợ cổng vào: cấp lượt tạm phải có lý do; từ chối vào bãi (G14)', 'GĐ2b', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'); h.setCard('43A-12345', { passes: 0 }); const r = G(svc, 'in', '43A-12345');
    assert.throws(() => svc.staffSupport(nv, r.event_id, 'temp_pass', {}), /lý do/); assert.equal(svc.staffSupport(nv, r.event_id, 'temp_pass', { note: 'quên ví' }).result, 'entered');
    h.setCard('43K-11111', { passes: 0 }); h.setCard('43K-11111', { passes: 0 }); const g = G(svc, 'in', '43K-11111'); G(svc, 'out', '43A-12345');
    assert.equal(svc.staffSupport(nv, g.event_id, 'refuse', { note: 'không mua vé' }).result, 'refused'); assert.throws(() => svc.staffSupport(nv, g.event_id, 'refuse', {}), /không cần/);
  }],
  ['S26', 'Hỗ trợ cổng vào: thẻ khóa do báo mất thì nhân viên không được mở', 'GĐ2b', ({ svc, h }) => {
    const nv = U(svc, 'nhanvien'); const u = U(svc, 'sv2021001'); svc.reportLost(u, svc.myOverview(u).cards[0].id, '');
    const r = G(svc, 'in', '43A-12345'); assert.equal(r.result, 'invalid_card'); assert.throws(() => svc.staffSupport(nv, r.event_id, 'temp_pass', { note: 'thử' }), /khóa/);
  }],
  ['S27', 'Xe vào quá 3 phút chưa xác nhận đỗ: nhắc nhân viên ra chỉ dẫn (timer)', 'Trang 3', ({ svc, clock }) => {
    const nv = U(svc, 'nhanvien'); const r = G(svc, 'in', '43A-12345'); assert.equal(svc.staffQueue(nv).unparked[0].overdue, false);
    clock.advance(4 * 60000); assert.equal(svc.staffQueue(nv).unparked[0].overdue, true); svc.confirmParked(nv, r.session_id); assert.equal(svc.staffQueue(nv).unparked.length, 0); assert.throws(() => svc.confirmParked(nv, r.session_id));
  }],
  ['S28', 'Tra cứu của nhân viên theo biển số, mã thẻ, MSSV', 'NV', ({ svc }) => {
    const nv = U(svc, 'nhanvien'); assert.equal(svc.staffLookup(nv, '43A-12345')[0].username, 'sv2021001'); assert.equal(svc.staffLookup(nv, '2021001').length, 1); assert.throws(() => svc.staffLookup(nv, 'ab'));
  }],
  ['S29', 'Báo mất thẻ: khóa ngay, Quản lý cấp thẻ mới, chuyển cả vé tháng và lượt (G13)', 'Trang 7', ({ svc, h }) => {
    const u = U(svc, 'cb001'), ql = U(svc, 'quanly'); const old = svc.myOverview(u).cards[0]; const l = svc.reportLost(u, old.id, 'rơi ví'); assert.equal(l.card_locked, true);
    assert.equal(svc.decideLost(ql, l.id, true).status, 'reissued'); const cards = svc.myOverview(u).cards; assert.ok(cards[0].monthly_active); assert.equal(cards[1].valid_until, null);
  }],
  ['S30', 'Báo mất thẻ: Quản lý từ chối, kết thúc "từ chối" (G13)', 'Trang 7', ({ svc }) => {
    const u = U(svc, 'cb001'), ql = U(svc, 'quanly'); const l = svc.reportLost(u, svc.myOverview(u).cards[0].id, '');
    assert.equal(svc.decideLost(ql, l.id, false).status, 'rejected'); assert.throws(() => svc.decideLost(ql, l.id, true));
  }],
  ['S31', 'Phân quyền: mỗi vai trò chỉ thao tác trong phạm vi của mình', 'Bảo mật', ({ svc }) => {
    const sv = U(svc, 'sv2021001'), nv = U(svc, 'nhanvien'), ql = U(svc, 'quanly');
    assert.throws(() => svc.decideRegistration(sv, 1, true), /quyền/); assert.throws(() => svc.gate(sv, 'in', { plate: '43A-12345', confidence: 1 }), /quyền/);
    assert.throws(() => svc.managerQueue(nv), /quyền/); assert.throws(() => svc.listUsers(nv), /quyền/); assert.throws(() => svc.staffQueue(ql), /quyền/); assert.throws(() => svc.saveSettings(nv, { cap_G: 5 }), /quyền/);
  }],
  ['S32', 'Đăng nhập: sai mật khẩu 5 lần bị khóa tạm thời', 'Bảo mật', ({ svc }) => {
    for (let i = 0; i < 5; i++) assert.throws(() => svc.login('admin', 'sai', 'x'), /Sai/); assert.throws(() => svc.login('admin', 'Due@2026', 'x'), /quá nhiều/);
  }],
  ['S33', 'Đầu vào xấu: biển số, mật khẩu ngắn, loại vé lạ, độ tin cậy ngoài 0–1', 'Bảo mật', ({ svc }) => {
    assert.throws(() => svc.register(reg({ plate: 'abc' })), /Biển số/); assert.throws(() => svc.register(reg({ password: '123' })), /Mật khẩu/);
    assert.throws(() => svc.createTopup(U(svc, 'sv2021001'), 'vip', 'vietqr'), /không áp dụng/); assert.throws(() => G(svc, 'in', '43A-12345', 5), /0–1/);
  }],
  ['S34', 'Vé tháng hết hạn là hết quyền gửi dù từng còn lượt; mua vé 100 lượt thì chuyển sang theo lượt', 'Trang 3, 6', ({ svc, clock }) => {
    const u = U(svc, 'sv2021001'); svc.decideCash(U(svc, 'nhanvien'), svc.createTopup(u, 'thang', 'tien_mat').id, true);
    assert.equal(G(svc, 'in', '43A-12345').result, 'entered'); G(svc, 'out', '43A-12345');
    clock.advance(31 * 86400000); assert.equal(G(svc, 'in', '43A-12345').result, 'need_topup');
    svc.decideCash(U(svc, 'nhanvien'), svc.createTopup(u, 'luot100', 'tien_mat').id, true);
    const r = G(svc, 'in', '43A-12345'); assert.equal(r.result, 'entered'); assert.equal(r.monthly, false); assert.equal(r.passes_left, 111);
  }],
  ['S35', 'Còn vé tháng hiệu lực thì không bán thêm vé theo lượt', 'Trang 6', ({ svc }) => {
    assert.throws(() => svc.createTopup(U(svc, 'cb001'), 'luot100', 'vietqr'), /còn hiệu lực/);
  }],
  ['S36', 'Vé khách vãng lai giá 2.000đ mỗi lượt, mua qua VietQR', 'Trang 6', ({ svc, h }) => {
    const u = U(svc, 'khach01'); const t = svc.createTopup(u, 'khach', 'vietqr'); assert.equal(t.amount, 2000); svc.bankWebhook(t.ref, 2000);
    assert.equal(h.card('43K-11111').passes, 2);
  }],
];

function runAll(createContext) {
  createContext = createContext || require('./context').createContext;
  return SCENARIOS.map(([id, title, page, fn]) => {
    const ctx = createContext(':memory:'); const t0 = Date.now();
    try { fn(ctx); return { id, title, page, pass: true, ms: Date.now() - t0 }; }
    catch (e) { return { id, title, page, pass: false, error: e.message, ms: Date.now() - t0 }; }
  });
}
module.exports = { SCENARIOS, runAll };
