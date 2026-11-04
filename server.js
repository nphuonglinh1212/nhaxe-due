'use strict';
const path = require('path');
const fs = require('fs');
const { createApp } = require('./lib/app');
const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const port = Number(process.env.PORT) || 3000;
const { server, ctx } = createApp(process.env.DB_FILE || path.join(dir, 'nhaxe.db'));
// dọn dữ liệu sự kiện cổng cũ theo thời hạn lưu (Nghị định 13/2023)
const purged = ctx.svc.purgeOld(Number(ctx.svc.setting('retention_days')));
server.listen(port, () => {
  console.log(`Nhà xe DUE chạy tại http://localhost:${port}  (dọn ${purged} sự kiện cổng quá hạn)`);
  console.log('Trang chủ: /   Ứng dụng: /app.html   Tài khoản mẫu: admin, quanly, nhanvien, sv2021001, cb001 — mật khẩu Due@2026');
});
