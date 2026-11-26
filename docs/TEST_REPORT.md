# Kiểm thử Lớp Học Vui — bản phát triển 0.5.1

2026-11-26, Windows x64, Node 20.19.6, .NET SDK 10.0.401, Chromium 159. Chỉ dùng nhân vật và dữ liệu giả trong kiểm thử/ảnh. Gói phát hành vẫn là 0.5.0; không đóng gói khi chưa được người dùng yêu cầu.

## Gate hiện tại

| Gate | Kết quả |
|---|---|
| Lint | Pass, không lỗi/cảnh báo |
| Vitest | 89/89, 13 file |
| Vite build | Pass, 74 modules |
| Static offline | Pass, 17 entries, 817,7 KiB sau sửa thoát demo |
| Native storage/profile/security | Pass sau tích hợp updater; fixture riêng, dữ liệu giả |
| Updater native | 30/30 kiểm tra C#; tiến trình thật pass 4 tình huống cài/rollback |
| Fishing gate trước mở rộng | 2/2 E2E pass, 20,7 giây; dialogue + 80 nhân vật Low |
| 5 scene/dialogue/mobile 2D tập trung | 11/11 pass, 1,7 phút trước tinh chỉnh bố cục cuối |
| Full suite trước sửa thoát demo | 48/48 pass, không skip, 4,7 phút |
| Hồi quy sau sửa thoát demo | 32/32 pass, 56,5 giây; gồm 4 regression mới và các luồng quản lý/game/layout/storage/profile/update |
| Sau chỉnh nền HUD | 5/5 desktop/phone/tablet pass, 40,9 giây |
| Packaging | Không thực hiện theo yêu cầu người dùng |
| Workflow local | actionlint 1.7.12 pass cấu hình build-only; version check CLI + 5 tests pass; ArchiveOnly fixture pass |

## Thoát chơi thử và quản lý ảnh kiểm thử

Đã tái hiện trên build cũ: từ lần mở đầu, Chơi thử → Quản lý học sinh vẫn dùng store.demo và autosave bị tắt. Nay điều hướng Quản lý học sinh tự đọc lại dữ liệu thật và bật autosave; không nhập các lớp minh họa. Về lớp của tôi giữ cùng hành vi. Vào demo chờ xong lần lưu đang chạy trước khi thay document. Lỗi đọc khi thoát demo hiển thị lỗi và không ghi đè bằng danh sách rỗng.

Thêm regression desktop/phone cho tạo lớp, thêm học sinh sau demo rồi reload còn nguyên dữ liệu; đọc thay đổi từ cửa sổ khác mà không ghi lại các lớp demo; lỗi đọc và thử lại. Bài nhập hàng loạt nay kiểm tra dữ liệu thật và reload 40 học sinh, giữ hai ID/tên trùng. Test bàn phím theo nút Tạo lớp đầu tiên sau khi thoát demo.

Kết quả đợt này: lint/build pass, 89/89 Vitest và 32/32 E2E liên quan pass, 56,5 giây. Offline scan 17 entries/817,7 KiB. Sau lượt E2E mặc định không có PNG mới trong docs hoặc test-results; các ảnh lỗi tạm từ lượt tái hiện được dọn. Full suite gần nhất trước đợt sửa là 48/48; chưa chạy lại toàn bộ 52 test sau thêm regression, không diễn giải 32 test liên quan thành full suite.

Đã xóa 43 ảnh generated trong docs/screenshots (6,24 MiB). Mọi captureReview mặc định không chụp; chỉ khi bật REVIEW_SCREENSHOTS=1 mới ghi vào test.info().outputPath ở test-results/ đã ignore, rồi dọn sau review. Chỉ ảnh lỗi được Playwright tự chụp mặc định tại test-results/. Không xóa avatar/logo/data hay asset ứng dụng. Các lần review giao diện ghi trong báo cáo là kiểm tra đã thực hiện; không cần giữ PNG trong repository làm bằng chứng chạy ứng dụng.

## Cập nhật và bản quyền

Đã triển khai check/download/cancel/apply trong Cài đặt, không tự gọi GitHub khi mở app hoặc mở Cài đặt. Chỉ nhận Release Publish từ repo cố định; version so sánh số, RC có nhãn Bản thử nghiệm, bỏ draft/cùng bản/downgrade. Dữ liệu lớp/hồ sơ/token/đường dẫn không gửi ra ngoài.

5 Vitest mới kiểm tra việc không kết nối khi khởi tạo, chỉ đọc status cục bộ, chặn apply khi lưu lỗi/upload, chờ lưu trước apply/reconnect và chống bấm trùng. Native C# kiểm tra đường dẫn/ZIP độc hại, digest/metadata/version, tải qua transport giả lập và SHA-256 hỏng, header PE32+ x64, thay program entries, giữ nguyên bytes data/hồ sơ/ảnh/backup, rollback và recovery journal. Các fixture nằm trong build, không dùng dữ liệu thật.

Smoke launcher/helper thật pass 4 tình huống tại cổng 17846: cài thành công, executable mới hỏng, app/index.html bị khóa và launcher chạy nhưng session version khác target. Chờ parent thoát trước thay file; sai health dẫn đến quay lại bản cũ. Tất cả file lớp, hồ sơ, ảnh, backup lớp và backup hồ sơ giữ nguyên checksum. Tệp Start.exe thay bằng File.Replace có backup; journal Flush(true). Từ chối executable hỏng trước Windows loader; dọn helper đang khóa được hoãn đến lần mở tiếp theo.

