'use strict';
// Bảng API dùng chung cho máy chủ Node và bản chạy trong trình duyệt.
// Mỗi handler nhận { params, body, user, token, query, ip, header(), setSession(), clearSession() }.
function defineRoutes(on, { svc, runAll, id, AppError }) {
  const adminOnly = (user) => { if (user.role !== 'ADMIN') throw new AppError(403, 'forbidden', 'Không đủ quyền'); };
  /* công khai */
  on('GET', '/api/public/config', () => svc.publicConfig(), { auth: false });
  on('POST', '/api/public/register', ({ body }) => svc.register(body), { auth: false });
  on('GET', '/api/public/registration/:u', ({ params }) => { const r = svc.registrationStatus(decodeURIComponent(params.u)); return { status: r.status, route: r.route, note: r.note }; }, { auth: false });
  on('POST', '/api/auth/login', ({ body, ip, setSession }) => { const r = svc.login(String(body.username || ''), String(body.password || ''), ip || '-'); setSession(r.token); return r.user; }, { auth: false });
  on('POST', '/api/auth/logout', ({ user, token, clearSession }) => { svc.logout(token, user); clearSession(); return { ok: true }; });
  on('GET', '/api/auth/me', ({ user }) => user);
  // webhook ngân hàng: xác thực bằng bí mật dùng chung, không dùng phiên đăng nhập
  on('POST', '/api/webhook/bank', ({ header, body }) => {
    if (!svc.checkSecret(header('x-webhook-secret'))) throw new AppError(401, 'bad_secret', 'Sai bí mật webhook');
    return svc.bankWebhook(body.ref, body.amount, 'bank');
  }, { auth: false });
  /* người gửi xe */
  on('GET', '/api/me/overview', ({ user }) => svc.myOverview(user));
  on('POST', '/api/me/topups', ({ user, body }) => svc.createTopup(user, body.product, body.method));
  on('GET', '/api/me/topups/:id', ({ user, params }) => svc.getTopup(user, id(params.id)));
  on('POST', '/api/me/topups/:id/retry', ({ user, params }) => svc.retryTopup(user, id(params.id)));
  on('POST', '/api/me/lost', ({ user, body }) => svc.reportLost(user, id(body.card_id), body.note));
  /* nhân viên */
  on('GET', '/api/staff/queue', ({ user }) => svc.staffQueue(user));
  on('POST', '/api/staff/topups/:id', ({ user, params, body }) => svc.decideCash(user, id(params.id), body.confirm === true));
  on('POST', '/api/staff/assist/:id', ({ user, params, body }) => svc.staffAssist(user, id(params.id), body.verified === true, body.note));
  on('POST', '/api/staff/support/:id', ({ user, params, body }) => svc.staffSupport(user, id(params.id), body.action, body));
  on('POST', '/api/staff/sell', ({ user, body }) => svc.staffSell(user, body.card_code, body.product));
  on('POST', '/api/staff/parked/:id', ({ user, params }) => svc.confirmParked(user, id(params.id)));
  on('POST', '/api/staff/incidents/:id/close', ({ user, params, body }) => svc.closeIncident(user, id(params.id), body.note));
  on('GET', '/api/staff/lookup', ({ user, query }) => svc.staffLookup(user, query.q));
  on('GET', '/api/staff/shift', ({ user }) => svc.shiftReport(user));
  on('POST', '/api/gate/:direction', ({ user, params, body }) => svc.gate(user, params.direction, body));
  /* quản lý */
  on('GET', '/api/manager/queue', ({ user }) => svc.managerQueue(user));
  on('POST', '/api/manager/registrations/:id', ({ user, params, body }) => svc.decideRegistration(user, id(params.id), body.approve === true, body.note));
  on('POST', '/api/manager/lost/:id', ({ user, params, body }) => svc.decideLost(user, id(params.id), body.approve === true));
  on('POST', '/api/manager/escalations/:id', ({ user, params, body }) => svc.decideEscalation(user, id(params.id), body.allow === true, body.note));
  /* quản trị / giảng viên chấm */
  on('GET', '/api/admin/stats', ({ user }) => svc.stats(user));
  on('GET', '/api/admin/flows', ({ user }) => svc.flows(user));
  on('GET', '/api/admin/audit', ({ user, query }) => svc.auditList(user, query.limit));
  on('GET', '/api/admin/users', ({ user }) => svc.listUsers(user));
  on('POST', '/api/admin/users', ({ user, body }) => svc.adminCreateUser(user, body));
  on('POST', '/api/admin/users/:id/active', ({ user, params, body }) => svc.setUserActive(user, id(params.id), body.active === true));
  on('GET', '/api/admin/settings', ({ user }) => { adminOnly(user); return { ...svc.allSettings(), webhook_secret: svc.webhookSecret() }; });
  on('PUT', '/api/admin/settings', ({ user, body }) => svc.saveSettings(user, body));
  on('POST', '/api/admin/import', ({ user, body }) => svc.importData(user, body));
  on('GET', '/api/admin/export', ({ user }) => svc.exportData(user));
  on('POST', '/api/admin/selftest', ({ user }) => { adminOnly(user); const r = runAll(); svc.audit(user, 'SELFTEST', `${r.filter(x => x.pass).length}/${r.length} đạt`); return r; });
  on('GET', '/api/admin/open-topups', ({ user }) => svc.openTopups(user));
  on('POST', '/api/admin/simulate-bank', ({ user, body }) => svc.simulateBank(user, id(body.topup_id)));
  on('POST', '/api/admin/reset', ({ user, body }) => svc.resetAll(user, body.confirm));
}
module.exports = { defineRoutes };
