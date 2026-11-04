'use strict';
/* Phần dùng chung cho mọi trang: gọi API, kiểm tra vai trò, khung trang, tab. */
window.DUE = (function () {
  var ROLE = { NGX: 'Người gửi xe', NV: 'Nhân viên nhà xe', QL: 'Quản lý nhà xe', ADMIN: 'Quản trị / Giảng viên chấm' };
  var HOME = { NGX: 'nguoi-gui-xe.html', NV: 'nhan-vien.html', QL: 'quan-ly.html', ADMIN: 'quan-tri.html' };
  var D = { ROLE: ROLE, HOME: HOME, me: null, cfg: null, timer: null, poll: null };
  var $ = D.$ = function (s, r) { return (r || document).querySelector(s); };
  D.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  D.fmtT = function (ts) { if (!ts) return '–'; return new Date(ts).toLocaleString('vi-VN', { hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  D.fmtD = function (ts) { return ts ? new Date(ts).toLocaleDateString('vi-VN') : '–'; };
  D.money = function (n) { return n > 0 ? Number(n).toLocaleString('vi-VN') + ' đ' : 'chưa đặt giá'; };
  D.toast = function (m) { var t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(D.toast.t); D.toast.t = setTimeout(function () { t.classList.remove('show'); }, 3200); };
  D.api = function (path, method, body) {
    if (window.DUE_LOCAL_API) return window.DUE_LOCAL_API(path, method, body); // bản chạy hoàn toàn trong trình duyệt
    return fetch(path, { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || 'Lỗi'); e.status = r.status; e.code = j.error; throw e; } return j; }); });
  };
  D.fail = function (e) { if (e.status === 401) { location.href = 'app.html'; return; } D.toast(e.message); };
  D.stop = function () { clearInterval(D.timer); clearInterval(D.poll); D.timer = D.poll = null; };
  D.view = function (h) { $('#view').innerHTML = h; };
  D.auto = function (fn, ms) { clearInterval(D.poll); D.poll = setInterval(function () { var a = document.activeElement; if (!document.hidden && !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) fn(); }, ms || 6000); };
  D.on = function (sel, attr, fn) { document.querySelectorAll(sel).forEach(function (b) { b.onclick = function () { fn(b, b.getAttribute(attr), b.dataset.v); }; }); };
  /* opts: { role, tabs: [[key,label]], views: {key: fn} } */
  D.start = function (opts) {
    document.body.classList.add('r-' + opts.role);
    D.api('/api/auth/me').then(function (u) {
      if (u.role !== opts.role) { location.href = HOME[u.role]; return; }
      D.me = u; return D.api('/api/public/config').then(function (c) { D.cfg = c; shell(); });
    }).catch(function () { location.href = 'app.html'; });
    function shell() {
      $('#who').innerHTML = '<span class="role" style="border-color:currentColor">' + D.esc(ROLE[D.me.role]) + '</span><span>' + D.esc(D.me.display_name) + '</span><button class="sm" id="out">Đăng xuất</button>';
      $('#out').onclick = function () { D.api('/api/auth/logout', 'POST', {}).then(function () { location.href = 'app.html'; }); };
      window.addEventListener('hashchange', render); render();
    }
    function render() {
      D.stop(); var key = location.hash.slice(1); if (!opts.views[key]) key = opts.tabs[0][0];
      $('#tabs').innerHTML = opts.tabs.map(function (t) { return '<a class="tab" role="tab" href="#' + t[0] + '" aria-selected="' + (t[0] === key) + '">' + t[1] + '</a>'; }).join('');
      opts.views[key](D);
    }
    D.rerender = render;
  };
  return D;
})();
