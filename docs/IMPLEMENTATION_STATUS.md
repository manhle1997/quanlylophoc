# Tiến độ Lớp Học Vui

Ngày cập nhật: 2026-11-26. Bản phát triển **0.5.1 — Lời thoại và cảnh trò chơi**. Gói phát hành hiện có vẫn là 0.5.0.

## Quy tắc phát hành hiện hành

Theo yêu cầu mới: chỉ đóng gói khi người dùng yêu cầu rõ. Đã dừng việc cập nhật gói; không đổi thư mục hoặc ZIP phát hành. Các thay đổi tiếp theo chỉ build/test/review trong workspace.

Repository đã được người dùng khởi tạo và push lên `https://github.com/manhle1997/quanlylophoc`, nhánh main, commit đầu `e8754d2`. Đã đối chiếu remote với workspace; không có data/release/build/.env được track. CI push/PR không đóng gói; lượt đầu 45776699651 đã hoàn tất thành công cả web và launcher.

Đã chuẩn bị `.github/workflows/release.yml` trong workspace: chỉ workflow_dispatch trên main, kiểm tra version nguồn, build/test/native/E2E rồi mới đóng gói và smoke ZIP; tạo draft prerelease ở job riêng. Chưa commit/push các thay đổi mới này và chưa dispatch workflow hoặc tạo release/tag. Updater trong ứng dụng chưa triển khai. Hướng dẫn tại RELEASE_WORKFLOW.md.

Kiểm chứng phần workflow: actionlint 1.7.12 pass cả hai workflow; 84/84 Vitest, 12 file; lint/build/offline pass. Script version có 5 bài test, kiểm tra frontend/launcher/API/lock khớp và từ chối đầu vào không hợp lệ. Không chạy package:release thật trong workspace; ZIP/data hiện có giữ nguyên.

## Chức năng

- Giữ Quản lý học sinh, Điểm danh, Gọi lên bảng; hồ sơ giáo viên tự lưu JSON riêng và sao chép ảnh cục bộ.
- Thứ tự nhân vật theo visualSeed, không ghim tên đầu lớp; cùng thứ tự khi 3D→2D, không sửa roster/selection/history.
- Mỗi tình huống hụt có lời thoại riêng theo trò/kind, gắn đúng ID/tên học sinh, ổn định khi pause/recovery và ẩn khi công bố kết quả.
- Bong bóng thoại trên nhân vật 3D, bố trí riêng trong 2D, tên/chữ dùng textContent; có aria-live polite và giảm chuyển động.
- Thêm màu/icon theo trò, tiến trình lượt, chi tiết cảnh tạo bằng code và chuyển động nhẹ. Không có CDN, dịch vụ giọng đọc hoặc asset mạng.

## Milestone / kiểm chứng

- Lint và Vite build pass, 71 modules; 84/84 Vitest, 12 file, gồm 5 test mới bảo vệ version phát hành.
- Fishing gate đầu: hai lời thoại, pause/skip và bounds pass; 80 nhân vật Low: 79 draw calls, 10 geometries, 70,83 ms/frame trên dev headless. FPS máy trường vẫn chưa nghiệm thu.
- Đã xem ảnh Fishing có thoại/cầu gỗ/gợn nước trước khi mở rộng 4 trò còn lại.
- Toàn bộ 44/44 E2E pass, không skip, 4,6 phút; gồm 12 trường hợp lời thoại desktop/2D phone/3D 390/768 và các gate cũ. Sau chỉnh nền HUD: 5/5 trường hợp desktop/phone/tablet pass lại, 40,9 giây.
- Native portable trong full suite pass: lớp/điểm danh/hồ sơ/ảnh, restart/restore/schema và 5 game. Lifecycle 30 lượt giữ geometry 10/7/4/9/7 và texture 1/3/2/2/3 ổn định, không có live region thoại sót sau thoát.
- Build cuối 71 modules; offline scan pass 17 entries, 811,5 KiB. Fishing 80 Low lần cuối 66,943 ms/frame (~14,9 FPS), 79 draw calls/10 geometries; chưa nghiệm thu FPS thiết bị trường.
- Đã review ảnh cuối 5 trò có thoại, 2D phone và 3D 390/768: nhãn/nút đủ chỗ, tên tiếng Việt rõ, HUD có nền tối trên cảnh sáng. Đã dọn fixture/build kiểm thử tạm; chỉ giữ build phát triển, launcher và ảnh review hiện hành.

## Bàn giao / giới hạn

Chưa đóng gói bản phát triển này. Khi người dùng yêu cầu, chạy lại gate cần thiết, package:release và verifier; giữ data/ nguyên tại chỗ, không đưa dữ liệu vào ZIP. Không cần xử lý khóa thư mục phát hành trong giai đoạn phát triển.

QA thiết bị thật còn mở: Windows sạch/Edge, USB/disk full/ngắt mạng vật lý, loa, máy chiếu/iGPU, screen reader/cảm ứng. CI đầu tiên trên GitHub đã pass cả web và launcher; workflow manual mới chỉ được kiểm tra local, chưa push/dispatch. XLSX, gọi nhiều học sinh và báo cáo tần suất vẫn là P1.
