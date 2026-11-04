'use strict';
const U = require('./util');
const { DEFAULT_SETTINGS } = require('./flows');
const DEMO_PASSWORD = 'Due@2026';

const DIRECTORY = [
  ['2021001', 'Nguyễn Văn An', 'sv'], ['2021002', 'Trần Thị Bình', 'sv'], ['2021003', 'Lê Minh Châu', 'sv'],
  ['2022001', 'Phạm Quốc Dũng', 'sv'], ['2022002', 'Hoàng Thị Em', 'sv'],
  ['CB001', 'Võ Thanh Giang', 'cb'], ['CB002', 'Đặng Hữu Hải', 'cb'],
];
// Tài khoản mẫu (dùng chung cho bản máy chủ và bản trình duyệt)
const DEMO_USERS = [
  { username: 'admin', display_name: 'Giảng viên chấm / Quản trị', role: 'ADMIN' },
  { username: 'quanly', display_name: 'Quản lý nhà xe (mẫu)', role: 'QL' },
  { username: 'nhanvien', display_name: 'Nhân viên nhà xe (mẫu)', role: 'NV' },
  { username: 'sv2021001', display_name: 'Nguyễn Văn An', role: 'NGX', code: '2021001', user_type: 'sv', plate: '43A-12345', passes: 12, zone_pref: 'G', ticket_pref: 'luot100' },
  { username: 'cb001', display_name: 'Võ Thanh Giang', role: 'NGX', code: 'CB001', user_type: 'cb', plate: '43B1-123.45', passes: 0, monthly_days: 20, zone_pref: 'D', ticket_pref: 'thang' },
  { username: 'khach01', display_name: 'Khách mẫu', role: 'NGX', user_type: 'kh', plate: '43K-11111', passes: 1, zone_pref: 'G', ticket_pref: 'khach' },
];
function seed(q, svc) {
  q.tx(() => {
    for (const [code, name, t] of DIRECTORY) q.run('INSERT OR REPLACE INTO directory(code,full_name,user_type) VALUES(?,?,?)', code, name, t);
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) q.run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', k, v);
    const { salt, hash } = U.hashPassword(DEMO_PASSWORD);
    for (const u of DEMO_USERS) { const { monthly_days, ...rest } = u; svc.createUserAndCard({ pass_hash: hash, salt, ...rest, valid_until: monthly_days ? svc.now() + monthly_days * 86400000 : null }); }
    q.run('INSERT INTO audit(ts,actor,role,action,detail) VALUES(?,?,?,?,?)', svc.now(), 'HT', 'HT', 'SEED', 'Khởi tạo dữ liệu mẫu');
  });
}
module.exports = { seed, DEMO_PASSWORD, DIRECTORY, DEMO_USERS };
