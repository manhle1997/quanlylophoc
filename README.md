# Lớp Học Vui — bản phát triển 0.5.1

Ứng dụng offline gồm ba phân hệ: **Quản lý học sinh**, **Điểm danh**, **Gọi lên bảng** qua 5 mini game 3D. Giáo viên mở ứng dụng, tạo lớp và thêm học sinh; hệ thống tự đọc, lưu và sao lưu dữ liệu. Lịch sử và Cài đặt là tiện ích phụ.

Giao diện theo hướng **Sổ lớp số**: nền sáng, màu chủ đạo theo giáo viên, bảng học sinh và công việc theo lớp; tự bố trí lại cho tablet/điện thoại. Bản 0.5 thêm tab **Thông tin cá nhân**: tên giáo viên/trường, môn dạy/chức vụ, email, điện thoại, ảnh đại diện, logo và màu ứng dụng. Hồ sơ tự lưu trong một JSON riêng; ảnh được sao chép nguyên bytes vào `data/`, không phụ thuộc file gốc. Xem [hồ sơ cá nhân](docs/PERSONAL_PROFILE.md) và [định hướng thiết kế](docs/DESIGN_DIRECTION.md).

Điểm danh có bốn trạng thái, lưu riêng theo lớp/ngày trong schema v2. Gọi lên bảng chỉ loại các bạn vắng có phép hoặc không phép **hôm nay theo giờ Việt Nam**, kể cả khi đang xem một ngày lịch sử khác. Schema v1 được tự đọc và nâng cấp khi lưu, giữ ID, danh sách, lịch sử, cài đặt và vòng không trùng; launcher sao lưu nguyên bản trước khi thay thế.

Bản Windows đã phát hành vẫn là `release/ClassQuest-0.5.0/ClassQuest/Start.exe`; ZIP `release/Lop-Hoc-Vui-0.5.0-rc-win-x64.zip`. Các thay đổi 0.5.1 hiện ở mã nguồn/build phát triển, chưa nằm trong gói đó. Theo yêu cầu người dùng, chỉ đóng gói khi được yêu cầu rõ. Gói phân phối không chứa dữ liệu học sinh, hồ sơ hoặc ảnh cá nhân.

Xem [tự lưu](docs/AUTOMATIC_STORAGE.md) và [điểm danh theo ngày](docs/DAILY_ATTENDANCE.md).

Source đã có trên GitHub; lint/test chạy tại local, CI push/PR chỉ build web và launcher. Workflow tạo bản nháp Windows chỉ chạy qua Run workflow: build, đóng gói, đối chiếu ZIP/checksum và không tự công bố; không chạy lại test trên GitHub. Xem [quy trình GitHub/phát hành thủ công](docs/RELEASE_WORKFLOW.md).

Trong **Cài đặt → Phiên bản ứng dụng**, giáo viên có thể kiểm tra, tải bản mới và chọn **Cài đặt và mở lại**. Chỉ thao tác kiểm tra/tải mới kết nối GitHub Releases; các chức năng lớp học vẫn hoạt động ngoại tuyến. Không cần Node.js hoặc cài .NET. Bộ cập nhật kiểm tra SHA-256, giữ nguyên `data/`, thay chương trình và quay lại bản trước nếu cài/khởi động lỗi. Bản thử nghiệm được ghi rõ; bản nháp chưa Publish không được cung cấp. Lần đầu cần nhận gói có bộ cập nhật bằng cách thủ công. Chi tiết tại [cập nhật ứng dụng](docs/APPLICATION_UPDATES.md).

Chân trang hiển thị: Sản phẩm của **July Tech's Team**. Mọi quyền được bảo lưu

Bản 0.5.1 sửa việc tên học sinh đầu lớp luôn được ưu tiên hiển thị trong trò chơi. Thứ tự nhân vật/nhãn được xáo theo từng lượt trên cả 5 scene và 2D; không thay thứ tự danh sách lớp hoặc kết quả chọn theo ID.

