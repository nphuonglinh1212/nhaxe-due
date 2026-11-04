# Nhà xe DUE – phần mềm web bám theo mô hình BPMN To-Be

Học phần MIS3047 – Quản lý quy trình kinh doanh · Nhóm 4 · Lớp 50K21.1

Phần mềm hỗ trợ trực tiếp quy trình **quản lý gửi xe tại nhà xe DUE** theo file BPMN To-Be của nhóm (làn Người gửi xe, Nhân viên nhà xe, Quản lý nhà xe, Hệ thống; pool ngoài VietQR).

## Hai cách chạy (cùng một bộ quy tắc To-Be)

**A. Bản chạy hoàn toàn trong trình duyệt** – thư mục `static-site/`, không cần Node, không cần máy chủ.

* Mở `static-site/index.html` bằng Chrome/Edge (hoặc đưa cả thư mục lên GitHub Pages: Settings → Pages → chọn nhánh, thư mục chứa các file này). Đường dẫn đều là tương đối nên chạy được cả khi đặt trong thư mục con.
* Dữ liệu lưu trong `localStorage` của chính trình duyệt đó; các tab cùng trình duyệt tự đồng bộ. Mở mỗi vai trò ở một tab riêng (phiên đăng nhập theo từng tab) để quay demo. Xóa dữ liệu trình duyệt hoặc nút "Khôi phục dữ liệu mẫu" của `admin` sẽ đưa về ban đầu.
* Tạo lại thư mục này sau khi sửa mã: `npm run build:static` (cần Node chỉ ở bước này).
* Giới hạn: không có máy chủ thật nên **không có webhook ngân hàng từ bên ngoài**; thanh toán VietQR dùng nút "giả lập ngân hàng" của `admin`. Mật khẩu băm SHA-256 lặp nhiều vòng có muối (mức demo), khác scrypt của bản Node. Dữ liệu chỉ nằm ở máy người dùng.

**B. Bản có máy chủ Node** (có cookie phiên thật, kiểm tra quyền phía máy chủ, webhook thật).
Cần **Node.js 22.13 trở lên** (dùng SQLite có sẵn trong Node, không cần cài thêm thư viện).

* Windows: bấm đúp `Chay-Nha-Xe.bat`.
* macOS/Linux: `./chay-nha-xe.sh`.
* Hoặc gõ `npm start` rồi mở http://localhost:3000.

Kiểm thử: `npm test` (12 bài kiểm thử API) và `npm run selftest` (36 kịch bản To-Be, chạy trên SQLite) và `npm run selftest:mini` (cùng 36 kịch bản trên bộ xử lý dữ liệu thuần JavaScript của bản trình duyệt). Trong bản trình duyệt, `admin` → Công cụ → Tự kiểm thử chạy 36 kịch bản ngay trên trang.

## Loại vé và khu giữ xe

|Loại vé|Giá|Quyền lợi|
|-|-|-|
|Vé tháng|50.000 đ|Không giới hạn lượt gửi trong 30 ngày hiệu lực; gia hạn cộng dồn. **Hết hạn là hết quyền gửi**|
|Vé 100 lượt|100.000 đ|Gồm sẵn 100 lượt; hết lượt thì nạp thêm (mua tiếp)|
|Vé khách vãng lai|2.000 đ / lượt|Dành cho khách, Quản lý duyệt hồ sơ; mỗi vé 1 lượt|

Sức chứa: Khu G 400 chỗ, Khu D 500 chỗ (tổng 900). Quy tắc quyền gửi: thẻ vé tháng còn hạn thì gửi không giới hạn; ngoài ra thẻ theo lượt cần còn lượt. Mua vé 100 lượt/vé khách chuyển thẻ sang chế độ theo lượt; không mua lượt khi vé tháng còn hạn.

Sinh viên đăng ký phải nhập **MSSV** (đối chiếu danh sách và họ tên của trường). Có hai khu **Khu G** và **Khu D**: người dùng chọn khu ưu tiên khi đăng ký; hết chỗ thì hệ thống xếp sang khu còn lại; cả hai khu đầy thì báo hết chỗ.

