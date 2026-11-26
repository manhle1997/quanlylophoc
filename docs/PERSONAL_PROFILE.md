# Hồ sơ giáo viên — 0.5.1

Tab **Thông tin cá nhân** ở mục Tiện ích; nút ảnh đại diện trên thanh trên cùng dùng được cả trên màn hình nhỏ. Chỉnh họ tên, môn dạy/chức vụ, tên trường, email, số điện thoại, ảnh đại diện, logo trường và màu chủ đạo. Tên/ảnh/logo xuất hiện trong shell. Màu được áp dụng ngay, cân chỉnh độ đậm để giữ độ tương phản; scene trò chơi giữ palette riêng.

## Lưu và tương thích

- Một file chính `data/user-profile.json` cạnh launcher, schemaVersion 1, gồm toàn bộ trường hồ sơ và ID ảnh. Không nhúng ảnh base64 hoặc lưu đường dẫn file gốc vào JSON.
- Nếu chưa có hồ sơ, lấy tên trường từ document lớp cũ làm giá trị ban đầu; chỉ tạo hồ sơ khi có chỉnh sửa. Không sửa document lớp hoặc schema điểm danh.
- Tự lưu sau khi ngừng nhập 350 ms; serialize và ghi tiếp nếu có sửa trong lúc request đang chạy. Retry lỗi tạm tối đa 3 lần, giữ nội dung khi lỗi/xung đột; không tự ghi đè hồ sơ từ cửa sổ khác. Tải lại bỏ nội dung chưa lưu cần xác nhận.
- SHA-256 ETag, ghi temp cùng thư mục bằng WriteThrough/Flush(true), kiểm tra bytes, đổi tên nguyên tử. Backup trước khi thay file tại `data/profile-backups/`, giữ 20 bản. File hỏng/schema tương lai không bị thay bằng hồ sơ trống. Hồ sơ đọc lỗi không chặn mở lớp học; tab hiển thị lỗi và cho thử lại.
- Khôi phục snapshot lớp không đổi hồ sơ. Chế độ Chơi thử khóa biểu mẫu hồ sơ để tránh sửa thông tin thật.

## Sao chép ảnh

Chọn ảnh bằng file picker thông thường trong tab; không chọn nơi lưu. Frontend gửi bytes đến launcher. Launcher nhận ảnh PNG/JPG/WebP/GIF tối đa 8 MiB, kiểm tra MIME và magic bytes, đặt tên theo SHA-256 và phần mở rộng được xác định từ nội dung, rồi sao chép nguyên bytes vào `data/profile-images/`. Cùng nội dung dùng cùng bản sao. File gốc có thể được đổi tên, di chuyển hoặc xóa mà ảnh trong ứng dụng vẫn dùng được.

Gỡ ảnh chỉ bỏ tham chiếu khỏi hồ sơ; không xóa file mà backup có thể đang dùng. Ảnh đã thay được bỏ khỏi bộ nhớ trình duyệt khi không còn được hiển thị. Chỉ JSON chứa tham chiếu, không có API nhận đường dẫn tệp từ client.

## API loopback

| Endpoint | Chức năng |
|---|---|
| GET `/api/profile` | Hồ sơ và ETag độc lập với dữ liệu lớp |
| POST `/api/profile` | `{ profile, expectedEtag }`, application/json |
| POST `/api/profile/images` | Body là bytes ảnh, Content-Type đúng loại ảnh |
| GET `/api/profile/images/{id}` | Đọc bản sao theo ID ảnh được kiểm tra chặt |

Host/Origin/Sec-Fetch-Site/token áp dụng như API lớp học. Frontend lấy ảnh bằng token header rồi dùng Blob URL; token không đi trong URL. Không static-serve `data/`; chặn traversal, ID tùy ý và reparse point. Không có mạng ngoài, CDN hay dịch vụ upload.

## Phát hành

Packaging giữ toàn bộ `data/` nguyên tại chỗ, bao gồm hồ sơ, ảnh, backup hồ sơ và dữ liệu lớp. ZIP dùng whitelist chương trình, chỉ có thư mục `data/backups/` trống. Không đưa hồ sơ hoặc ảnh cá nhân vào gói phân phối.

Kiểm chứng cụ thể trong [TEST_REPORT](TEST_REPORT.md), tiến độ trong [IMPLEMENTATION_STATUS](IMPLEMENTATION_STATUS.md).
