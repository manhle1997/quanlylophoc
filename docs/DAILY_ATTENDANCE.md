# ADR-008 — Lớp Học Vui và điểm danh theo ngày, 2026-11-25

Ba phân hệ chính hiển thị bằng tiếng Việt: Quản lý học sinh, Điểm danh, Gọi lên bảng. Lịch sử gọi tên, Cài đặt và Bản lưu an toàn là tiện ích phụ. Tên hiển thị mới là Lớp Học Vui; tên nội bộ ClassQuest và vị trí lưu được giữ để không tách dữ liệu cũ.

## Dữ liệu và tương thích

Schema v2 thêm `attendanceRecords`: mỗi bản ghi có `id`, `classId`, `date` dạng `YYYY-MM-DD`, `updatedAt` và `entries` gồm `studentId`/`status`. Bốn trạng thái là `present`, `late`, `excused`, `absent`. Mỗi lớp/ngày có tối đa một bản ghi; mỗi học sinh có tối đa một trạng thái trong bản ghi. Frontend và launcher đều kiểm tra ngày lịch hợp lệ, trạng thái, ID và tham chiếu.

Frontend tự đọc schema v1 thành v2 trong bộ nhớ với danh sách điểm danh rỗng, giữ document/class/student IDs, lịch sử, vòng không trùng và cài đặt. Chỉ đọc không ghi đĩa. Lần chỉnh sửa tiếp theo tự lưu schema v2; launcher giữ backup đúng bytes bản v1 trước khi thay thế. Không viết lại bản hỏng hoặc schema tương lai.

## Hành vi điểm danh

- Mở một ngày chưa ghi nhận chỉ hiển thị danh sách tạm có mặt; thao tác xem không tự tạo bản ghi. Giáo viên ghi nhận cả lớp hoặc đổi trạng thái một bạn để bắt đầu lưu ngày đó.
- Lần ghi nhận đầu lưu toàn bộ học sinh đang học. Học sinh thêm sau chỉ được đưa vào bản ghi hôm nay; lịch sử đã ghi không tự tăng sĩ số theo danh sách mới.
- Ngừng học giữ nguyên các bản ghi cũ. Lớp lưu trữ vẫn xem được điểm danh, chỉ chỉnh sửa sau khi khôi phục lớp.
- Xóa vĩnh viễn có xác nhận và dọn tham chiếu điểm danh, lịch sử, vòng. Nên dùng Ngừng học/Lưu trữ nếu cần giữ quá trình học.
- Đánh dấu lại cả lớp có mặt khi đã có vắng/đi muộn cần xác nhận; hủy giữ trạng thái cũ.
- Bộ lọc tên vẫn được giữ khi cập nhật trạng thái. Lịch ngày hiển thị 14 ngày đã ghi gần nhất; có thể chọn ngày cũ hơn bằng ô ngày.

## Điều kiện gọi lên bảng

Ngày hôm nay tính theo `Asia/Ho_Chi_Minh`, độc lập ngày đang xem ở Điểm danh. Vắng có phép và không phép bị loại; đi muộn vẫn có thể gọi. Chưa ghi nhận hôm nay thì dùng tất cả học sinh đang học, có ghi chú trên màn hình. Sang ngày mới, bản ghi hôm qua vẫn giữ nhưng không tiếp tục loại học sinh.

Pool tiếp tục lọc lớp lưu trữ, học sinh ngừng học và ID đã gọi trong vòng unique. Winner được chọn trước animation. Reset vòng chỉ đặt lại cơ hội gọi tên; không xóa điểm danh hoặc lịch sử.

## Khôi phục và phát hành

Backup chứa toàn bộ document, gồm điểm danh, lịch sử và vòng; UI hiển thị thêm số ngày điểm danh theo lớp trước khi xác nhận phục hồi. Gói phát hành mới có dữ liệu trống; việc cập nhật phải giữ `data/` của bản đang dùng cạnh launcher. Không chạy thử hoặc kiểm thử trên thư mục dữ liệu giáo viên.

Kiểm chứng và giới hạn thiết bị được ghi tại [TEST_REPORT](TEST_REPORT.md) và [IMPLEMENTATION_STATUS](IMPLEMENTATION_STATUS.md).
