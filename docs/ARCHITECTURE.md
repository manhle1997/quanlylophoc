# Kiến trúc hiện hành — Lớp Học Vui

## Runtime và dữ liệu

- Chức năng lớp học Windows offline: HTML/CSS, Vanilla JavaScript ES modules, Vite, Three.js, GSAP; không CDN, telemetry hoặc asset từ xa. Ngoại lệ được yêu cầu: kiểm tra/tải cập nhật từ GitHub khi giáo viên bấm nút, không tự kết nối nền.
- Launcher .NET self-contained chỉ bind loopback, phục vụ app và cầu nối snapshot/backup nội bộ. Kiểm tra Host/Origin/token; không phục vụ data/ hoặc nhận đường dẫn file từ client.
- JSON là nguồn dữ liệu chính. Tự đọc khi mở, tự lưu sau mutation, backup trước overwrite, ghi nguyên tử, xác minh bytes và kiểm tra CAS/ETag. Xung đột hoặc lỗi giữ dữ liệu đang làm và bản đã lưu. Xem [AUTOMATIC_STORAGE](AUTOMATIC_STORAGE.md).
- Schema v2 lưu điểm danh theo lớp/ngày và đọc schema v1 không mất IDs, lịch sử hoặc vòng. Logic tương thích dữ liệu tiếp tục được giữ dù gói ứng dụng cũ được dọn. Xem [DAILY_ATTENDANCE](DAILY_ATTENDANCE.md).
- Demo tách khỏi dữ liệu thật. Không đưa roster thật vào source, fixture hoặc ảnh.
- Hồ sơ giáo viên có JSON riêng, ảnh được sao chép nguyên bytes vào data qua API hẹp có token; tự lưu/backup/ETag độc lập và không bị thay khi phục hồi lớp. Xem [PERSONAL_PROFILE](PERSONAL_PROFILE.md).

## Domain và trò chơi

- Domain không phụ thuộc DOM, renderer hoặc persistence.
- Chọn winner theo ID bằng crypto rejection sampling trước animation. Scenario bất biến; manager commit một lần khi reveal. Scene không thay kết quả hoặc ghi lịch sử.
- Thứ tự nhân vật được xáo trộn bằng visualSeed sau khi scenario đã chọn ID. Cả 5 cảnh 3D, 2D và recovery dùng cùng thứ tự trong một lượt; không lấy cố định các tên đầu lớp cho nhãn. Chỉ xáo bản sao mảng, không sửa roster, eligibleIds hoặc dùng thêm RNG chọn kết quả.
- Pool chỉ loại học sinh vắng hôm nay theo giờ Việt Nam, học sinh ngừng học, lớp lưu trữ và ID đã gọi trong vòng unique.
- WebGL2 dùng một renderer, một active loop và disposal theo ownership. Fallback 2D giữ cùng scenario. SVG/geometry thủ tục và Web Audio đều tạo cục bộ.

## Giao diện

Ba phân hệ chính: Quản lý học sinh, Điểm danh, Gọi lên bảng. Thông tin cá nhân/Lịch sử/Cài đặt/Sao lưu là tiện ích phụ. Dashboard theo hướng Sổ lớp số; cho đổi màu chủ đạo, tên/ảnh/logo theo giáo viên; scene có palette riêng. Xem [DESIGN_DIRECTION](DESIGN_DIRECTION.md).

## Hoàn tất và dọn phiên bản

Cập nhật tại máy giáo viên được launcher thực hiện qua API loopback có Host/Origin/token như persistence. Frontend chỉ gửi thao tác check/download/cancel/apply, không gửi URL, đường dẫn hay dữ liệu lớp ra Internet. Launcher chọn gói của repository cố định, kiểm tra SHA-256 từ GitHub API, giải nén có giới hạn và danh sách entry cho phép. Một bản sao launcher chạy chế độ helper từ `.updates/<id>/Updater.exe`, chờ tiến trình cũ thoát rồi thay program entries tại chỗ. Không cần thêm runtime hoặc SDK. Có journal/backup chương trình, rollback khi lỗi và kiểm tra session/version sau restart; `data/` giữ nguyên toàn bộ. Xem [APPLICATION_UPDATES](APPLICATION_UPDATES.md).

Chỉ khi người dùng yêu cầu rõ, sau build/test mới packaging: tái sử dụng thư mục phát hành, đổi tên thư mục và ZIP hiện có theo version mới rồi thay nội dung chương trình/ZIP/checksum. Không tạo thư mục version song song. Lần phát hành đầu trong workspace trống mới tạo thư mục. Trong giai đoạn phát triển giữ nguyên gói đang dùng, chỉ build/test/review. Dọn fixture và tài liệu lỗi thời, bảo toàn dữ liệu.

Dữ liệu lớp học, lịch sử và backup nằm nguyên trong `data/`; không sao chép, xóa hoặc đưa vào ZIP. Chuẩn bị chương trình/ZIP trong vùng build tạm, kiểm tra version và từ chối link/đường dẫn không hợp lệ trước khi đổi tên. Ghi nhận các bước rename để hoàn tác cả tên, chương trình và ZIP/checksum nếu commit lỗi. Dọn vùng build tạm khi hoàn tất; giữ vùng phục hồi nếu rollback không thành công. Từ chối cùng version hoặc downgrade; phát hành đầu vẫn hoạt động trên CI sạch.

Kết quả thực tế và gate còn mở ở [IMPLEMENTATION_STATUS](IMPLEMENTATION_STATUS.md) và [TEST_REPORT](TEST_REPORT.md).