4 E2E mới pass ở 390/768/1440: kiểm tra → tải → sẵn sàng, nhãn RC, xác nhận/hủy không apply, trả focus đúng nút, lỗi offline vẫn mở được Quản lý học sinh, bản quyền đúng nguyên văn và không overflow/outbound. Đã xem ảnh thật desktop/tablet/phone: đúng typography/palette hiện có, nút rõ, copyright đủ chữ; review nội bộ đạt gate skill, không có lỗi nghiêm trọng ở các kích thước đã xem. Full suite 48 test pass, gồm portable/native, game lifecycle và các module cũ.

Chưa có Release mới để thử tải trực tiếp từ GitHub. Network/download dùng transport giả lập với code production; cài/rollback dùng tiến trình Windows thật. Không package, không Publish/dispatch hoặc thay gói/data hiện hành. SHA-256 không được xem là chữ ký nhà phát hành. Chi tiết tại APPLICATION_UPDATES.md.

## GitHub và phát hành thủ công

Đã xác nhận repository public manhle1997/quanlylophoc, main tại e8754d2 khớp remote và workspace. Không track data/release/build/.env. Lượt CI đầu tiên 45776699651 đã completed/success, cả launcher và web pass.

Theo yêu cầu người dùng, test/lint chạy local; CI chỉ build web và launcher. Release không chạy lint/unit/E2E/native test, không cài Playwright và không buộc một lượt CI test thành công. Chỉ nhận workflow_dispatch trên main, đầu vào x.y.z khớp source, từ chối tag đã có, build/package/đối chiếu ZIP rồi tạo draft prerelease. Build job chỉ contents:read, draft job riêng contents:write. Cấu hình rút gọn hiện ở local, chưa commit/push/dispatch; không tự Publish release.

verify-release.ps1 thêm -ArchiveOnly: kiểm tra checksum, tên và bytes của ZIP so với build rồi thoát trước bước kiểm tra cổng/giải nén/khởi động. Test fixture có exe giả vẫn pass ArchiveOnly (không khởi chạy), sau khi đổi dist/index.html thì bị từ chối. Script không kèm switch vẫn giữ smoke đầy đủ cho local. Đã chạy 84/84 test và build tại local sau thay đổi này.

Năm test mới kiểm tra nguồn đồng nhất, đầu vào thiếu/v-prefix/leading zero/path/newline/shell-like, yêu cầu version chưa có trong source, launcher/API/frontend cũ và version source thật. Đã chạy CLI với 0.5.1 thành công, không tạo gói. Đã tải actionlint từ release chính thức và đối chiếu checksum trước khi kiểm tra YAML; công cụ tạm được dọn. Chi tiết thao tác tại RELEASE_WORKFLOW.md.

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

Fishing gate 80 Low đầu tiên: 79 draw calls, 10 geometries, 70,83 ms/frame (~14,1 FPS) trên dev headless. Đạt giới hạn 150 draw calls; FPS máy trường còn mở. Không diễn giải kết quả này thành cải thiện FPS. Lần đo full suite 48 test hiện tại: 73,332 ms/frame (~13,6 FPS), vẫn 79 draw calls/10 geometries; smoke updater chạy song song nên không dùng số này làm benchmark so sánh hiệu năng. Geometry qua 30 lượt: 10/7/4/9/7; texture 1/3/2/2/3 tương ứng Fishing/UFO/Claw/Marble/Treasure, không tăng theo lượt; không còn live region thoại sau thoát.

## Dữ liệu / hồi quy

Giữ điểm danh theo lớp/ngày, chỉ loại vắng hôm nay khi gọi; schema v2 đọc v1. Hồ sơ JSON riêng, ảnh copy nguyên bytes, autosave/backup/ETag/atomic write; phục hồi lớp không đổi hồ sơ. Native tests trước phần trang trí pass JSON thật, restart/restore, backup/read-only/conflict/future-schema, MIME/size/reparse/image copy và Host/Origin/token/static isolation.

Full E2E gồm roster, điểm danh, hồ sơ, lưu lỗi, bàn phím/dialog, responsive, nhập HTML, 5 trò, 40 lượt unique, 30 lượt lifecycle, native portable/restart/schema/restore, lời thoại desktop/phone/reduced motion và sửa tên đầu lớp. Gate theo dõi mạng không cho outbound app request.

## Phát hành và giới hạn

Theo yêu cầu mới chỉ build/test/review. Không cập nhật thư mục/ZIP/checksum release hiện có, không dừng ứng dụng người dùng. ZIP 0.5.0 giữ nguyên; hai lần đổi tên gói thử trước yêu cầu này bị Windows từ chối ngay bước đầu, chưa thay chương trình/data. Khi có yêu cầu đóng gói sau này phải chạy gate phù hợp, package:release/verifier và bảo toàn data/ tại chỗ.

Đã dọn fixture portable, test-results và manifest tạm. Build chỉ còn launcher; dist là build phát triển hiện hành. Không xóa hoặc thay data/ trong thư mục phát hành. SHA-256 ZIP 0.5.0 vẫn `1cef2185d81741c53c76e5055ba61e96f631cd8135e48884710de2dbf246dd72`.

Cần QA thực địa: Windows sạch/Edge, USB/disk full, ngắt mạng vật lý, loa/máy chiếu/iGPU, screen reader/cảm ứng. CI đầu tiên trên GitHub đã pass web và launcher; workflow manual mới chưa được chạy thực. Chưa nghiệm thu FPS trên máy trường.
