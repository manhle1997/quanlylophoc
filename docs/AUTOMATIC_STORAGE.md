# ADR-007 — Hệ thống tự quản lý dữ liệu, 2026-11-25

Giáo viên chỉ mở ứng dụng, thêm lớp và học sinh; không yêu cầu hiểu đường dẫn, chọn file/thư mục hoặc thao tác lưu.

## Hành vi

- Khởi động tự đọc danh sách đã lưu. Chưa có dữ liệu thì hiển thị Tạo lớp đầu tiên.
- CRUD, điểm danh theo lớp/ngày, cài đặt, reset vòng và kết quả game tự lưu ngay sau mutation. Điểm danh được lưu trong schema v2; xem [ADR-008](DAILY_ATTENDANCE.md).
- Frontend giữ working copy; autosave serialize một yêu cầu mỗi lần, gộp thay đổi trong khi đang ghi, cập nhật đúng edit generation/document epoch. Không clear dirty nếu còn thay đổi mới hoặc có lỗi.
- Retry lỗi tạm tối đa 3 lần, hiển thị trạng thái và nút thử lại khi thất bại. Payload nhỏ dùng keepalive. Không popup lưu hoặc mở picker.
- Demo luôn tách khỏi dữ liệu thật, không autosave.
- Phục hồi là lựa chọn thời điểm/số lớp/số học sinh, không chọn tệp. Xác nhận phục hồi/xóa/reset vẫn là xác nhận nghiệp vụ.

## Persistence

Launcher .NET self-contained thêm cầu nối filesystem loopback hẹp: GET session; GET/POST snapshot; GET danh sách backup; POST restore. File cố định `data/school-data.json` cạnh launcher, schema v2 và tự đọc schema v1. Bản 0.5 thêm GET/POST hồ sơ và sao chép/đọc ảnh theo ID, không nhận đường dẫn từ client. Không có đăng nhập, database hoặc kết nối từ xa. Đường dẫn chỉ thuộc implementation, không xuất hiện trong UI giáo viên. Hồ sơ có file và backup riêng; xem [PERSONAL_PROFILE](PERSONAL_PROFILE.md).

Server validate schema/references, kiểm tra SHA-256 ETag, backup trước overwrite, ghi temp bằng WriteThrough + Flush(true), xác minh, rename cùng thư mục và đọc lại. Lỗi backup/read-only dừng trước khi đổi file gốc. File hỏng hoặc schema tương lai không tự bị thay bằng dữ liệu trống. Retry response-loss với cùng nội dung được xử lý idempotent.

Giữ 20 backup `auto-v2-*` gần nhất; không xóa legacy backups từ phiên bản cũ. Restore giữ bản hiện tại trước khi thay thế, kể cả bản hỏng. Backup cùng thiết bị không phải bảo vệ mất thiết bị.

Host đúng loopback origin, không wildcard CORS, API kiểm tra Origin/Sec-Fetch-Site và token ngẫu nhiên theo process. POST snapshot/hồ sơ bắt buộc application/json; POST ảnh yêu cầu MIME ảnh phù hợp magic bytes và tối đa 8 MiB. Token chỉ ở RAM/header, không URL hoặc log. `data/`/backups/traversal/reparse point vẫn không được truy cập qua static. API trả Cache-Control no-store.

Không hỗ trợ nhiều writer tự hợp nhất: conflict giữ working copy và yêu cầu tải lại danh sách có xác nhận. Không tự ghi đè thay đổi của cửa sổ khác hoặc editor bên ngoài.

## Kiểm chứng

Vitest kiểm tra hàng đợi, retry, demo isolation, stale epoch và client session/ETag. Native integration kiểm tra JSON thật, restart, backup/restore, backup failure, read-only, corrupt/ref/schema/conflict, Origin/token/content type và static isolation. Native browser E2E thực hiện toàn bộ luồng giáo viên với file pickers bị vô hiệu hóa.

Kiểm thử dùng thư mục riêng/cổng 17844; người dùng bình thường dùng origin mặc định 17843. Không thử trên dữ liệu thật hoặc phiên người dùng. Dọn thư mục kiểm thử sau khi hoàn tất; khi dọn gói ứng dụng cũ vẫn bảo toàn dữ liệu và backup.
