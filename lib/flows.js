'use strict';
// Các cổng quyết định (gateway) lấy từ mô hình BPMN To-Be, kèm trang mô hình và chức năng phần mềm tương ứng.
const GATEWAYS = [
  { id: 'G01', name: 'Người đăng ký có trong CSDL SV/CB DUE?', type: 'XOR', page: 'Trang 2 – Đăng ký', lane: 'Hệ thống',
    branches: { trong_csdl: 'Có: tự duyệt, cấp thẻ ảo', khach_vang_lai: 'Không / khách vãng lai: chuyển Quản lý' }, impl: 'POST /api/public/register' },
  { id: 'G02', name: 'Quản lý duyệt đăng ký?', type: 'XOR duyệt', page: 'Trang 2 – Đăng ký', lane: 'Quản lý',
    branches: { duyet: 'Duyệt: cấp thẻ ảo', tu_choi: 'Từ chối: thông báo kết quả' }, impl: 'POST /api/manager/registrations/:id' },
  { id: 'G03', name: 'Thẻ hợp lệ (đúng chủ, đúng biển số, không bị khóa)?', type: 'XOR', page: 'Trang 3, 5 – Vào/Ra bãi', lane: 'Hệ thống',
    branches: { hop_le: 'Hợp lệ: tiếp tục', khong_hop_le: 'Không hợp lệ: từ chối' }, impl: 'POST /api/gate/:direction' },
  { id: 'G04', name: 'Thẻ còn hiệu lực hoặc còn lượt?', type: 'XOR', page: 'Trang 3 – Vào bãi', lane: 'Hệ thống',
    branches: { con_luot: 'Còn quyền gửi (vé tháng hiệu lực hoặc còn lượt)', het_luot: 'Hết hạn / hết lượt: chuyển nạp hoặc nhân viên hỗ trợ' }, impl: 'POST /api/gate/in' },
  { id: 'G05', name: 'Khu G hoặc Khu D còn chỗ trống (cảm biến)?', type: 'XOR', page: 'Trang 3 – Vào bãi', lane: 'Hệ thống',
    branches: { con_cho: 'Còn chỗ: AND mở barrier + LED + chụp ảnh', het_cho: 'Hết chỗ: báo và chờ tín hiệu' }, impl: 'POST /api/gate/in' },
  { id: 'G06', name: 'Độ tin cậy AI đạt ngưỡng?', type: 'XOR', page: 'Trang 5 – Ra bãi', lane: 'Hệ thống',
    branches: { dat_nguong: 'Đạt ngưỡng: tự mở cổng', duoi_nguong: 'Dưới ngưỡng: ghi nhận lần thất bại' }, impl: 'POST /api/gate/:direction' },
  { id: 'G07', name: 'Đã thất bại đủ số lần tối đa?', type: 'XOR', page: 'Trang 5 – Ra bãi', lane: 'Hệ thống',
    branches: { chua_du: 'Chưa đủ: thử lại', du_lan: 'Đủ lần: nhân viên hỗ trợ tại chỗ' }, impl: 'POST /api/gate/:direction' },
  { id: 'G08', name: 'Nhân viên xác minh được danh tính?', type: 'XOR duyệt', page: 'Trang 4 – Xác minh thủ công', lane: 'Nhân viên',
    branches: { xac_minh_duoc: 'Được: cho qua cổng', khong_xac_minh_duoc: 'Không: leo thang Quản lý' }, impl: 'POST /api/staff/assist/:id' },
  { id: 'G09', name: 'Quản lý cho phép sau leo thang?', type: 'XOR duyệt', page: 'Trang 4 – Xác minh thủ công', lane: 'Quản lý',
    branches: { cho_phep: 'Cho phép: mở cổng', khoa_phien: 'Khóa phiên và báo an ninh' }, impl: 'POST /api/manager/escalations/:id' },
  { id: 'G10', name: 'Phương thức nạp lượt?', type: 'XOR', page: 'Trang 6 – Nạp lượt', lane: 'Người gửi xe',
    branches: { tien_mat: 'Tiền mặt: nhân viên xác nhận', vietqr: 'VietQR: ngân hàng xác nhận' }, impl: 'POST /api/me/topups' },
  { id: 'G11', name: 'Nhân viên xác nhận đã nhận tiền mặt?', type: 'XOR duyệt', page: 'Trang 6 – Nạp lượt', lane: 'Nhân viên',
    branches: { xac_nhan: 'Xác nhận: cộng lượt', tu_choi: 'Từ chối' }, impl: 'POST /api/staff/topups/:id' },
  { id: 'G12', name: 'Ngân hàng xác nhận VietQR trong hạn?', type: 'Event-based', page: 'Trang 6 – Nạp lượt', lane: 'Ngân hàng',
    branches: { xac_nhan: 'Xác nhận: cộng lượt', het_han_thu_lai: 'Hết hạn: cho thử lại', het_han_that_bai: 'Hết hạn và hết lần thử: thất bại' }, impl: 'POST /api/webhook/bank' },
  { id: 'G13', name: 'Quản lý duyệt cấp lại thẻ?', type: 'XOR duyệt', page: 'Trang 7 – Báo mất thẻ', lane: 'Quản lý',
    branches: { duyet: 'Duyệt: cấp thẻ mới, chuyển lượt', tu_choi: 'Từ chối: kết thúc' }, impl: 'POST /api/manager/lost/:id' },
];
GATEWAYS.splice(0, 0, { id: 'G15', name: 'Thông tin đăng ký hợp lệ (định dạng, không trùng biển số)?', type: 'XOR', page: 'Trang 2 – Đăng ký', lane: 'Hệ thống',
    branches: { hop_le: 'Hợp lệ: tiếp tục đối chiếu CSDL', khong_hop_le: 'Sai định dạng hoặc trùng biển số: yêu cầu sửa' }, impl: 'POST /api/public/register' });
