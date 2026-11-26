# GitHub và bản nháp Windows

Repository: https://github.com/manhle1997/quanlylophoc. Source trên nhánh main; dữ liệu lớp/hồ sơ/ảnh/backup, build và release không được track trong Git.

## Hai workflow độc lập

- **Lop Hoc Vui checks**: chạy trên push/PR, chỉ đọc repository, build/test web và launcher. Không đóng gói hoặc tạo GitHub Release. Các bài test packaging chỉ dùng fixture giả trong build tạm.
- **Prepare Windows release draft**: chỉ chạy khi người có quyền bấm Run workflow trên main. Không chạy do push, PR hoặc tạo tag. Đây là thao tác yêu cầu đóng gói rõ ràng; chưa được chạy trong lần chuẩn bị này.

## Chuẩn bị source

Commit/push workflow mới cùng script kiểm tra version, tests và tài liệu. GitHub chỉ hiện thao tác Run workflow sau khi file manual workflow nằm trên default branch. Đợi CI của commit dự định phát hành hoàn tất trước khi chủ động yêu cầu đóng gói.

Trước khi đổi version, đồng bộ package.json, hai giá trị root trong package-lock.json, public/classquest-version.json, csproj, marker và session API launcher. Hiện test-launcher/portable fixture cũng kiểm tra version cụ thể, cần cập nhật tương ứng. Script check-release-version.mjs từ chối phiên bản lệch hoặc đầu vào không đúng dạng x.y.z; không tự sửa source khi phát hành.

## Khi muốn tạo bản nháp

1. Vào repository → Actions → Prepare Windows release draft → Run workflow.
2. Chọn main, nhập version đúng source, ví dụ 0.5.1. Bấm Run workflow mới bắt đầu đóng gói trên runner Windows.
3. Workflow từ chối tag đã tồn tại, kiểm tra version frontend/launcher/API, chạy lint/unit/build/offline/native/full E2E.
4. Chỉ sau các gate mới chạy package:release rồi verify-release.ps1: ZIP phải khớp bytes build, launcher giải nén phải boot đúng version và không có dữ liệu người dùng.
5. Gói ZIP và checksum được lưu trong Actions artifact 14 ngày. Job riêng có quyền contents:write tạo **draft prerelease** gắn đúng commit đã build. Job build chỉ có contents:read.
6. Vào Releases, kiểm tra bản nháp và ghi chú trước khi tự chọn Publish release. Workflow không tự công bố. Hiện dự án còn gate QA thiết bị thật nên mặc định là Release Candidate/prerelease.

Không cần cung cấp PAT cho workflow: dùng GITHUB_TOKEN ngắn hạn của GitHub ở job tạo draft. Không đưa token vào ứng dụng giáo viên. Giáo viên không cần Node.js/.NET SDK; runner Windows cài các công cụ build và đóng gói launcher self-contained.

## Giới hạn hiện tại

- Workflow mới cần được commit/push; việc kiểm tra cú pháp tại máy không thay thế một lần chạy thực trên GitHub.
- Lần chuẩn bị này không dispatch workflow, không đóng gói hoặc tạo bản nháp/release/tag từ máy hiện tại, không thay gói Windows/data đang dùng.
- Chưa có Updater.exe, chức năng kiểm tra/tải cập nhật trong ứng dụng hoặc chữ ký gói cập nhật. ZIP + checksum hiện phục vụ kiểm tra gói phân phối; không coi checksum là chữ ký xác thực nhà phát hành.
- Draft và prerelease không được endpoint latest stable trả về. Việc đưa bản nào cho giáo viên nhận cập nhật sẽ được xác định ở bước triển khai updater.
- Lần phát hành đầu có updater cần cài/cập nhật thủ công một lần trên máy giáo viên; các lần sau mới có thể cập nhật trong ứng dụng.

CI đã kiểm tra: https://github.com/manhle1997/quanlylophoc/actions/runs/45776699651. Kết quả thực tế trong IMPLEMENTATION_STATUS.md.
