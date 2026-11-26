# Tiến độ Lớp Học Vui

Ngày cập nhật: 2026-11-26. Bản phát triển **0.5.1 — Cập nhật phiên bản, bản quyền và lời thoại trò chơi**. Gói phát hành cục bộ hiện có vẫn là 0.5.0.

## Quy tắc phát hành hiện hành

Theo yêu cầu mới: chỉ đóng gói khi người dùng yêu cầu rõ. Đã dừng việc cập nhật gói; không đổi thư mục hoặc ZIP phát hành. Các thay đổi tiếp theo chỉ build/test/review trong workspace.

Repository đã được người dùng khởi tạo và push lên `https://github.com/manhle1997/quanlylophoc`, nhánh main, commit đầu `e8754d2`. Đã đối chiếu remote với workspace; không có data/release/build/.env được track. CI push/PR không đóng gói; lượt đầu 45776699651 đã hoàn tất thành công cả web và launcher.

Theo yêu cầu mới, lint/test chạy tại local trước push. `ci.yml` chỉ build web và launcher, không cài Playwright hoặc chạy test; launcher job không cài Node/build lại web. `release.yml` chỉ workflow_dispatch trên main, kiểm tra version/tag, build, đóng gói và đối chiếu ZIP/checksum bằng -ArchiveOnly, không boot app hoặc chạy lại test. Tạo draft prerelease ở job riêng, không tự Publish. Đã triển khai updater trong workspace, chưa commit/push/dispatch hoặc đóng gói trong đợt này. Hướng dẫn tại RELEASE_WORKFLOW.md và APPLICATION_UPDATES.md.

Kiểm chứng phần workflow rút gọn: actionlint 1.7.12 pass cả hai workflow; PowerShell parser pass; local 84/84 Vitest, 12 file và build 71 modules pass. Fixture chứng minh -ArchiveOnly không chạy exe giả và từ chối ZIP khác build. Script version có 5 bài test bảo vệ version/đầu vào. Không chạy package:release thật trong workspace; ZIP/data hiện có giữ nguyên.

## Chức năng

- Sửa luồng lần đầu Chơi thử → Quản lý học sinh: tự thoát demo, đọc lại lớp đã lưu và bật autosave. Tạo lớp/thêm học sinh được ghi vào dữ liệu thật; không chép các lớp minh họa vào dữ liệu. Chờ lưu đang chạy trước khi vào demo, lỗi đọc vẫn giữ màn báo lỗi thay vì tạo dữ liệu rỗng.
- Đã dọn 43 ảnh chụp kiểm thử (6,24 MiB) khỏi docs/screenshots. E2E mặc định không chụp ảnh review; chỉ ảnh lỗi nằm trong test-results/ đã ignore. Khi cần review mới bật REVIEW_SCREENSHOTS=1, lưu tạm tại test-results/ và dọn sau khi xem. Avatar/logo/data và asset runtime không thay đổi.
- Cài đặt có kiểm tra/tải/hủy/cài và mở lại. Chỉ thao tác kiểm tra/tải mới kết nối GitHub Releases; lớp học vẫn offline. Gói đã Publish mới được nhận; RC có nhãn Bản thử nghiệm, không nhận draft/cùng version/downgrade. Không cần Node.js/.NET trên máy giáo viên.
- SHA-256 từ GitHub API, URL/redirect giới hạn, ZIP whitelist/bounds/traversal/reparse/PE x64/version; lưu hai kho trước apply. Helper là bản sao launcher, chờ parent thoát, thay program entries tại chỗ, Start.exe nguyên tử có backup, journal, restart/health check/rollback. Không sửa data/.
- Chân trang đúng chữ: Sản phẩm của **July Tech's Team**. Mọi quyền được bảo lưu; hiển thị cả phone/tablet/desktop.
- Giữ Quản lý học sinh, Điểm danh, Gọi lên bảng; hồ sơ giáo viên tự lưu JSON riêng và sao chép ảnh cục bộ.
- Thứ tự nhân vật theo visualSeed, không ghim tên đầu lớp; cùng thứ tự khi 3D→2D, không sửa roster/selection/history.
- Mỗi tình huống hụt có lời thoại riêng theo trò/kind, gắn đúng ID/tên học sinh, ổn định khi pause/recovery và ẩn khi công bố kết quả.
- Bong bóng thoại trên nhân vật 3D, bố trí riêng trong 2D, tên/chữ dùng textContent; có aria-live polite và giảm chuyển động.
- Thêm màu/icon theo trò, tiến trình lượt, chi tiết cảnh tạo bằng code và chuyển động nhẹ. Không có CDN, dịch vụ giọng đọc hoặc asset mạng.

