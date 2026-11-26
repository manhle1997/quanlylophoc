# Kiểm thử Lớp Học Vui — bản phát triển 0.5.1

2026-11-26, Windows x64, Node 20.19.6, .NET SDK 10.0.401, Chromium 159. Chỉ dùng nhân vật và dữ liệu giả trong kiểm thử/ảnh. Gói phát hành vẫn là 0.5.0; không đóng gói khi chưa được người dùng yêu cầu.

## Gate hiện tại

| Gate | Kết quả |
|---|---|
| Lint | Pass, không lỗi/cảnh báo |
| Vitest | 79/79, 11 file |
| Vite build | Pass, 71 modules |
| Static offline | Pass, 17 entries, 811,5 KiB |
| Native storage/profile/security | Pass trước phần nâng cấp cảnh; backend chỉ đổi version |
| Fishing gate trước mở rộng | 2/2 E2E pass, 20,7 giây; dialogue + 80 nhân vật Low |
| 5 scene/dialogue/mobile 2D tập trung | 11/11 pass, 1,7 phút trước tinh chỉnh bố cục cuối |
| Toàn bộ build cuối | 44/44 pass, không skip, 4,6 phút |
| Sau chỉnh nền HUD | 5/5 desktop/phone/tablet pass, 40,9 giây |
| Packaging | Không thực hiện theo yêu cầu người dùng |

## Tên đầu lớp và kết quả

Nguyên nhân cũ: nhãn 3D lấy chỉ số 0, 6, 12… còn fallback lấy 12 phần tử đầu; danh sách nhận vào giữ nguyên thứ tự lớp. GameManager nay xáo bản sao bằng visualSeed sau khi scenario đã chọn winner/hooks, dùng cùng thứ tự cho 5 cảnh, fallback và recovery. Không sửa roster/eligibleIds hoặc lấy thêm RNG cho kết quả.

5 unit tests cho thứ tự trình bày: giữ mọi ID/tham chiếu và thứ tự roster gốc, seed ổn định, seed khác đổi vị trí, không ảnh hưởng winner/hooks, pool 0/1 học sinh. Với 2.048 seed cố định, cả 40 ID đều có thể đứng đầu và học sinh đầu lớp có cả trường hợp có/không ở tập nhãn. Hai manager tests kiểm tra prepare lỗi/recovery dùng cùng thứ tự và reveal/commit đúng ID một lần. Hai E2E giữ winner thứ 18, kiểm tra 5 scene và 2D/context loss.

## Lời thoại nhân vật

15 loại hook × 2 câu tiếng Việt, theo bối cảnh từng trò. Dùng ID học sinh của hook và biến thể từ visualSeed + chỉ số hook; ổn định qua frame/pause/recovery, không sửa scenario hoặc kết quả. Thoại tự ẩn khi hết hook, khi skip hoặc reveal. Tên và câu dùng textContent.

3 unit tests bao phủ toàn bộ game/kind, thời điểm bắt đầu/kết thúc, câu của hai lần hụt, pause/recovery và xóa thoại khi reveal. E2E kiểm tra mỗi trò hai câu thoại: đúng tên/ID, bounds, pause, skip và history chỉ ghi winner một lần. Không dùng dịch vụ giọng đọc; lời thoại là bong bóng chữ.

Có role=status, aria-live=polite, aria-atomic; nội dung thay một lần theo hook, không thông báo lặp mỗi frame. 3D giới hạn vị trí trong viewport, nhường thanh điều khiển, ẩn nhãn trùng; 2D có vùng riêng. Mobile thu gọn tên nền để giữ chỗ đọc thoại. Reduced motion tắt animation vào thoại và giữ chi tiết trang trí mới tĩnh.

## Thiết kế và tài nguyên

Áp dụng intentional-visual-design. Chủ đích: thế giới mô hình đồ chơi thân thiện cho lớp học, riêng từng trò; thoại/hành động là chính, chi tiết nền hỗ trợ nhận diện. Có cầu gỗ/hoa/gợn hồ, trạm UFO/phi công/hành tinh, gian máy gắp/mái sọc/bóng bay, đường đua/cờ/cúp/khán đài, đảo cát/di tích/chìa khóa/hạt sáng. Màu và icon HUD riêng; thanh tiến trình phản ánh timeline thật.