Mỗi lần hụt có bong bóng thoại ngắn theo nhân vật và trò chơi, áp dụng cả 3D/2D. Năm cảnh thêm chi tiết, chuyển động nhẹ, màu/icon riêng và thanh tiến trình lượt. Xem [thiết kế trò chơi](docs/GAME_PRESENTATION.md).

Sau **Chơi thử**, bấm **Quản lý học sinh** hoặc **Về lớp của tôi** để tự mở lại lớp đã lưu, tạo lớp/thêm học sinh và bật lại lưu tự động; danh sách minh họa không được đưa vào dữ liệu thật.

## Dành cho người phát triển

Node 20.19+, 22.13+ hoặc 24+ và .NET SDK 10. Người sử dụng gói portable không cần cài các công cụ này.

```sh
npm ci
npm run lint
npm run build
npm run test
npm run verify:offline
dotnet publish launcher/ClassQuest.Launcher/ClassQuest.Launcher.csproj -c Release -r win-x64 --self-contained true -o build/launcher
node scripts/test-launcher.mjs
dotnet run --project tests/launcher-updates/LauncherUpdates.csproj -- build/update-tests-local
powershell -NoProfile -File scripts/test-updater.ps1
npm run test:e2e
```

Chỉ khi người dùng yêu cầu đóng gói, chạy tiếp:

```sh
npm run package:release
powershell -NoProfile -File scripts/verify-release.ps1
```

Launcher mặc định bind 127.0.0.1:17843. Vite dev/preview proxy `/api` đến launcher; hãy chạy launcher cùng bộ app đã build khi phát triển. Có thể chạy Vite bằng `npm run dev` sau đó. E2E giao diện dùng mock persistence; native E2E tạo bản app/file fixture riêng và chạy launcher thật ở 17844 để không đụng vào phiên người dùng đang mở. Ghi/đọc API kiểm tra Host, Origin, token phiên và ETag.

E2E mặc định chỉ lưu ảnh khi test lỗi trong `test-results/` đã ignore. Ảnh review không thuộc mã nguồn hoặc gói ứng dụng; chỉ khi cần xem giao diện mới bật `REVIEW_SCREENSHOTS=1` cho test liên quan, lưu tạm vào cùng thư mục và dọn sau khi xem. Không ghi ảnh review vào `docs/` hoặc Git.

JSON là nguồn dữ liệu chính. Không ghi dữ liệu học sinh thật vào Git, fixture hoặc ảnh. Kết quả được chọn theo ID trước animation; scene không quyết định winner hoặc ghi lịch sử. Tên nội bộ ClassQuest, API token header và vị trí dữ liệu được giữ để tương thích các bản cũ.

Khi được yêu cầu, packaging đổi tên chính thư mục phát hành và ZIP hiện có theo version mới, cập nhật chương trình/ZIP/checksum và giữ nguyên `data/` tại chỗ. Không tạo thêm thư mục phiên bản song song; chỉ lần phát hành đầu mới tạo thư mục. ZIP chỉ chứa chương trình và thư mục backup trống. Nếu cập nhật lỗi, hoàn tác tên và nội dung chương trình. Cùng version hoặc downgrade bị từ chối để bảo vệ bản đang dùng.

Sau khi xác minh bản mới, dọn build/fixture tạm và tài liệu lỗi thời, chỉ giữ bản hiện hành. Dữ liệu lớp học và backup được bảo toàn; `data/` không được phục vụ static.

Đây vẫn là release candidate: cần QA Windows sạch, USB, loa và máy chiếu/iGPU. Không khởi chạy một gói mới trống rồi xem đó là cập nhật dữ liệu: giữ nguyên `data/` cạnh launcher khi nâng cấp; không xóa hoặc ghi đè dữ liệu này.

Xem [hướng dẫn giáo viên](docs/USER_GUIDE_VI.md), [kiến trúc](docs/ARCHITECTURE.md), [tiến độ](docs/IMPLEMENTATION_STATUS.md) và [kiểm thử](docs/TEST_REPORT.md).

