'use strict';
(function (D) {
  var esc = D.esc, $ = D.$;
  function zones(z) { return z.map(function (x) { return '<div class="zone ' + x.zone + '"><b>' + x.zone + '</b><div class="meter"><i style="width:' + (x.capacity ? Math.min(100, x.used / x.capacity * 100) : 0) + '%"></i></div><span class="mono">' + x.used + '/' + x.capacity + '</span></div>'; }).join(''); }
  var SET = [['site_name', 'Tên hiển thị'], ['address', 'Địa chỉ'], ['phone', 'Số điện thoại'], ['email', 'Email'], ['open_hours', 'Giờ mở cửa'],
    ['price_thang', 'Giá vé tháng (đồng)'], ['days_thang', 'Số ngày hiệu lực của vé tháng'], ['price_luot100', 'Giá vé 100 lượt (đồng)'], ['passes_luot100', 'Số lượt của vé 100 lượt'], ['price_khach', 'Giá vé khách vãng lai (đồng)'], ['passes_khach', 'Số lượt mỗi vé khách'],
    ['cap_G', 'Sức chứa Khu G (chỗ)'], ['cap_D', 'Sức chứa Khu D (chỗ)'], ['guide_timeout_min', 'Phút nhắc nhân viên chỉ dẫn đỗ'],
    ['ai_threshold', 'Ngưỡng tin cậy AI (0.5–1)'], ['max_retries', 'Số lần thử tối đa'], ['qr_ttl_seconds', 'Thời hạn mã VietQR (giây)'],
    ['bank_bin', 'Mã ngân hàng VietQR (BIN hoặc tên, vd 970422)'], ['bank_account', 'Số tài khoản nhận tiền'], ['bank_holder', 'Tên chủ tài khoản'],
    ['retention_days', 'Số ngày lưu sự kiện cổng'], ['show_demo_accounts', 'Hiện tài khoản mẫu ở trang đăng nhập (1 hoặc 0)']];
  var views = {
    ov: function () {
      D.api('/api/admin/stats').then(function (s) {
        var k = [['Tài khoản', s.users], ['Thẻ hoạt động', s.cards], ['Xe trong bãi', s.in_lot + '/' + s.capacity], ['Lượt đã hoàn tất', s.sessions_done], ['Hồ sơ chờ duyệt', s.registrations_pending], ['Giao dịch thành công', s.topups_confirmed], ['Doanh thu ghi nhận', D.money(s.revenue).replace('chưa đặt giá', '0 đ')], ['Sự cố đang mở', s.incidents_open], ['Sự kiện cổng', s.gate_total], ['Lần rẽ nhánh XOR đã ghi', s.gateway_hits]];
        D.view('<div class="kpis">' + k.map(function (x) { return '<div class="kpi"><b>' + esc(x[1]) + '</b><small>' + x[0] + '</small></div>'; }).join('') + '</div><div class="grid"><div class="card"><h2>Hai khu giữ xe</h2>' + zones(s.zones) + '</div><div class="card"><h2>Mỗi vai trò một trang riêng</h2><div class="tw"><table><tr><th>Tài khoản</th><th>Trang</th></tr><tr><td class="mono">sv2021001, cb001, khach01</td><td>/nguoi-gui-xe.html</td></tr><tr><td class="mono">nhanvien</td><td>/nhan-vien.html</td></tr><tr><td class="mono">quanly</td><td>/quan-ly.html</td></tr><tr><td class="mono">admin</td><td>/quan-tri.html</td></tr></table></div><p class="muted">Mật khẩu mẫu: Due@2026. Mở mỗi vai trò ở một cửa sổ ẩn danh riêng để quay video.</p></div></div>');
      }).catch(D.fail);
    },
    guide: function () {
      D.view('<div class="card"><h2>Kịch bản demo video 10 phút</h2><ol><li><b>khach đăng ký</b> ở trang đăng nhập (vé khách) → <b>quanly</b> duyệt (G15, G01, G02).</li><li><b>sv2021001</b> mua vé tháng 50.000đ bằng VietQR; tab Dữ liệu test: "Ngân hàng xác nhận" (G10, G12).</li><li><b>nhanvien</b> → Cổng: cho xe vào Khu G (AND: barrier, LED, ảnh), quay lại tab Việc cần xử lý xem nhắc đỗ.</li><li>Cho xe ra với độ tin cậy thấp 3 lần → Xác minh thủ công; thử "không xác minh" để lập biên bản, <b>quanly</b> xử lý (G06–G09).</li><li>Xe hết lượt vào cổng → nhân viên thu tiền mặt, cho vào (G14).</li><li><b>cb001</b> báo mất thẻ → <b>quanly</b> duyệt cấp lại (G13).</li><li><b>admin</b> → Cổng XOR To-Be (đối chiếu số lần chạy) → Dữ liệu test → Chạy kịch bản.</li></ol></div>');
    },
    flows: function () {
      D.api('/api/admin/flows').then(function (f) {
        D.view('<div class="card"><h2>Đối chiếu cổng quyết định trong mô hình To-Be với phần mềm</h2><p class="muted">Số lần là số lần nhánh đó thực sự đã chạy trên dữ liệu hiện có, dùng làm bằng chứng trong báo cáo. ' + f.length + ' cổng đã cài đặt.</p><div class="tw"><table><tr><th>Cổng</th><th>Câu hỏi</th><th>Làn · Trang mô hình</th><th>Nhánh (số lần)</th><th>API</th></tr>' +
          f.map(function (g) { return '<tr class="flowrow"><td><span class="tag">' + g.id + '</span><br><span class="muted">' + esc(g.type) + '</span></td><td>' + esc(g.name) + '</td><td>' + esc(g.lane) + '<br><span class="muted">' + esc(g.page) + '</span></td><td>' + g.branches.map(function (b) { return '<div>' + esc(b.label) + ' <span class="tag ' + (b.count ? 'g' : 'o') + '">' + b.count + '</span></div>'; }).join('') + '</td><td class="mono" style="font-size:.78rem">' + esc(g.impl) + '</td></tr>'; }).join('') + '</table></div></div>');
      }).catch(D.fail);
    },
    users: function () {
      D.api('/api/admin/users').then(function (u) {
        D.view('<div class="grid"><div class="card"><h2>Tạo tài khoản</h2><label for="nu">Tên đăng nhập</label><input id="nu"><label for="nn">Họ tên</label><input id="nn"><label for="nr">Vai trò</label><select id="nr"><option value="NGX">Người gửi xe</option><option value="NV">Nhân viên</option><option value="QL">Quản lý nhà xe</option><option value="ADMIN">Quản trị / Giảng viên chấm</option></select>' +
          '<label for="nt">Đối tượng (người gửi xe)</label><select id="nt"><option value="sv">Sinh viên</option><option value="cb">Cán bộ</option><option value="kh">Khách vãng lai</option></select><label for="nc">MSSV / mã cán bộ</label><input id="nc"><label for="nplate">Biển số (người gửi xe)</label><input id="nplate"><label for="nz">Khu ưu tiên</label><select id="nz"><option>G</option><option>D</option></select><label for="npass">Số lượt ban đầu</label><input id="npass" type="number" min="0" value="10"><label for="nm">Số ngày vé tháng ban đầu (0 = không có)</label><input id="nm" type="number" min="0" value="0"><label for="npw">Mật khẩu (≥ 8 ký tự)</label><input id="npw" value="Due@2026"><div class="err" id="ue"></div><button class="p" id="ucr">Tạo</button></div>' +
          '<div class="card"><h2>Danh sách (' + u.length + ')</h2><div class="tw"><table><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th></th></tr>' + u.map(function (x) { return '<tr><td class="mono">' + esc(x.username) + '</td><td>' + esc(x.display_name) + '</td><td>' + esc(D.ROLE[x.role]) + '</td><td><button class="sm" data-u="' + x.id + '" data-v="' + (x.active ? 0 : 1) + '">' + (x.active ? 'Khóa' : 'Mở khóa') + '</button></td></tr>'; }).join('') + '</table></div></div></div>');
        $('#ucr').onclick = function () { D.api('/api/admin/users', 'POST', { username: $('#nu').value, display_name: $('#nn').value, role: $('#nr').value, user_type: $('#nt').value, code: $('#nc').value, plate: $('#nplate').value, zone_pref: $('#nz').value, passes: $('#npass').value, monthly_days: $('#nm').value, password: $('#npw').value }).then(function () { D.toast('Đã tạo'); views.users(); }).catch(function (e) { $('#ue').textContent = e.message; }); };
        D.on('[data-u]', 'data-u', function (b, id, v) { D.api('/api/admin/users/' + id + '/active', 'POST', { active: v === '1' }).then(function () { views.users(); }).catch(D.fail); });
      }).catch(D.fail);
    },
    set: function () {
      D.api('/api/admin/settings').then(function (s) {
        D.view('<div class="card"><h2>Thông số vận hành</h2><div class="grid">' + SET.map(function (f) { return '<div><label for="s_' + f[0] + '">' + f[1] + '</label><input id="s_' + f[0] + '" value="' + esc(s[f[0]]) + '"></div>'; }).join('') + '</div><div class="err" id="se"></div><button class="p" id="ssv" style="margin-top:.8rem">Lưu thông số</button><p class="muted" style="margin-top:1rem">Bí mật webhook ngân hàng (gửi trong header <span class="mono">X-Webhook-Secret</span>): <span class="mono">' + esc(s.webhook_secret) + '</span></p></div>');
        $('#ssv').onclick = function () { var b = {}; SET.forEach(function (f) { b[f[0]] = $('#s_' + f[0]).value; }); D.api('/api/admin/settings', 'PUT', b).then(function () { D.toast('Đã lưu'); }).catch(function (e) { $('#se').textContent = e.message; }); };
      }).catch(D.fail);
    },
    audit: function () {
      D.api('/api/admin/audit?limit=200').then(function (a) {
        D.view('<div class="card"><h2>Nhật ký hệ thống (200 dòng mới nhất)</h2><div class="tw"><table><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Chi tiết</th></tr>' + a.map(function (r) { return '<tr><td>' + D.fmtT(r.ts) + '</td><td>' + esc(r.actor) + ' <span class="muted">' + esc(r.role) + '</span></td><td class="mono">' + esc(r.action) + '</td><td>' + esc(r.detail) + '</td></tr>'; }).join('') + '</table></div></div>');
      }).catch(D.fail);
    },
    data: function () {
      D.api('/api/admin/open-topups').then(function (ot) {
        D.view('<div class="grid"><div class="card"><h2>Chạy kiểm thử tự động</h2><p class="muted">Chạy các kịch bản bám mô hình To-Be trên một CSDL tạm, không ảnh hưởng dữ liệu thật.</p><button class="p" id="st">Chạy kịch bản</button><div id="str"></div></div>' +
          '<div class="card"><h2>Giả lập ngân hàng (VietQR)</h2><p class="muted">Gọi webhook như ngân hàng thật để xác nhận giao dịch đang chờ.</p>' + (ot.map(function (t) { return '<div class="item"><span class="mono">' + esc(t.ref) + '</span> · ' + esc(t.product) + ' · ' + D.money(t.amount) + ' <button class="g sm" data-b="' + t.id + '">Ngân hàng xác nhận</button></div>'; }).join('') || '<p class="muted">Không có giao dịch VietQR đang chờ.</p>') + '</div>' +
          '<div class="card"><h2>Nhập dữ liệu test (JSON)</h2><p class="muted">Dạng: {"directory":[{"code","full_name","user_type":"sv|cb"}],"users":[{"username","display_name","role","user_type","plate","passes","monthly_days","zone_pref"}],"settings":{…}}. Mật khẩu mặc định Due@2026.</p><textarea id="imp" rows="8" class="mono" placeholder=\'{"directory":[{"code":"2023001","full_name":"Tên Sinh Viên","user_type":"sv"}]}\'></textarea><div class="err" id="ie"></div><button class="p" id="igo">Nhập</button></div>' +
          '<div class="card"><h2>Xuất / khôi phục</h2><div class="row"><button id="exp">Tải toàn bộ dữ liệu (JSON)</button><button class="d" id="rst">Khôi phục dữ liệu mẫu</button></div><p class="muted">Khôi phục sẽ xóa mọi dữ liệu hiện có và đăng xuất bạn.</p></div></div>');
        $('#st').onclick = function () { D.api('/api/admin/selftest', 'POST', {}).then(function (r) { var p = r.filter(function (x) { return x.pass; }).length; $('#str').innerHTML = '<p class="' + (p === r.length ? 'ok' : 'err') + '">' + p + '/' + r.length + ' kịch bản đạt</p><div class="tw"><table><tr><th>Mã</th><th>Kịch bản</th><th>Trang To-Be</th><th></th></tr>' + r.map(function (x) { return '<tr><td>' + x.id + '</td><td>' + esc(x.title) + (x.error ? '<br><span class="err">' + esc(x.error) + '</span>' : '') + '</td><td>' + esc(x.page) + '</td><td><span class="tag ' + (x.pass ? 'g' : 'r') + '">' + (x.pass ? 'ĐẠT' : 'LỖI') + '</span></td></tr>'; }).join('') + '</table></div>'; }).catch(D.fail); };
        D.on('[data-b]', 'data-b', function (b, id) { D.api('/api/admin/simulate-bank', 'POST', { topup_id: Number(id) }).then(function () { D.toast('Ngân hàng đã xác nhận'); views.data(); }).catch(D.fail); });
        $('#igo').onclick = function () { $('#ie').textContent = ''; var j; try { j = JSON.parse($('#imp').value); } catch (e) { $('#ie').textContent = 'JSON không hợp lệ'; return; } D.api('/api/admin/import', 'POST', j).then(function (r) { D.toast('Đã nhập: ' + r.directory + ' danh bạ, ' + r.users + ' tài khoản'); }).catch(function (e) { $('#ie').textContent = e.message; }); };
        $('#exp').onclick = function () { D.api('/api/admin/export').then(function (d) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = 'nhaxe-due-export.json'; a.click(); }).catch(D.fail); };
        $('#rst').onclick = function () { if (!confirm('Xóa toàn bộ dữ liệu và khôi phục dữ liệu mẫu?')) return; D.api('/api/admin/reset', 'POST', { confirm: 'RESET' }).then(function () { location.href = '/app.html'; }).catch(D.fail); };
      }).catch(D.fail);
    }
  };
  D.start({ role: 'ADMIN', tabs: [['ov', 'Tổng quan'], ['guide', 'Kịch bản demo'], ['flows', 'Cổng XOR To-Be'], ['users', 'Tài khoản'], ['set', 'Thông số'], ['audit', 'Nhật ký'], ['data', 'Dữ liệu test']], views: views });
})(window.DUE);
