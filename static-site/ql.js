'use strict';
(function (D) {
  var esc = D.esc;
  var TYPE = { sv: 'Sinh viên', cb: 'Cán bộ', kh: 'Khách vãng lai' }, PREF = { thang: 'Vé tháng', luot100: 'Vé 100 lượt', khach: 'Vé khách' };
  function zones(z) { return z.map(function (x) { return '<div class="zone ' + x.zone + '"><b>' + x.zone + '</b><div class="meter"><i style="width:' + (x.capacity ? Math.min(100, x.used / x.capacity * 100) : 0) + '%"></i></div><span class="mono">' + x.used + '/' + x.capacity + '</span></div>'; }).join(''); }
  var views = {
    mq: function () {
      function draw() {
        D.api('/api/manager/queue').then(function (d) {
          D.view('<div class="grid"><div class="card"><h2>Đăng ký chờ duyệt (G02)</h2>' + (d.registrations.map(function (r) { return '<div class="item"><b>' + esc(r.full_name) + '</b> · ' + TYPE[r.user_type] + (r.code ? ' · ' + (r.user_type === 'sv' ? 'MSSV ' : 'mã ') + esc(r.code) : '') + '<br><span class="muted">' + esc(PREF[r.ticket_pref] || '') + ' · Khu ' + esc(r.zone_pref) + ' · biển số <span class="mono">' + esc(r.plate) + '</span> · ' + esc(r.email || r.phone || '') + ' · ' + D.fmtT(r.created_at) + '</span><div class="row" style="margin-top:.4rem"><button class="g sm" data-r="' + r.id + '" data-v="1">Duyệt, cấp thẻ</button><button class="d sm" data-r="' + r.id + '" data-v="0">Từ chối</button></div></div>'; }).join('') || '<p class="muted">Không có.</p>') + '</div>' +
            '<div class="card"><h2>Cấp lại thẻ mất (G13)</h2>' + (d.lost.map(function (l) { return '<div class="item"><b>' + esc(l.display_name) + '</b> · thẻ <span class="mono">' + esc(l.card_code) + '</span> · ' + esc(l.plate) + '<br><span class="muted">' + esc(l.note || 'không ghi chú') + ' · ' + D.fmtT(l.created_at) + '</span><div class="row" style="margin-top:.4rem"><button class="g sm" data-l="' + l.id + '" data-v="1">Duyệt cấp lại</button><button class="d sm" data-l="' + l.id + '" data-v="0">Từ chối</button></div></div>'; }).join('') || '<p class="muted">Không có.</p>') + '</div>' +
            '<div class="card"><h2>Leo thang từ cổng (G09)</h2>' + (d.escalations.map(function (g) { return '<div class="item"><b class="mono">' + esc(g.plate) + '</b> · ' + (g.direction === 'in' ? 'vào' : 'ra') + ' · thẻ ' + esc(g.card_code || 'không rõ') + '<br><span class="muted">Biên bản của ' + esc(g.assisted_by) + ': ' + esc(g.incident_note || g.note || 'không xác minh được danh tính') + '</span><div class="row" style="margin-top:.4rem"><button class="g sm" data-e="' + g.id + '" data-v="1">Cho phép (ghi ngoại lệ)</button><button class="d sm" data-e="' + g.id + '" data-v="0">Khóa phiên, báo an ninh</button></div></div>'; }).join('') || '<p class="muted">Không có.</p>') + '</div></div>');
          function bind(attr, url, key) { D.on('[' + attr + ']', attr, function (b, id, v) { var body = {}; body[key] = v === '1'; D.api(url + id, 'POST', body).then(function () { D.toast('Đã xử lý'); draw(); }).catch(D.fail); }); }
          bind('data-r', '/api/manager/registrations/', 'approve'); bind('data-l', '/api/manager/lost/', 'approve'); bind('data-e', '/api/manager/escalations/', 'allow');
        }).catch(D.fail);
      }
      draw(); D.auto(draw);
    },
    area: function () {
      D.api('/api/manager/queue').then(function (d) {
        D.view('<div class="grid"><div class="card"><h2>Mức đầy hai khu</h2>' + zones(d.zones) + '</div><div class="card"><h2>Sự cố gần đây</h2>' + (d.incidents.map(function (i) { return '<div class="item"><span class="tag ' + (i.status === 'closed' ? 'g' : i.status === 'held' ? 'r' : 'o') + '">' + esc({ reported: 'đã lập biên bản', held: 'giữ xe, bảo vệ xử lý', closed: 'đã đóng' }[i.status]) + '</span> <b class="mono">' + esc(i.plate || '') + '</b><br><span class="muted">' + esc(i.note || '') + ' · ' + D.fmtT(i.created_at) + '</span></div>'; }).join('') || '<p class="muted">Chưa có.</p>') + '</div></div>');
      }).catch(D.fail);
    }
  };
  D.start({ role: 'QL', tabs: [['mq', 'Hàng đợi duyệt'], ['area', 'Bãi xe & sự cố']], views: views });
})(window.DUE);