## Mỗi vai trò một trang riêng (mật khẩu mẫu `Due@2026`)

|Tài khoản|Vai trò|Trang|
|-|-|-|
|`sv2021001`, `cb001`, `khach01`|Người gửi xe|`/nguoi-gui-xe.html`|
|`nhanvien`|Nhân viên nhà xe|`/nhan-vien.html`|
|`quanly`|Quản lý nhà xe|`/quan-ly.html`|
|`admin`|Quản trị / Giảng viên chấm|`/quan-tri.html`|

Đăng nhập tại `/app.html`; mỗi vai trò được chuyển tới trang của mình, vào sai trang sẽ bị chuyển hướng (kiểm tra ở máy chủ), và API cũng kiểm tra quyền riêng.

## Tác vụ của nhân viên (rút từ mô hình To-Be)

1. **Hỗ trợ tại cổng vào (GĐ2b, G14):** xác định nguyên nhân thẻ bị từ chối; thu tiền mặt rồi cho xe vào, cấp 1 lượt tạm (bắt buộc ghi lý do), hoặc từ chối vào bãi. Thẻ khóa do báo mất không được nhân viên mở.
2. **Xác minh thủ công cổng ra (G08):** đối chiếu ảnh, CCCD/thẻ SV, ghi nhật ký xác minh; không xác minh được thì lập biên bản sự cố và báo Quản lý.
3. **Thu tiền mặt và xác nhận trên app (G11).**
4. **Xe vào chưa xác nhận đỗ quá 3 phút:** nhắc nhân viên ra chỉ dẫn (timer không ngắt); xác nhận đỗ.
5. **Giữ xe, bảo vệ xử lý:** sau khi Quản lý khóa phiên, nhân viên ghi kết quả để đóng sự cố.
6. **Mở rộng thêm:** tra cứu thẻ theo biển số/mã thẻ/MSSV, bán vé tại quầy, xem sơ đồ Khu G/D, báo cáo ca trực (tiền mặt đã thu, số ca hỗ trợ).

## Ánh xạ mô hình To-Be → phần mềm

|Trang To-Be|Nội dung|Cổng đã cài|
|-|-|-|
|2|Đăng ký, kiểm tra định dạng/trùng biển số, đối chiếu CSDL, Quản lý duyệt khách|G15, G01, G02|
|3|Vào bãi: thẻ, vé tháng/lượt, chỗ theo khu, AND (barrier, LED, ảnh); hỗ trợ cổng vào|G03, G04, G05, G14|
|4|Xác minh thủ công và leo thang Quản lý|G08, G09|
|5|Ra bãi: AI ≥ ngưỡng, thử lại tối đa 3 lần, AND 4 tác vụ|G06, G07|
|6|Mua vé / nạp lượt: tiền mặt hoặc VietQR, webhook, hết hạn 3 phút|G10, G11, G12|
|7|Báo mất thẻ: khóa ngay, duyệt cấp lại, chuyển vé và lượt|G13|

15 cổng XOR; mỗi lần một nhánh chạy được ghi vào `gateway\\\_log`, và tab **Cổng XOR To-Be** của `admin` hiển thị số lần từng nhánh đã chạy để làm bằng chứng trong báo cáo.

## Kịch bản demo video 10 phút

Xem tab **Kịch bản demo** trong trang `admin`. Tóm tắt: khách đăng ký → Quản lý duyệt → sinh viên mua vé tháng VietQR → ngân hàng xác nhận → nhân viên cho xe vào Khu G → ra với camera thất bại 3 lần → xác minh/biên bản → Quản lý quyết định → xe hết lượt được nhân viên hỗ trợ → báo mất thẻ → đối chiếu cổng XOR → chạy 36 kịch bản.

## Chạy bằng dữ liệu của giảng viên

`admin` → Dữ liệu test → dán JSON, ví dụ:

