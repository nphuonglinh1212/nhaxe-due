'use strict';
(function () {
  var D = window.DUE, $ = D.$, esc = D.esc, app = $('#app'), cfg = null;
  var HOME = D.HOME;
  function money(n) { return n > 0 ? Number(n).toLocaleString('vi-VN') + ' đ' : 'chưa đặt giá'; }
  function renderLogin() {
    var demo = cfg && cfg.show_demo_accounts ? '<div class="card demo-acc"><h2>Tài khoản mẫu</h2><p class="muted">Mật khẩu chung: <b class="mono">Due@2026</b>. Bấm để điền sẵn.</p>' +
      [['admin', 'Quản trị / Giảng viên chấm'], ['quanly', 'Quản lý nhà xe'], ['nhanvien', 'Nhân viên nhà xe'], ['sv2021001', 'Sinh viên (vé 100 lượt, 12 lượt)'], ['cb001', 'Cán bộ (vé tháng, Khu D)'], ['khach01', 'Khách vãng lai']]
        .map(function (a) { return '<button type="button" data-u="' + a[0] + '"><b>' + a[0] + '</b> · ' + a[1] + '</button>'; }).join('') + '</div>' : '';
    app.innerHTML = '<div class="login"><form class="card" id="lf"><h1>Đăng nhập</h1><p class="muted">Mỗi vai trò sau khi đăng nhập được chuyển tới trang riêng của mình.</p><label for="u">Tên đăng nhập</label><input id="u" autocomplete="username"><label for="p">Mật khẩu</label><input id="p" type="password" autocomplete="current-password"><div class="err" id="le" role="alert"></div><div class="row"><button class="p" type="submit">Đăng nhập</button><button type="button" id="reg">Đăng ký thẻ mới</button></div></form>' + demo + '</div>';
    $('#reg').onclick = renderRegister;
    document.querySelectorAll('[data-u]').forEach(function (b) { b.onclick = function () { $('#u').value = b.dataset.u; $('#p').value = 'Due@2026'; $('#p').focus(); }; });
    $('#lf').onsubmit = function (e) { e.preventDefault(); $('#le').textContent = ''; D.api('/api/auth/login', 'POST', { username: $('#u').value, password: $('#p').value }).then(function (u) { location.href = HOME[u.role]; }).catch(function (er) { $('#le').textContent = er.message; }); };
  }
  function renderRegister() {
    var prod = {}; (cfg.products || []).forEach(function (p) { prod[p.key] = p; });
    app.innerHTML = '<div class="login"><form class="card" id="rf" novalidate><h1>Đăng ký thẻ gửi xe</h1>' +
      '<label for="r1">Họ và tên</label><input id="r1" autocomplete="name">' +
      '<label for="r2">Đối tượng</label><select id="r2"><option value="sv">Sinh viên</option><option value="cb">Cán bộ, giảng viên</option><option value="kh">Khách vãng lai</option></select>' +
      '<div id="codebox"><label for="r3" id="r3l">MSSV (mã số sinh viên)</label><input id="r3" autocomplete="off" inputmode="numeric"></div>' +
      '<label>Loại vé</label><div id="tk"></div>' +
      '<label for="rz">Khu giữ xe ưu tiên</label><select id="rz"><option value="G">Khu G</option><option value="D">Khu D</option></select>' +
      '<label for="r4">Biển số xe</label><input id="r4" placeholder="43A-12345" autocomplete="off">' +
      '<label for="r5">Email</label><input id="r5" type="email" autocomplete="email"><label for="r6">Số điện thoại</label><input id="r6" inputmode="tel">' +
      '<label for="r7">Tên đăng nhập</label><input id="r7" autocomplete="username"><label for="r8">Mật khẩu (tối thiểu 8 ký tự)</label><input id="r8" type="password" autocomplete="new-password">' +
      '<div class="err" id="re" role="alert"></div><div class="row"><button class="p" type="submit">Gửi đăng ký</button><button type="button" id="back">Đã có tài khoản</button></div>' +
      '<p class="muted" style="font-size:.85rem">Biển số và hình ảnh chỉ lưu có thời hạn (' + esc(cfg.retention_days) + ' ngày), theo Nghị định 13/2023/NĐ-CP. Thanh toán vé sau khi hồ sơ được duyệt.</p></form>' +
      '<div class="card" id="rres"><h2>Trạng thái hồ sơ</h2><p class="muted">Sinh viên và cán bộ có trong danh sách của trường được duyệt ngay. Khách vãng lai và trường hợp không khớp chờ Quản lý nhà xe duyệt.</p></div></div>';
    function tickets() {
      var t = $('#r2').value, keys = t === 'kh' ? ['khach'] : ['thang', 'luot100'];
      $('#tk').innerHTML = keys.map(function (k, i) { var p = prod[k] || { label: k, desc: '', price: 0 }; return '<label class="opt-card"><input type="radio" name="tk" value="' + k + '"' + (i === 0 ? ' checked' : '') + '> <b>' + esc(p.label) + '</b> · ' + money(p.price) + '<br><span class="muted">' + esc(p.desc) + '</span></label>'; }).join('');
      $('#codebox').style.display = t === 'kh' ? 'none' : ''; $('#r3l').textContent = t === 'sv' ? 'MSSV (mã số sinh viên)' : 'Mã cán bộ';
    }
    tickets(); $('#r2').onchange = tickets; $('#back').onclick = renderLogin;
    $('#rf').onsubmit = function (e) {
      e.preventDefault(); $('#re').textContent = '';
      D.api('/api/public/register', 'POST', { full_name: $('#r1').value, user_type: $('#r2').value, code: $('#r3').value, ticket_pref: (document.querySelector('input[name=tk]:checked') || {}).value, zone_pref: $('#rz').value, plate: $('#r4').value, email: $('#r5').value, phone: $('#r6').value, username: $('#r7').value, password: $('#r8').value })
        .then(function (r) {
          $('#rres').innerHTML = r.status === 'approved' ? '<h2>Đã duyệt tự động</h2><p class="ok">Thẻ của bạn: <b class="mono">' + esc(r.card) + '</b></p><p>Hãy đăng nhập, vào mục <b>Mua vé / Nạp lượt</b> để thanh toán vé.</p>' : '<h2>Đang chờ Quản lý duyệt</h2><p class="ok">Hồ sơ #' + esc(r.id) + ' đã gửi.</p><p>Bạn đăng nhập được sau khi Quản lý nhà xe duyệt.</p>';
        }).catch(function (er) { $('#re').textContent = er.message; });
    };
  }
  D.api('/api/public/config').then(function (c) { cfg = c; return D.api('/api/auth/me').then(function (u) { location.href = HOME[u.role]; }, function () { location.hash === '#register' ? renderRegister() : renderLogin(); }); }).catch(function () { app.innerHTML = '<p class="pad err">Không kết nối được máy chủ. Hãy chạy <span class="mono">npm start</span> hoặc mở file <span class="mono">Chay-Nha-Xe</span>.</p>'; });
})();
