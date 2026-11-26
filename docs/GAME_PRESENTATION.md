# Cảnh trò chơi và lời thoại — bản phát triển 0.6.0

Áp dụng intentional-visual-design tại SKILL.md. Đối tượng là lớp học xem qua màn hình/máy chiếu: vui nhộn, thân thiện, dễ đọc, mỗi trò có thế giới riêng. Ưu tiên hoạt động đang diễn ra và lời thoại, sau đó mới đến chi tiết cảnh; điều khiển giữ vị trí, không có hiệu ứng chớp nhanh hoặc dịch vụ mạng.

## Hướng hình ảnh

| Trò | Điểm nhận diện mới |
|---|---|
| Câu cá | Hồ xanh dịu, cầu gỗ, hoa ven bờ và các vòng nước lan nhẹ |
| Phi thuyền | Trạm đón ngoài hành tinh, phi công nhỏ, hành tinh có vành và đèn đường |
| Máy gắp thú | Gian hội chợ, mái sọc, biển hiệu, đèn sáng nhẹ, bóng bay và bậc nhận quà |
| Đua bi | Mặt đường tím đậm hơn, khán đài, cờ chuyển động, cúp và biển về đích |
| Kho báu | Đảo cát ấm, di tích, cây đảo, chìa khóa xoay và hạt sáng quanh vùng đang tìm |

Màu/icon HUD riêng cho từng trò, thanh tiến trình theo timeline thật và mốc tình huống. Typography Segoe UI hỗ trợ tiếng Việt; giữ các nút tạm dừng/bỏ qua/dừng lượt. Không dùng ảnh tải từ xa, font dịch vụ hoặc framework mới.

## Lời thoại

- 15 loại tình huống hụt, mỗi loại 2 câu tiếng Việt; chọn biến thể bằng visualSeed + chỉ số hook, không lấy RNG chọn học sinh.
- Gắn đúng ID/tên học sinh của hook, không lấy phần tử đầu danh sách. Nội dung ổn định qua các frame, pause và chuyển 3D→2D. Mỗi hook chỉ thay nội dung một lần; kết quả/skip ẩn thoại.
- 3D đặt bong bóng bên cạnh và phía trên nhân vật, giới hạn trong khung và nhường chỗ cho nút. Ẩn nhãn tên trùng của người đang nói; tránh nhãn nền chồng lên thoại.
- 2D có vùng thoại riêng. Điện thoại thu gọn tên nền để ưu tiên đọc thoại và thao tác. Tên dùng textContent, không render HTML từ dữ liệu.
- role=status, aria-live=polite, aria-atomic; reduced motion tắt hiệu ứng vào thoại và các chuyển động trang trí mới. Không gọi dịch vụ giọng nói trực tuyến.

## Runtime

SceneDetails dùng geometry/material được cache, instancing cho chi tiết lặp, CanvasTexture cho biển hiệu tạo cục bộ; tài nguyên đều thuộc ResourceTracker. Chỉ cập nhật transform/buffer, không tạo mesh/texture mỗi frame. Reduced motion giữ chi tiết ở trạng thái tĩnh. Không thêm vòng requestAnimationFrame riêng.

Winner/hooks đã được chọn trước khi tạo scene. Lời thoại, chi tiết, xáo vị trí, tiến trình hoặc mất WebGL không sửa kết quả, điểm danh hay lịch sử; GameManager vẫn là nơi commit duy nhất.

Fishing là gate trước khi mở rộng: đã kiểm tra hai câu thoại, vị trí, pause/skip, screenshot và 80 nhân vật Low (79 draw calls/10 geometries). Số đo dev headless không phải nghiệm thu FPS trên máy trường. Kết quả cuối và giới hạn tại TEST_REPORT.md.

## Phát hành

Chỉ build/test/review cho đến khi người dùng yêu cầu đóng gói. Gói Windows/ZIP 0.5.0 hiện có giữ nguyên; các tính năng ở trên thuộc mã nguồn/build phát triển 0.6.0.