GATEWAYS.push({ id: 'G14', name: 'Nhân viên giải quyết được sự cố ở cổng vào?', type: 'XOR duyệt', page: 'Trang 3 – GĐ2b Hỗ trợ cổng vào', lane: 'Nhân viên',
    branches: { giai_quyet_duoc: 'Được: thu tiền / cấp lượt tạm, cho vào', tu_choi_vao_bai: 'Không: từ chối vào bãi' }, impl: 'POST /api/staff/support/:id' });
GATEWAYS.sort((a, b) => a.id.localeCompare(b.id));
const PRODUCTS = {
  thang: { label: 'Vé tháng', desc: 'Không giới hạn lượt gửi trong thời gian thẻ còn hiệu lực', for: ['sv', 'cb'] },
  luot100: { label: 'Vé 100 lượt', desc: 'Gồm sẵn 100 lượt, hết lượt thì nạp thêm', for: ['sv', 'cb'] },
  khach: { label: 'Vé khách vãng lai', desc: 'Dành cho khách ngoài trường, 2.000 đ mỗi lượt, do Quản lý duyệt đăng ký', for: ['kh'] },
};
const ZONES = ['G', 'D'];
const DEFAULT_SETTINGS = {
  site_name: 'Nhà xe DUE',
  address: '71 Ngũ Hành Sơn, Đà Nẵng',
  // Thông tin liên hệ và ngân hàng dưới đây là DỮ LIỆU GIẢ để demo, cần thay bằng thông tin thật trước khi dùng.
  phone: '0900 000 000', email: 'nhaxe@due-demo.example', open_hours: '06:00 – 21:00, Thứ Hai đến Chủ nhật',
  price_thang: '50000', days_thang: '30',
  price_luot100: '100000', passes_luot100: '100',
  price_khach: '2000', passes_khach: '1',
  cap_G: '400', cap_D: '500', guide_timeout_min: '3',
  ai_threshold: '0.95',
  max_retries: '3',
  qr_ttl_seconds: '180',
  bank_bin: '970422', bank_account: '0000000000', bank_holder: 'NHA XE DUE DEMO',
  show_demo_accounts: '1',
  retention_days: '30',
};
module.exports = { GATEWAYS, DEFAULT_SETTINGS, PRODUCTS, ZONES };