```json
{ "directory": \\\[{ "code": "2023001", "full\\\_name": "Tên Sinh Viên", "user\\\_type": "sv" }],
  "users": \\\[{ "username": "gv01", "display\\\_name": "Người Test", "role": "NGX", "user\\\_type": "sv", "plate": "43A-99999", "passes": 5, "monthly\\\_days": 10, "zone\\\_pref": "D" }],
  "settings": { "price\\\_khach": 20000 } }
```

Có nút khôi phục dữ liệu mẫu và xuất toàn bộ dữ liệu JSON.

## Triển khai

GitHub Pages chạy được **bản trình duyệt** (`static-site/`, cách A). Muốn bản có máy chủ thật (cách B) chạy trên mạng, dùng dịch vụ Node miễn phí (ví dụ Render: Start Command `npm start`); gói miễn phí có thể xóa dữ liệu khi khởi động lại nên trước buổi chấm hãy nhập lại dữ liệu test. Khi quay video có thể chạy trên máy bằng `Chay-Nha-Xe.bat`.

## Bảo mật đã làm

* Mật khẩu băm scrypt có muối; phiên lưu CSDL, cookie HttpOnly + SameSite; khóa tạm 10 phút sau 5 lần sai.
* Kiểm tra quyền ở mọi API và ở việc phục vụ trang theo vai trò; truy vấn tham số hóa; thoát ký tự khi hiển thị; Content-Security-Policy.
* Thao tác ghi chỉ nhận JSON (chặn form chéo trang); giới hạn kích thước; chặn đọc file ngoài `public`.
* Webhook ngân hàng xác thực bằng bí mật dùng chung, xử lý một lần (idempotent), kiểm tra số tiền.
* Dữ liệu cá nhân có thời hạn lưu cấu hình được (Nghị định 13/2023/NĐ-CP).

## Giới hạn cần nói thẳng trong báo cáo

* Camera AI, NFC và cảm biến được **mô phỏng** bằng form nhập tay; chưa có thiết bị thật.
* Mã VietQR chỉ hiện khi nhập tài khoản ngân hàng ở Thông số; trong demo dùng nút giả lập ngân hàng.
* Ngưỡng 0,95, 3 lần thử, hạn QR 3 phút, nhắc đỗ sau 3 phút là thông số thiết kế chưa kiểm chứng thực tế.
* Báo mất thẻ bị từ chối: thẻ cũ vẫn khóa (giả định của nhóm).
* Mô hình To-Be ghi tài khoản mới nhận "90 lượt"; theo yêu cầu của nhóm, phần mềm dùng vé tháng và vé 100 lượt thay cho cách đó.
* Số điện thoại, email và giờ mở cửa là **thông tin giả lập cho demo**. Tài khoản nhận tiền mặc định: 0000000000, NHA XE DUE DEMO; **mã ngân hàng (BIN) mặc định 970422 chỉ là giả định**, hãy đổi đúng ngân hàng trong `admin` → Thông số thì mã VietQR mới đúng.

## Cấu trúc

```
server.js, lib/app.js        máy chủ, định tuyến, xác thực, phân quyền, phục vụ trang theo vai trò
lib/service.js               nghiệp vụ To-Be (G01–G15)
lib/flows.js                 định nghĩa cổng, loại vé, khu, thông số mặc định
lib/scenarios.js             36 kịch bản kiểm thử
lib/db.js, seed.js           SQLite, dữ liệu mẫu
lib/minisql.js, db.mini.js   bộ xử lý dữ liệu thuần JS (bản trình duyệt)
lib/localapi.js, routes.js   máy chủ "ảo" trong trình duyệt, bảng API dùng chung
scripts/build-static.js      đóng gói static-site/
public/index.html            trang chủ
public/app.html + login.js   đăng nhập, đăng ký
public/nguoi-gui-xe|nhan-vien|quan-ly|quan-tri.html  + ngx|nv|ql|admin.js   trang từng vai trò
public/common.js, app.css, logo.png   phần dùng chung (giao diện theo logo DUE: cam, xanh lá, xanh dương)
```

Không dùng thư viện bên thứ ba. Nhóm cần tự đọc và giải thích được từng đoạn mã khi bảo vệ.

