# Lớp Học Vui (tên cũ ClassQuest)

- Runtime phải offline hoàn toàn; không CDN, telemetry, remote asset hay dịch vụ từ xa.
- Stack: HTML/CSS, Vanilla JavaScript ES modules, Vite, Three.js, GSAP.
- Ba phân hệ chính: Quản lý học sinh, Điểm danh, Gọi lên bảng. Lịch sử/Cài đặt là tiện ích phụ. Tên hiển thị bằng tiếng Việt.
- Điểm danh lưu theo lớp/ngày trong schema v2, tự đọc schema v1. Gọi lên bảng chỉ loại học sinh vắng của hôm nay, không lấy ngày lịch sử đang xem. Không xóa dữ liệu khi nâng cấp.
- Theo yêu cầu mới của người dùng: mở ứng dụng là dùng được, tự đọc/lưu/backup. Không yêu cầu giáo viên chọn thư mục/file, xác nhận lưu hay hiểu đường dẫn/JSON.
- JSON vẫn là nguồn dữ liệu chính. Launcher .NET quản lý persistence cục bộ bên cạnh ứng dụng, ghi nguyên tử, backup và phát hiện xung đột; frontend không tự chọn đường dẫn.
- Xóa vĩnh viễn, restore hoặc reset vòng vẫn cần xác nhận nghiệp vụ. Lưu thông thường tự động, không có popup.
- Random chọn winner theo ID trước animation; scene không thay đổi kết quả hoặc ghi history.
- Không dùng tên học sinh thật trong Git, demo, ảnh hoặc test. Không lấy roster từ Internet.
- Theo thứ tự M0–M7; Fishing là quality gate trước khi nhân rộng scene.
- Sau mỗi milestone chạy build/test và cập nhật docs/IMPLEMENTATION_STATUS.md với kết quả thật.
- Theo yêu cầu người dùng 2026-11-25: từ phiên bản kế tiếp, đổi tên chính thư mục phát hành và file ZIP hiện có theo version mới, cập nhật nội dung trong đó; không tạo thêm thư mục phiên bản song song. Dùng `npm run package:release` sau build/test và xác minh gói. ZIP phải chứa build mới đã kiểm tra, không chỉ đổi tên nội dung cũ; cập nhật cả tên và giá trị checksum. Chỉ lần phát hành đầu khi chưa có bản nào mới tạo thư mục phát hành.
- Sau khi phiên bản mới hoàn tất, chỉ giữ bản hiện hành; dọn build/fixture tạm và tài liệu/báo cáo/ảnh chỉ phục vụ bản cũ, cập nhật tài liệu hiện hành thay vì lưu nhiều bản lịch sử. Không cần hỏi lại để dọn các artifact này.
- Đổi tên/cập nhật phiên bản không được xóa danh sách lớp/học sinh, điểm danh, lịch sử hoặc các bản sao lưu dữ liệu. Giữ nguyên `data/` tại chỗ khi tái sử dụng thư mục; không đưa dữ liệu này vào ZIP. Nếu cập nhật lỗi, hoàn tác việc đổi tên và nội dung chương trình. Giữ logic đọc schema cũ cần thiết cho dữ liệu hiện có.
- Launcher chỉ bind loopback; ngoại lệ được người dùng cho phép là API lưu snapshot/backup nội bộ. Kiểm tra Host/Origin/token, không expose đường dẫn data/ dưới dạng static, không nhận đường dẫn file từ client.
- Theo yêu cầu người dùng 2026-11-26: chỉ đóng gói/phát hành khi người dùng yêu cầu rõ. Trong lúc phát triển chỉ build/test/review; không tự chạy package:release, đổi tên thư mục/ZIP phát hành hoặc dừng ứng dụng đang dùng để cập nhật gói. Khi được yêu cầu đóng gói, áp dụng các quy tắc bảo toàn data và tái sử dụng thư mục ở trên.
- Theo yêu cầu người dùng 2026-11-26: lint/test chức năng chạy tại local trước khi push. GitHub CI chỉ build; workflow phát hành không chạy lại unit/E2E/native test hoặc cài Playwright. Giữ kiểm tra version, tên gói, checksum và đối chiếu ZIP với build; việc đóng gói vẫn cần yêu cầu thủ công.

<!-- postman-cli:installation:start -->
Postman CLI is installed on this device, and can be used for API Engineering work.
<!-- postman-cli:installation:end -->


## Visual Design Requirements

For all UI/UX, frontend styling, dashboard,
landing page, banner, poster, and marketing
design tasks, use the intentional-visual-design
skill.

Avoid generic AI-generated visual patterns.
Prioritize deliberate art direction, visual
hierarchy, typography, brand identity, usability,
accessibility, and performance.

Inspect the rendered result whenever possible.
Do not consider visual work complete until
the design quality review has been performed.
