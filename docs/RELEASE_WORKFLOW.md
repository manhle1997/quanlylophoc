# GitHub và bản nháp Windows

Repository: https://github.com/manhle1997/quanlylophoc. Source trên nhánh main; dữ liệu lớp/hồ sơ/ảnh/backup, build và release không được track trong Git.

## Hai workflow độc lập

- **Lop Hoc Vui build**: chạy trên push/PR, chỉ đọc repository, build web bằng Node.js và launcher bằng .NET. Không chạy lint/unit/E2E/native test, không cài Playwright, không đóng gói hoặc tạo GitHub Release.
- **Prepare Windows release draft**: chỉ chạy khi người có quyền bấm Run workflow trên main. Không chạy do push, PR hoặc tạo tag. Đây là thao tác yêu cầu đóng gói rõ ràng; chưa được chạy trong lần chuẩn bị này.

## Chuẩn bị source

Chạy lint/test phù hợp tại local trước khi commit/push. GitHub chỉ hiện thao tác Run workflow sau khi file manual workflow nằm trên default branch. CI trên GitHub chỉ xác nhận source build được; không lặp lại bộ test local. Workflow release không bắt buộc một lượt CI test thành công trước khi chạy.

**Chỉ `version` trong `package.json` quyết định phiên bản ứng dụng.** Khi chuẩn bị phát hành, sửa giá trị x.y.z tại đây hoặc chạy `npm version patch --no-git-tag-version` để tăng bản vá; npm tự cập nhật metadata tương ứng trong package-lock.json. Không cần tăng version sau mỗi lần sửa code, chỉ khi muốn phát hành bản mới. Không sửa tay version trong launcher, marker hoặc test.

Vite tự tạo dist/classquest-version.json khi build; không còn file version phải đồng bộ trong public/. MSBuild đọc package.json khi build .NET (không cần Node), version API/console/updater lấy từ assembly đã build. Giao diện đọc version API; fixture phụ thuộc version hiện hành tự đọc package.json. Script check-release-version.mjs lấy tag/tên ZIP từ cùng nguồn. Metadata root version trong lockfile do npm quản lý, không phải nguồn version của app; nếu sửa package.json trực tiếp thì build/release vẫn đọc đúng giá trị tại đó.

Commit/push thay đổi lên main rồi tạo lượt Run workflow mới; Re-run của lượt cũ vẫn dùng commit cũ. Ô version là tùy chọn: để trống tự dùng package.json; nếu nhập thì phải khớp, nhằm bắt lỗi gõ nhầm. Nhập version trên GitHub không sửa mã nguồn.

## Khi muốn tạo bản nháp

1. Vào repository → Actions → Prepare Windows release draft → Run workflow.
2. Chọn main, để trống version để dùng package.json rồi bấm Run workflow. Chỉ thao tác này mới bắt đầu đóng gói trên runner Windows.
3. Workflow xác thực version nguồn, từ chối tag đã tồn tại, build web và launcher cùng version từ package.json. Không chạy lại lint/unit/E2E/native test trên GitHub.
4. Chạy package:release rồi verify-release.ps1 -ArchiveOnly: ZIP phải khớp bytes build, checksum/tên gói đúng và không có file dữ liệu người dùng. Chế độ này không khởi chạy ứng dụng hoặc test. Smoke khởi động đầy đủ vẫn có thể chạy ở local bằng verify-release.ps1 không kèm switch.
5. Gói ZIP và checksum được lưu trong Actions artifact 14 ngày. Job riêng có quyền contents:write tạo **draft prerelease** gắn đúng commit đã build. Job build chỉ có contents:read.
6. Vào Releases, kiểm tra bản nháp và ghi chú trước khi tự chọn Publish release. Workflow không tự công bố. Hiện dự án còn gate QA thiết bị thật nên mặc định là Release Candidate/prerelease.

Không cần cung cấp PAT cho workflow: dùng GITHUB_TOKEN ngắn hạn của GitHub ở job tạo draft. Không đưa token vào ứng dụng giáo viên. Giáo viên không cần Node.js/.NET SDK; runner Windows cài các công cụ build và đóng gói launcher self-contained.

## Giới hạn hiện tại

- Workflow mới cần được commit/push; việc kiểm tra cú pháp tại máy không thay thế một lần chạy thực trên GitHub.
- Lần chuẩn bị này không dispatch workflow, không đóng gói hoặc tạo bản nháp/release/tag từ máy hiện tại, không thay gói Windows/data đang dùng.
- Có chức năng kiểm tra/tải/cài trong Cài đặt. Không cần ship Updater.exe riêng: launcher tự sao chép thành helper khi cài. Chưa có chữ ký Authenticode hoặc chữ ký gói độc lập; không coi checksum là chữ ký nhà phát hành.
- Updater dùng danh sách Releases, nhận bản Publish có version cao nhất (kể cả prerelease được ghi rõ Bản thử nghiệm); bỏ draft, cùng version và downgrade. ZIP phải có digest SHA-256 GitHub hợp lệ. Không chỉ dùng endpoint latest stable vì dự án hiện phát hành RC. Xem [APPLICATION_UPDATES.md](APPLICATION_UPDATES.md).
- Lần phát hành đầu có updater cần cài/cập nhật thủ công một lần trên máy giáo viên; các lần sau mới có thể cập nhật trong ứng dụng.

CI đã kiểm tra: https://github.com/manhle1997/quanlylophoc/actions/runs/45776699651. Kết quả thực tế trong IMPLEMENTATION_STATUS.md.