## Milestone / kiểm chứng

- Sau sửa thoát demo: lint và Vite build pass, 74 modules; 89/89 Vitest, 13 file. 32/32 E2E liên quan pass trong 56,5 giây, gồm 4 regression mới về demo/lưu/reload và các gate quản lý/layout/profile/storage/update/game. E2E mặc định không sinh PNG mới. Offline scan pass 17 entries, 817,7 KiB. Không đóng gói.
- 30/30 kiểm tra updater bằng C# pass: lựa chọn release, ZIP độc hại, PE x64, tải/hash hỏng qua transport giả lập, giữ nguyên bytes data, rollback và thông báo phục hồi cũ. Smoke tiến trình thật pass 4 tình huống: thành công, executable hỏng, file bị khóa, health/version sai. Dữ liệu lớp/hồ sơ/ảnh/backup giữ đúng bytes ở mọi tình huống.
- Trước đợt sửa thoát demo: toàn bộ 48/48 E2E pass, không skip, 4,7 phút; gồm 4 test cập nhật, xác nhận/hủy/focus, không outbound frontend, offline và bản quyền tại 390/768/1440. Native API storage/profile/security và .NET publish launcher pass sau tích hợp updater. Đã review giao diện thực tế ở 3 kích thước; ảnh review đã dọn.
- Fishing gate đầu: hai lời thoại, pause/skip và bounds pass; 80 nhân vật Low: 79 draw calls, 10 geometries, 70,83 ms/frame trên dev headless. FPS máy trường vẫn chưa nghiệm thu.
- Đã xem ảnh Fishing có thoại/cầu gỗ/gợn nước trước khi mở rộng 4 trò còn lại.
- Gate trước phần updater: 44/44 E2E pass; sau chỉnh nền HUD, 5/5 desktop/phone/tablet pass lại. Các gate này tiếp tục nằm trong full suite 48 test hiện tại.
- Native portable trong full suite pass: lớp/điểm danh/hồ sơ/ảnh, restart/restore/schema và 5 game. Lifecycle 30 lượt giữ geometry 10/7/4/9/7 và texture 1/3/2/2/3 ổn định, không có live region thoại sót sau thoát.
- Fishing 80 Low ở full suite hiện tại: 73,332 ms/frame (~13,6 FPS), 79 draw calls/10 geometries trên dev headless; chưa nghiệm thu FPS thiết bị trường.
- Đã review giao diện 5 trò có thoại, 2D phone và 3D 390/768: nhãn/nút đủ chỗ, tên tiếng Việt rõ, HUD có nền tối trên cảnh sáng. Ảnh kiểm thử đã được dọn theo phản hồi mới; chỉ giữ mã nguồn/build cần thiết, không lưu ảnh review trong tài liệu.

## Bàn giao / giới hạn

Chưa đóng gói bản phát triển này. Khi người dùng yêu cầu, chạy lại gate cần thiết, package:release và verifier; giữ data/ nguyên tại chỗ, không đưa dữ liệu vào ZIP. Không cần xử lý khóa thư mục phát hành trong giai đoạn phát triển.

QA thiết bị thật còn mở: Windows sạch/Edge, USB/disk full/ngắt mạng vật lý, loa, máy chiếu/iGPU, screen reader/cảm ứng. CI đầu tiên trên GitHub đã pass cả web và launcher; workflow manual mới chỉ được kiểm tra local, chưa push/dispatch. XLSX, gọi nhiều học sinh và báo cáo tần suất vẫn là P1.
