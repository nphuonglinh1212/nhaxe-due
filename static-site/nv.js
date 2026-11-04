'use strict';
(function (D) {
  var esc = D.esc, $ = D.$, gateLog = [];
  var PRODUCT = { thang: 'Vé tháng', luot100: 'Vé 100 lượt', khach: 'Vé khách' };
  function zones(z) { return z.map(function (x) { return '<div class="zone ' + x.zone + '"><b>' + x.zone + '</b><div class="meter"><i style="width:' + (x.capacity ? Math.min(100, x.used / x.capacity * 100) : 0) + '%"></i></div><span class="mono">' + x.used + '/' + x.capacity + '</span></div>'; }).join(''); }
  function empty() { return '<p class="muted">Không có việc nào.</p>'; }
  function productOptions(sel) { return '<select ' + sel + '><option value="thang">Vé tháng</option><option value="luot100">Vé 100 lượt</option><option value="khach">Vé khách</option></select>'; }
  var views = {
    todo: function () {
      function draw() {
        D.api('/api/staff/queue').then(function (d) {
          var n = d.cash.length + d.assist.length + d.refusals.length + d.unparked.filter(function (u) { return u.overdue; }).length + d.held.length;
          D.view('<p class="muted">Việc cần xử lý: <b>' + n + '</b>. Màn hình tự làm mới mỗi 6 giây.</p><div class="grid">' +
            /* GĐ2b: hỗ trợ cổng vào */
            '<div class="card"><h2>Hỗ trợ tại cổng vào (G14)</h2><p class="muted">Xe bị từ chối do hết lượt, vé hết hạn hoặc thẻ lỗi. Xác định nguyên nhân, đối chiếu CCCD/thẻ SV rồi xử lý.</p>' + (d.refusals.map(function (g) {
              var locked = g.card_status && g.card_status !== 'active', nocard = !g.card_code;
              return '<div class="item"><b class="mono">' + esc(g.plate) + '</b> · thẻ ' + esc(g.card_code || 'không rõ') + ' · ' + D.fmtT(g.updated_at) + '<br><span class="muted">Nguyên nhân: ' + esc(nocard ? 'không tìm thấy thẻ cho biển số' : locked ? 'thẻ bị khóa (báo mất)' : g.outcome === 'need_topup' ? (g.valid_until ? 'vé tháng hết hạn, hết lượt' : 'hết lượt') : 'thẻ không hợp lệ') + '</span>' +
                (nocard || locked ? '' : '<div class="row" style="margin-top:.4rem">' + productOptions('id="sp' + g.id + '" style="width:auto;min-height:36px"') + '<button class="g sm" data-s="' + g.id + '" data-v="sell">Thu tiền mặt, cho vào</button><button class="sm" data-s="' + g.id + '" data-v="temp">Cấp 1 lượt tạm</button></div>') +
                '<div class="row" style="margin-top:.4rem"><button class="d sm" data-s="' + g.id + '" data-v="refuse">Từ chối vào bãi</button></div></div>';
            }).join('') || empty()) + '</div>' +
            /* tiền mặt chờ xác nhận */
            '<div class="card"><h2>Thu tiền mặt chờ xác nhận (G11)</h2>' + (d.cash.map(function (t) { return '<div class="item"><b>' + esc(t.display_name) + '</b> (' + esc(t.username) + ')<br>' + esc(t.product_label) + ' · <b>' + D.money(t.amount) + '</b><div class="row" style="margin-top:.4rem"><button class="g sm" data-c="' + t.id + '" data-v="1">Đã thu tiền</button><button class="d sm" data-c="' + t.id + '" data-v="0">Không thu được</button></div></div>'; }).join('') || empty()) + '</div>' +
            /* xác minh thủ công cổng ra */
            '<div class="card"><h2>Xác minh thủ công (G08)</h2><p class="muted">Camera thất bại đủ lần. Đối chiếu ảnh với hồ sơ, CCCD hoặc thẻ SV.</p>' + (d.assist.map(function (g) { return '<div class="item"><b class="mono">' + esc(g.plate) + '</b> · cổng ' + (g.direction === 'in' ? 'vào' : 'ra') + ' · ' + g.attempts + ' lần thất bại · thẻ ' + esc(g.card_code || 'không rõ') + '<input id="an' + g.id + '" placeholder="Ghi chú đối chiếu (CCCD, thẻ SV…)" style="margin-top:.4rem"><div class="row" style="margin-top:.4rem"><button class="g sm" data-a="' + g.id + '" data-v="1">Xác minh được, cho qua</button><button class="d sm" data-a="' + g.id + '" data-v="0">Không xác minh được, lập biên bản</button></div></div>'; }).join('') || empty()) + '</div>' +
            /* timer 3 phút */
            '<div class="card"><h2>Xe vào chưa xác nhận đỗ</h2><p class="muted">Sau ' + D.cfg.guide_timeout_min + ' phút chưa có tín hiệu cảm biến, hệ thống nhắc nhân viên ra chỉ dẫn trực tiếp.</p>' + (d.unparked.map(function (u) { return '<div class="item' + (u.overdue ? ' warnbox' : '') + '"><b class="mono">' + esc(u.plate) + '</b> · Khu ' + esc(u.zone) + ' chỗ ' + esc(u.slot) + ' · vào ' + D.fmtT(u.entry_at) + (u.overdue ? '<br><b>Quá hạn, ra chỉ dẫn xe đỗ</b>' : '') + '<div class="row" style="margin-top:.4rem"><button class="g sm" data-p="' + u.id + '">Đã đỗ đúng chỗ</button></div></div>'; }).join('') || empty()) + '</div>' +
            /* giữ xe */
            '<div class="card"><h2>Giữ xe, bảo vệ xử lý</h2><p class="muted">Quản lý đã khóa phiên. Ghi lại kết quả xử lý để đóng sự cố.</p>' + (d.held.map(function (i) { return '<div class="item"><span class="tag r">giữ xe</span> <b class="mono">' + esc(i.plate) + '</b><br><span class="muted">' + esc(i.note || '') + '</span><input id="in' + i.id + '" placeholder="Kết quả xử lý" style="margin-top:.4rem"><div class="row" style="margin-top:.4rem"><button class="g sm" data-i="' + i.id + '">Đóng sự cố</button></div></div>'; }).join('') || empty()) + '</div>' +
            '<div class="card"><h2>Biên bản đã lập, chờ Quản lý</h2>' + (d.reported.map(function (i) { return '<div class="item"><span class="tag o">chờ Quản lý</span> <b class="mono">' + esc(i.plate) + '</b><br><span class="muted">' + esc(i.note || '') + '</span></div>'; }).join('') || empty()) + '</div></div>');
          D.on('[data-s]', 'data-s', function (b, id, v) {
            var body = v === 'sell' ? { action: 'sell_cash', product: $('#sp' + id).value } : v === 'temp' ? { action: 'temp_pass', note: prompt('Lý do cấp 1 lượt tạm (bắt buộc):') || '' } : { action: 'refuse', note: prompt('Lý do từ chối vào bãi:') || '' };
            if (v === 'temp' && body.note.length < 3) return;
            D.api('/api/staff/support/' + id, 'POST', body).then(function (r) { D.toast(r.result === 'entered' ? 'Đã cho xe vào Khu ' + r.zone + ' chỗ ' + r.slot : r.result === 'refused' ? 'Đã từ chối vào bãi' : (r.message || 'Đã xử lý')); draw(); }).catch(D.fail);
          });
          D.on('[data-c]', 'data-c', function (b, id, v) { D.api('/api/staff/topups/' + id, 'POST', { confirm: v === '1' }).then(function () { D.toast('Đã xử lý'); draw(); }).catch(D.fail); });
          D.on('[data-a]', 'data-a', function (b, id, v) { D.api('/api/staff/assist/' + id, 'POST', { verified: v === '1', note: $('#an' + id).value }).then(function (r) { D.toast(r.result === 'exited' || r.result === 'entered' ? 'Đã cho xe qua cổng, đã ghi nhật ký xác minh' : r.status === 'escalated' ? 'Đã lập biên bản và báo Quản lý' : (r.message || 'Đã xử lý')); draw(); }).catch(D.fail); });
          D.on('[data-p]', 'data-p', function (b, id) { D.api('/api/staff/parked/' + id, 'POST', {}).then(function () { D.toast('Đã xác nhận đỗ'); draw(); }).catch(D.fail); });
          D.on('[data-i]', 'data-i', function (b, id) { D.api('/api/staff/incidents/' + id + '/close', 'POST', { note: $('#in' + id).value }).then(function () { D.toast('Đã đóng sự cố'); draw(); }).catch(D.fail); });
        }).catch(D.fail);
      }
      draw(); D.auto(draw);
    },
    gate: function () {
      D.view('<div class="grid"><div class="card"><span class="flag">Camera AI, NFC/QR được mô phỏng bằng form</span><h2 style="margin-top:.5rem">Sự kiện tại cổng</h2>' +
        '<label for="gd">Cổng</label><select id="gd"><option value="in">Cổng vào</option><option value="out">Cổng ra</option></select>' +
        '<label for="gp">Biển số đọc được</label><input id="gp" placeholder="43A-12345" autocomplete="off"><label for="gc">Mã thẻ / QR (không bắt buộc)</label><input id="gc" placeholder="DUE-100001" autocomplete="off">' +
        '<label for="gz">Khu (để trống: hệ thống tự chọn theo khu đăng ký)</label><select id="gz"><option value="">Tự động</option><option value="G">Khu G</option><option value="D">Khu D</option></select>' +
        '<label for="gf">Độ tin cậy: <b class="mono" id="gv">0,98</b> (ngưỡng ' + String(D.cfg.ai_threshold).replace('.', ',') + ')</label><input id="gf" type="range" min="0" max="100" value="98" style="padding:0">' +
        '<div class="err" id="ge"></div><button class="p" id="gg">Gửi sự kiện camera</button></div><div class="card"><h2>Kết quả</h2><ul class="log" id="glog" aria-live="polite"></ul></div></div>');
      $('#gf').oninput = function () { $('#gv').textContent = (this.value / 100).toFixed(2).replace('.', ','); };
      function paint() { $('#glog').innerHTML = gateLog.slice(-8).reverse().map(function (l) { return '<li class="' + l.c + '">' + esc(l.t) + '</li>'; }).join('') || '<li class="muted">Chưa có sự kiện.</li>'; }
      paint();
      $('#gg').onclick = function () {
        $('#ge').textContent = ''; var dir = $('#gd').value, plate = $('#gp').value;
        D.api('/api/gate/' + dir, 'POST', { plate: plate, credential: $('#gc').value || undefined, zone: $('#gz').value || undefined, confidence: $('#gf').value / 100 }).then(function (r) {
          var ok = r.result === 'entered' || r.result === 'exited', warn = r.result === 'retry' || r.result === 'assist_required';
          var t = r.result === 'entered' ? 'Cho vào Khu ' + r.zone + ', chỗ ' + r.slot + (r.monthly ? ' (vé tháng, không trừ lượt)' : ', còn ' + r.passes_left + ' lượt') + '. Barrier mở, LED chỉ chỗ, chụp ảnh (AND).' : r.result === 'exited' ? 'Cho ra khỏi Khu ' + r.zone + ' sau ' + r.minutes + ' phút. Ghi nhật ký, cập nhật chỗ, báo chủ xe, giải phóng chỗ (AND).' : (r.message || r.result) + (r.result === 'need_topup' || r.result === 'invalid_card' ? ' → xử lý ở tab "Việc cần làm".' : '');
          gateLog.push({ t: plate + ': ' + t, c: ok ? 'ok' : warn ? 'warn' : 'bad' }); paint();
        }).catch(function (e) { $('#ge').textContent = e.message; });
      };
    },
    lot: function () {
      function draw() {
        D.api('/api/staff/queue').then(function (d) {
          D.view('<div class="grid"><div class="card"><h2>Bãi xe: ' + d.occupancy.used + '/' + d.occupancy.capacity + '</h2>' + zones(d.zones) + '<p class="muted">Hết chỗ cả hai khu thì LED đỏ và gợi ý bãi khác.</p></div>' +
            '<div class="card" style="grid-column:1/-1"><h2>Xe đang trong bãi</h2><div class="tw"><table><tr><th>Biển số</th><th>Thẻ</th><th>Khu · chỗ</th><th>Vào lúc</th><th>Đỗ</th></tr>' + (d.inside.map(function (s) { return '<tr><td class="mono">' + esc(s.plate) + '</td><td class="mono">' + esc(s.card_code) + '</td><td>' + esc(s.zone) + ' · ' + esc(s.slot) + '</td><td>' + D.fmtT(s.entry_at) + '</td><td>' + (s.parked_at ? '<span class="tag g">đã xác nhận</span>' : '<button class="sm" data-p="' + s.id + '">Xác nhận đỗ</button>') + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="muted">Bãi trống.</td></tr>') + '</table></div></div></div>');
          D.on('[data-p]', 'data-p', function (b, id) { D.api('/api/staff/parked/' + id, 'POST', {}).then(function () { draw(); }).catch(D.fail); });
        }).catch(D.fail);
      }
      draw(); D.auto(draw);
    },
    counter: function () {
      D.view('<div class="grid"><div class="card"><h2>Tra cứu thẻ</h2><label for="lq">Biển số, mã thẻ, MSSV hoặc tên đăng nhập</label><input id="lq" autocomplete="off"><div class="err" id="le"></div><button class="p" id="lgo">Tra cứu</button><div id="lres"></div></div>' +
        '<div class="card"><h2>Bán vé tại quầy</h2><p class="muted">Thu tiền mặt rồi xác nhận ngay. Vé tháng gia hạn 30 ngày, vé 100 lượt cộng 100 lượt.</p><label for="sc">Mã thẻ</label><input id="sc" placeholder="DUE-100001" autocomplete="off"><label for="spd">Loại vé</label>' + productOptions('id="spd"') + '<div class="err" id="se"></div><button class="g" id="sgo" style="margin-top:.6rem">Đã thu tiền, cộng vào thẻ</button></div></div>');
      $('#lgo').onclick = function () {
        $('#le').textContent = '';
        D.api('/api/staff/lookup?q=' + encodeURIComponent($('#lq').value)).then(function (r) {
          $('#lres').innerHTML = r.map(function (c) { return '<div class="item"><b class="mono">' + esc(c.card_code) + '</b> · ' + esc(c.plate) + ' · ' + esc(c.display_name) + ' (' + esc(c.username) + (c.code ? ', ' + esc(c.code) : '') + ')<br>' + (c.status === 'active' ? '<span class="tag g">hoạt động</span>' : '<span class="tag r">khóa</span>') + ' ' + (c.monthly_active ? '<span class="tag g">vé tháng còn ' + c.days_left + ' ngày</span> ' : '') + '<span class="tag">' + c.passes + ' lượt</span> <span class="tag">khu ' + esc(c.zone_pref) + '</span>' + (c.session ? '<br>Trong bãi: Khu ' + esc(c.session.zone) + ' chỗ ' + esc(c.session.slot) + ' (' + esc(c.session.status === 'blocked' ? 'bị khóa phiên' : 'đang gửi') + ')' : '') + (c.lost ? '<br>Báo mất thẻ: ' + esc(c.lost.status) : '') + '<br><span class="muted">' + c.events.map(function (e) { return (e.direction === 'in' ? 'vào' : 'ra') + ' ' + esc(e.outcome || e.status) + ' ' + D.fmtT(e.created_at); }).join(' · ') + '</span></div>'; }).join('') || '<p class="muted">Không tìm thấy.</p>';
        }).catch(function (e) { $('#le').textContent = e.message; });
      };
      $('#sgo').onclick = function () {
        $('#se').textContent = '';
        D.api('/api/staff/sell', 'POST', { card_code: $('#sc').value, product: $('#spd').value }).then(function (r) { D.toast('Đã thu ' + D.money(r.amount) + ' và cập nhật thẻ'); }).catch(function (e) { $('#se').textContent = e.message; });
      };
    },
    shift: function () {
      D.api('/api/staff/shift').then(function (s) {
        var k = [['Xe vào hôm nay', s.entered], ['Xe ra hôm nay', s.exited], ['Số ca bạn hỗ trợ', s.assisted], ['Số ca bạn từ chối', s.refused], ['Số lần thu tiền mặt', s.cash_count], ['Tiền mặt đã thu', D.money(s.cash_total).replace('chưa đặt giá', '0 đ')], ['Sự cố đang mở', s.open_incidents]];
        D.view('<div class="kpis">' + k.map(function (x) { return '<div class="kpi"><b>' + esc(x[1]) + '</b><small>' + x[0] + '</small></div>'; }).join('') + '</div><p class="muted">Số liệu tính từ 0 giờ hôm nay. Dùng để đối soát tiền mặt cuối ca.</p>');
      }).catch(D.fail);
    }
  };
  D.start({ role: 'NV', tabs: [['todo', 'Việc cần xử lý'], ['gate', 'Cổng & camera (mô phỏng)'], ['lot', 'Bãi xe Khu G/D'], ['counter', 'Quầy: tra cứu & bán vé'], ['shift', 'Ca trực']], views: views });
})(window.DUE);
