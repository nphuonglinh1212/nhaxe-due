'use strict';
(function (D) {
  var esc = D.esc, $ = D.$;
  function ticketBadges(c) {
    var h = '';
    if (c.monthly_active) h += '<span class="tag g">Vé tháng · còn ' + c.days_left + ' ngày (đến ' + D.fmtD(c.valid_until) + ')</span> ';
    else if (c.valid_until) h += '<span class="tag r">Vé tháng đã hết hạn ' + D.fmtD(c.valid_until) + '</span> ';
    return h;
  }
  var views = {
    home: function () {
      D.api('/api/me/overview').then(function (o) {
        var c = o.cards.filter(function (x) { return x.status === 'active'; })[0] || o.cards[0];
        var inside = o.sessions.filter(function (s) { return s.status === 'in'; })[0];
        D.view(!c ? '<div class="card">Bạn chưa có thẻ.</div>' :
          '<div class="grid"><div class="card o"><span class="muted">Thẻ ' + (c.status === 'active' ? '<span class="tag g">đang hoạt động</span>' : '<span class="tag r">đã khóa</span>') + '</span>' +
          '<div class="mono" style="font-size:1.2rem;margin:.3rem 0">' + esc(c.card_code) + '</div>' +
          '<div>' + ticketBadges(c) + '</div>' +
          '<div class="big" style="margin-top:.5rem">' + c.passes + ' <small class="muted" style="font-size:1rem">lượt còn lại</small></div><div class="meter"><i style="width:' + Math.min(100, c.passes) + '%"></i></div>' +
          '<div>Biển số: <b class="mono">' + esc(c.plate) + '</b> · Khu ưu tiên: <b>Khu ' + esc(c.zone_pref) + '</b></div>' +
          '<div class="muted">' + (o.user_type === 'sv' ? 'MSSV' : o.user_type === 'cb' ? 'Mã cán bộ' : 'Khách vãng lai') + (o.code ? ': ' + esc(o.code) : '') + '</div>' +
          (!c.monthly_active && c.passes < 5 ? '<p class="err">Sắp hết lượt, hãy <a href="#buy">mua vé hoặc nạp thêm</a>.</p>' : '') + '</div>' +
          '<div class="card"><h2>Trạng thái hiện tại</h2>' + (inside ? '<p class="ok">Xe đang trong <b>Khu ' + esc(inside.zone) + '</b>, chỗ số ' + esc(inside.slot) + ', vào lúc ' + D.fmtT(inside.entry_at) + '.</p>' : '<p class="muted">Xe không ở trong bãi.</p>') +
          '<p class="muted">Vào ra không cần dừng quẹt thẻ: camera đọc biển số cùng thẻ QR/NFC của bạn.</p></div></div>');
      }).catch(D.fail);
    },
    buy: function () {
      D.api('/api/me/overview').then(function (o) {
        var open = o.topups.filter(function (t) { return ['awaiting_payment', 'expired', 'pending_cash'].indexOf(t.status) >= 0; })[0];
        var c = o.cards.filter(function (x) { return x.status === 'active'; })[0];
        var pref = c && c.ticket_pref;
        var items = o.products.map(function (p, i) {
          return '<label class="opt-card"><input type="radio" name="pk" value="' + p.key + '"' + ((pref ? p.key === pref : i === 0) ? ' checked' : '') + '> <b>' + esc(p.label) + '</b> · ' + D.money(p.price) + '<br><span class="muted">' + esc(p.desc) + '</span></label>';
        }).join('');
        D.view('<div class="grid"><div class="card"><h2>Mua vé / nạp lượt</h2><div>' + items + '</div><label for="mt">Phương thức thanh toán</label><select id="mt"><option value="vietqr">VietQR (ngân hàng xác nhận tự động)</option><option value="tien_mat">Tiền mặt tại nhà xe (nhân viên xác nhận)</option></select><div class="err" id="te"></div><button class="p" id="tgo"' + (open || !c ? ' disabled' : '') + '>Tạo yêu cầu</button>' + (open ? '<p class="muted">Bạn đang có một yêu cầu chưa hoàn tất.</p>' : '') + '</div><div class="card" id="tcur"><h2>Yêu cầu hiện tại</h2>' + (open ? '' : '<p class="muted">Chưa có.</p>') + '</div></div>');
        $('#tgo').onclick = function () {
          $('#te').textContent = '';
          D.api('/api/me/topups', 'POST', { product: document.querySelector('input[name=pk]:checked').value, method: $('#mt').value }).then(function () { views.buy(); }).catch(function (e) { $('#te').textContent = e.message; });
        };
        if (open) showTopup(open.id);
      }).catch(D.fail);
    },
    hist: function () {
      D.api('/api/me/overview').then(function (o) {
        D.view('<div class="card"><h2>Lượt gửi xe</h2><div class="tw"><table><tr><th>Vào</th><th>Ra</th><th>Biển số</th><th>Khu · chỗ</th><th>Trạng thái</th></tr>' + (o.sessions.map(function (s) { return '<tr><td>' + D.fmtT(s.entry_at) + '</td><td>' + D.fmtT(s.exit_at) + '</td><td class="mono">' + esc(s.plate) + '</td><td>' + esc(s.zone) + ' · ' + esc(s.slot) + '</td><td>' + esc({ 'in': 'đang gửi', out: 'đã ra', blocked: 'bị khóa phiên' }[s.status]) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="muted">Chưa có lượt nào.</td></tr>') + '</table></div></div>' +
          '<div class="card" style="margin-top:1rem"><h2>Giao dịch mua vé</h2><div class="tw"><table><tr><th>Thời gian</th><th>Loại vé</th><th>Số tiền</th><th>Cách thanh toán</th><th>Trạng thái</th></tr>' + (o.topups.map(function (t) { return '<tr><td>' + D.fmtT(t.created_at) + '</td><td>' + esc({ thang: 'Vé tháng', luot100: 'Vé 100 lượt', khach: 'Vé khách' }[t.product]) + '</td><td>' + D.money(t.amount) + '</td><td>' + (t.method === 'vietqr' ? 'VietQR' : 'Tiền mặt') + '</td><td>' + esc({ confirmed: 'đã xác nhận', pending_cash: 'chờ nhân viên', awaiting_payment: 'chờ thanh toán', expired: 'hết hạn mã', failed: 'thất bại', rejected: 'bị từ chối' }[t.status]) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="muted">Chưa có.</td></tr>') + '</table></div></div>');
      }).catch(D.fail);
    },
    lost: function () {
      D.api('/api/me/overview').then(function (o) {
        var act = o.cards.filter(function (c) { return c.status === 'active'; })[0];
        D.view('<div class="grid"><div class="card"><h2>Báo mất thẻ</h2><p class="muted">Thẻ bị khóa ngay khi bạn gửi báo cáo. Quản lý nhà xe duyệt cấp thẻ mới và chuyển cả vé tháng lẫn lượt còn lại.</p>' + (act ? '<p>Thẻ: <b class="mono">' + esc(act.card_code) + '</b></p><label for="ln">Ghi chú (không bắt buộc)</label><textarea id="ln" rows="2"></textarea><div class="row" style="margin-top:.6rem"><button class="d" id="lgo">Khóa thẻ và báo mất</button></div>' : '<p class="muted">Không có thẻ đang hoạt động.</p>') + '</div>' +
          '<div class="card"><h2>Các báo cáo của bạn</h2>' + (o.lost.map(function (l) { return '<div class="item">#' + l.id + ' · ' + D.fmtT(l.created_at) + ' · <b>' + esc({ pending: 'chờ Quản lý duyệt', reissued: 'đã cấp lại', rejected: 'từ chối' }[l.status]) + '</b></div>'; }).join('') || '<p class="muted">Chưa có.</p>') + '</div></div>');
        if (act) $('#lgo').onclick = function () { if (!confirm('Khóa thẻ ' + act.card_code + ' ngay bây giờ?')) return; D.api('/api/me/lost', 'POST', { card_id: act.id, note: $('#ln').value }).then(function () { D.toast('Đã khóa thẻ, chờ Quản lý duyệt cấp lại'); views.lost(); }).catch(D.fail); };
      }).catch(D.fail);
    }
  };
  function showTopup(id) {
    clearInterval(D.timer);
    function draw() {
      D.api('/api/me/topups/' + id).then(function (t) {
        var box = $('#tcur'); if (!box) return; var h = '<h2>' + esc(t.product_label) + ' · ' + D.money(t.amount) + '</h2>';
        if (t.status === 'pending_cash') h += '<p>Đến nhà xe đưa tiền mặt, nhân viên sẽ xác nhận và cộng quyền gửi xe cho thẻ của bạn.</p><span class="tag o">chờ nhân viên</span>';
        else if (t.status === 'awaiting_payment') {
          h += '<p>Nội dung chuyển khoản: <b class="mono">' + esc(t.ref) + '</b> · lần ' + t.attempts + '/' + D.cfg.max_retries + '</p>';
          h += t.qr_url ? '<img class="qrimg" alt="Mã VietQR" src="' + esc(t.qr_url) + '">' : '<p class="err">Nhà xe chưa cấu hình tài khoản ngân hàng nên chưa hiện được mã VietQR (Quản trị điền ở mục Thông số). Với demo, Quản trị dùng nút giả lập ngân hàng.</p>';
          h += '<div class="timer" id="cd">' + Math.floor(t.seconds_left / 60) + ':' + ('0' + t.seconds_left % 60).slice(-2) + '</div><p class="muted">Quyền gửi xe được cộng tự động khi ngân hàng xác nhận.</p>';
        } else if (t.status === 'expired') h += '<p class="err">Mã đã hết hạn (lần ' + t.attempts + '/' + D.cfg.max_retries + ').</p><button class="p" id="rt">Tạo lại mã</button>';
        else if (t.status === 'failed') h += '<p class="err">Đã hết số lần thử. Hãy thanh toán tiền mặt tại nhà xe.</p>';
        else if (t.status === 'confirmed') h += '<p class="ok">Đã xác nhận, thẻ của bạn đã được cập nhật.</p>';
        else h += '<span class="tag r">' + esc(t.status) + '</span>';
        box.innerHTML = h;
        if ($('#rt')) $('#rt').onclick = function () { D.api('/api/me/topups/' + id + '/retry', 'POST', {}).then(draw).catch(D.fail); };
        if (t.status === 'awaiting_payment') { var left = t.seconds_left; clearInterval(D.timer); D.timer = setInterval(function () { left--; if (left <= 0) { clearInterval(D.timer); draw(); return; } if ($('#cd')) $('#cd').textContent = Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2); if (left % 4 === 0) D.api('/api/me/topups/' + id).then(function (x) { if (x.status !== 'awaiting_payment') draw(); }); }, 1000); }
      }).catch(D.fail);
    }
    draw();
  }
  D.start({ role: 'NGX', tabs: [['home', 'Thẻ của tôi'], ['buy', 'Mua vé / Nạp lượt'], ['hist', 'Lịch sử'], ['lost', 'Báo mất thẻ']], views: views });
})(window.DUE);
