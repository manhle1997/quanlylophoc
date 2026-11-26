# Dashboard — Sổ lớp số

Thiết kế theo skill `intentional-visual-design` tại `SKILL.md`, yêu cầu 2026-11-25. Đối tượng là giáo viên thao tác nhiều lần trong ngày, có thể dùng laptop, màn hình nhỏ hoặc máy chiếu. Cảm giác cần tạo: tin cậy, ngăn nắp, gần gũi với công việc lớp học.

## Định hướng

- Tính cách: rõ ràng, điềm tĩnh, chính xác, ấm áp.
- Điểm nhận diện: nền giấy sáng, xanh mực của sổ lớp, ký hiệu quyển sổ và mã lớp; kiểu chữ hệ thống Segoe UI hỗ trợ tiếng Việt, dùng số tabular cho dữ liệu.
- Thứ bậc: lớp/danh sách đang làm việc → trạng thái điểm danh và số liệu thật → thao tác thêm/sửa/gọi tên. Không thêm biểu đồ hoặc xu hướng khi sản phẩm không có dữ liệu tương ứng.
- Bố cục: sidebar cố định với đúng ba phân hệ, thanh trạng thái mỏng, tổng hợp một dải, danh sách lớp cạnh bảng học sinh; công việc trong ngày ở cùng ngữ cảnh lớp.
- Quy tắc xuyên suốt: spacing 4/8 px, controls 6 px và panel 8 px radius, đường phân cách thay cho bóng đổ; màu trạng thái luôn kèm nhãn; điều khiển bàn phím và focus rõ.
- Tránh: tím phát sáng, slogan và eyebrow lặp lại, bảng số liệu giả, mỗi dòng một card, tiêu đề lớn chiếm diện tích thao tác. Đây là màn hình vận hành, không phải trang quảng bá.

## Phạm vi

Thiết kế lại shell Dashboard, Quản lý học sinh, Điểm danh, màn chọn trò chơi và các tiện ích. Giữ trình tự điều hướng, accessible names của thao tác chính, CRUD, schema, persistence và RNG. Scene 3D giữ thế giới hình ảnh riêng; khu vực quản lý dùng giao diện sáng.

Không thêm framework, font dịch vụ, CDN, remote asset hoặc dependency. Mọi số liệu lấy từ document hiện có; ảnh đánh giá chỉ dùng dữ liệu giả. Dữ liệu người dùng được bảo toàn.

## Đánh giá

Đã triển khai trực tiếp trong ứng dụng. Đã xem ảnh render ở 1440×960, 768×1024 và 390×844; chỉnh bố cục mobile sang bộ chọn lớp gọn, ô tổng hợp điểm danh 1+4 và thanh bắt đầu rõ trạng thái. Kiểm tra thêm khung 1024×576/720p/1080p/4:3 trong bộ E2E có sẵn.

Review: hệ nhận diện thống nhất giữa sidebar, danh sách, biểu mẫu và favicon; thứ bậc ưu tiên lớp và thao tác, số liệu thật; typography/spacing/đường phân cách nhất quán; các scene vẫn phù hợp hoạt động giáo dục. Bỏ slogan/eyebrow lặp lại và giữ copy cụ thể theo công việc. Không có lỗi nghiêm trọng trong các khung đã xem.

Đã xem thêm màn hình trống, modal desktop/mobile và Cài đặt. Tinh chỉnh khoảng trống vùng cuộn modal để vòng focus không bị cắt và đồng bộ accent của thanh âm lượng. Bộ layout test được chạy lại cho thay đổi CSS này.

Đã đo 10 cặp màu chữ đại diện từ computed styles: thấp nhất 4,58:1; các control đang hiển thị ở desktop tối thiểu 24×24 px. Đã kiểm tra skip link, focus, chọn lớp và chọn game. Đây là kiểm tra đại diện, không phải chứng nhận accessibility toàn phần; screen reader/thiết bị thật còn cần kiểm tra.

## Hồ sơ cá nhân 0.5

Giữ hệ Sổ lớp số và ba phân hệ chính. Tab Thông tin cá nhân nằm trong Tiện ích; nút ảnh đại diện trên thanh trên cùng cho phép mở ở mọi độ rộng. Biểu mẫu chia theo thông tin giáo viên/nhà trường, ảnh và màu; phần giới thiệu hẹp bên trái và trường nhập bên phải, chuyển sang một cột trên điện thoại. Tên giáo viên, trường, avatar và logo liên kết với shell; giới hạn dòng với ellipsis cho tên dài ở vùng điều hướng.

Palette mặc định giữ xanh mực; có sáu màu chọn nhanh và bộ chọn tùy ý. Thuật toán cân độ đậm để chữ dễ đọc, giữ semantic colors và palette scene độc lập. Không thêm ảnh, font hoặc thư viện mạng. Ảnh minh họa kiểm thử chỉ là chữ GV vẽ cục bộ, không dùng người hoặc thương hiệu thật.

Đã xem trực tiếp ảnh profile ở 1440/768/390 px, đủ trường/ảnh/logo/màu và không tràn ngang. Kiểm tra autosave/reload, upload/gỡ ảnh, xung đột, khóa sửa trong demo và native restart/file copy. Lint, 79 unit/integration và native storage/profile/security pass. Gate E2E hiện hành và giới hạn hiệu năng tại [TEST_REPORT](TEST_REPORT.md) và [IMPLEMENTATION_STATUS](IMPLEMENTATION_STATUS.md). Gói đang dùng giữ nguyên cho đến khi có yêu cầu đóng gói.

## Nhãn nhân vật 0.6.0

Giữ typography, giới hạn nhãn và ưu tiên nhân vật đang được tương tác. Xáo thứ tự nhân vật ở đầu lượt bằng visualSeed để các vị trí được gắn nhãn không luôn thuộc các học sinh đầu danh sách. Cả 3D và 2D nhận cùng thứ tự; khi mất WebGL vẫn giữ ánh xạ ID của lượt. Phần này không thay cách chọn kết quả.

## Lời thoại và thế giới trò chơi

Mỗi trò có bối cảnh riêng trong cùng phong cách mô hình đồ chơi. Bổ sung chi tiết và chuyển động theo chủ đề; bảng điều khiển giữ vị trí, màu/icon phản ánh trò đang chạy, tiến trình theo timeline thật. Lời thoại gắn đúng học sinh của hook; tên và câu là điểm nhấn khi hụt. Chi tiết tại [GAME_PRESENTATION](GAME_PRESENTATION.md).

Đã review desktop 1280×720 của 5 trò, 2D điện thoại 390×844 và 3D 390/768 px. Đã giảm tên nền trên điện thoại, giãn đuôi thoại với chú thích, dời thoại sang bên để rõ hành động và làm tối nền HUD để chữ rõ trên cảnh sáng. Giữ reduced motion, aria-live và an toàn textContent. Chỉ build/test/review; chưa đóng gói.