Đã xem ảnh desktop 1280×720 của cả 5 trò có thoại và điện thoại 390×844 dạng 2D. Phát hiện tên nền dài chen chú thích/điều khiển, đã sửa còn 4 tên nền trên điện thoại, tăng khoảng cách đuôi thoại và dời thoại 3D sang bên để rõ cảnh. Đã xem ảnh cuối 3D ở 390/768 px; đã chỉnh nền HUD tối hơn trên cảnh sáng và 5/5 trường hợp liên quan pass lại. Bố cục giữ các nút tạm dừng/bỏ qua/dừng, tên tiếng Việt đủ dấu và độ tương phản rõ. Review nội bộ 19/20 theo rubric skill, không có lỗi nghiêm trọng ở các khung đã xem; không coi là chứng nhận accessibility toàn phần.

Geometry/material được cache; chi tiết lặp dùng instancing, biển hiệu CanvasTexture tạo cục bộ, hạt sáng dùng một Points batch. ResourceTracker sở hữu cả texture/material/geometry. Không tạo mesh/texture hoặc animation loop mới mỗi frame. Bộ lifecycle kiểm tra 30 lượt đổi cảnh, geometry, texture và việc gỡ live region thoại.

Fishing gate 80 Low đầu tiên: 79 draw calls, 10 geometries, 70,83 ms/frame (~14,1 FPS) trên dev headless. Đạt giới hạn 150 draw calls; FPS máy trường còn mở. Không diễn giải kết quả này thành cải thiện FPS. Lần đo cuối full suite: 66,943 ms/frame (~14,9 FPS), vẫn 79 draw calls/10 geometries. Geometry qua 30 lượt: 10/7/4/9/7; texture 1/3/2/2/3 tương ứng Fishing/UFO/Claw/Marble/Treasure, không tăng theo lượt; không còn live region thoại sau thoát.

## Dữ liệu / hồi quy

Giữ điểm danh theo lớp/ngày, chỉ loại vắng hôm nay khi gọi; schema v2 đọc v1. Hồ sơ JSON riêng, ảnh copy nguyên bytes, autosave/backup/ETag/atomic write; phục hồi lớp không đổi hồ sơ. Native tests trước phần trang trí pass JSON thật, restart/restore, backup/read-only/conflict/future-schema, MIME/size/reparse/image copy và Host/Origin/token/static isolation.

Full E2E gồm roster, điểm danh, hồ sơ, lưu lỗi, bàn phím/dialog, responsive, nhập HTML, 5 trò, 40 lượt unique, 30 lượt lifecycle, native portable/restart/schema/restore, lời thoại desktop/phone/reduced motion và sửa tên đầu lớp. Gate theo dõi mạng không cho outbound app request.

## Phát hành và giới hạn

Theo yêu cầu mới chỉ build/test/review. Không cập nhật thư mục/ZIP/checksum release hiện có, không dừng ứng dụng người dùng. ZIP 0.5.0 giữ nguyên; hai lần đổi tên gói thử trước yêu cầu này bị Windows từ chối ngay bước đầu, chưa thay chương trình/data. Khi có yêu cầu đóng gói sau này phải chạy gate phù hợp, package:release/verifier và bảo toàn data/ tại chỗ.

Đã dọn fixture portable, test-results và manifest tạm. Build chỉ còn launcher; dist là build phát triển hiện hành. Không xóa hoặc thay data/ trong thư mục phát hành. SHA-256 ZIP 0.5.0 vẫn `1cef2185d81741c53c76e5055ba61e96f631cd8135e48884710de2dbf246dd72`.

Cần QA thực địa: Windows sạch/Edge, USB/disk full, ngắt mạng vật lý, loa/máy chiếu/iGPU, screen reader/cảm ứng. CI chưa chạy remote vì workspace không có Git. Chưa nghiệm thu FPS trên máy trường.
