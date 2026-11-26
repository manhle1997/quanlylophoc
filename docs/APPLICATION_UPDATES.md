# Cập nhật phiên bản trong ứng dụng

## Giáo viên sử dụng

Mở **Cài đặt → Phiên bản ứng dụng → Kiểm tra cập nhật** khi có Internet. Nếu có bản mới, chọn **Tải bản mới**, sau đó **Cài đặt và mở lại**. Có xác nhận trước khi ứng dụng lưu dữ liệu và khởi động lại. Có thể hủy bước kiểm tra/tải; gói sẵn sàng chưa tự cài. Lớp học vẫn dùng được khi không có Internet.

Không phải cài Node.js, Git hay .NET: nhận bản Windows x64 đã build, launcher là self-contained. Bản cũ chưa có chức năng này cần nâng cấp thủ công một lần, giữ nguyên thư mục `data/` cạnh `Start.exe`.

Chân trang sử dụng đúng tên: Sản phẩm của **July Tech's Team**. Mọi quyền được bảo lưu

## Người phát hành

Nguồn cố định: repository public `manhle1997/quanlylophoc`. Cập nhật theo **Release đã Publish**, không theo mỗi commit, tag đơn thuần, Actions artifact hay draft. Bộ chọn lấy version số cao nhất lớn hơn bản đang dùng, so sánh từng số x.y.z; không cài lại cùng bản hoặc downgrade. Prerelease đã Publish cũng được nhận vì dự án hiện phát hành RC; giao diện ghi rõ **Bản thử nghiệm** trước khi tải/cài.

Đồng bộ version nguồn theo RELEASE_WORKFLOW.md, kiểm thử local, push rồi chạy workflow thủ công khi muốn đóng gói. Gói phải mang tên `Lop-Hoc-Vui-x.y.z-rc-win-x64.zip`, tag `vx.y.z`, có đúng một asset uploaded và digest `sha256:` hợp lệ trong GitHub API. Workflow hiện có đã tạo đúng tên, không cần thêm Updater.exe riêng vào ZIP: launcher hiện tại tự sao chép thành helper khi cài. Kiểm tra bản nháp rồi Publish để người dùng có thể tìm thấy. Chỉ push code hoặc build CI chưa tạo bản cập nhật.

## Luồng và giới hạn

1. Frontend chỉ gọi API loopback có token; mở app/Cài đặt không gọi GitHub. POST check bắt đầu công việc nền trong launcher, frontend đọc tiến độ cục bộ. Không gửi hồ sơ, roster, backup, token phiên hoặc đường dẫn máy ra ngoài.
2. Launcher đọc tối đa 100 Release gần nhất, metadata tối đa 4 MiB; không cần PAT. Chỉ cho phép URL asset thuộc repository cố định và các redirect HTTPS tới host tải asset GitHub được chỉ định. Không nhận URL/path từ client. Mất mạng, rate limit hoặc sai metadata báo lỗi, giữ app hiện tại.
3. ZIP tối đa 256 MiB; kiểm tra số bytes và SHA-256 từ metadata GitHub trước giải nén. Từ chối ZIP vượt 10.000 entries/512 MiB giải nén, traversal, ADS, symlink/reparse, tên Windows nguy hiểm, đường dẫn trùng không phân biệt hoa thường, root lạ, dữ liệu người dùng và version marker sai. Kiểm tra header executable PE32+ x64 trước khi gọi Windows loader. Chỉ nhận program entries đã định trước; data/backups trống trong gói không được cài vào thư mục dữ liệu.
4. Trước cài, frontend chờ autosave lớp và hồ sơ, chặn nếu còn upload hoặc lưu lỗi. Hộp thoại giữ việc sửa trong cửa sổ hiện tại trong lúc lưu/cài. Launcher tạo manifest từ PID/start time/port/version nội bộ và sao chép executable hiện tại thành helper trong `.updates/<id>/`.
5. Helper chờ đúng tiến trình cũ thoát, không force-kill ứng dụng người dùng. Mutex chống helper trùng và tránh thay file khi instance cũ đang chạy. Ghi journal với Flush(true), chuyển các entry chương trình cũ vào vùng phục hồi, đưa bản mới vào vị trí cũ; Start.exe thay cuối bằng File.Replace có backup. Giữ nguyên thư mục cài đặt và toàn bộ `data/`.
6. Khởi động lại ở cùng cổng, kiểm tra marker và session version. Tab trình duyệt cũ chờ token phiên đổi rồi tải lại. Nếu cài/khởi động lỗi, khôi phục chương trình và mở lại bản cũ; nếu mất điện giữa lúc thay entry, lần chạy launcher tiếp theo đọc journal để khôi phục. Lỗi phục hồi giữ lại journal/previous để xử lý, không xóa dữ liệu. Nếu Start.exe bị thiếu do thiết bị hỏng/mất điện, có thể cần chép lại chương trình thủ công và giữ data tại chỗ.
7. Bản sao helper/ZIP còn lại được dọn khi mở app lần sau, sau khi helper thoát. `.updates/result.json` ghi kết quả thành công/rollback; không chứa dữ liệu giáo viên.

SHA-256 bảo vệ tính toàn vẹn gói tải qua GitHub/HTTPS; **không phải chữ ký Authenticode hoặc chữ ký nhà phát hành độc lập**. Quyền phát hành của repository là nguồn tin cậy. Cần QA Windows sạch, proxy thực tế, USB, hết dung lượng và ngắt điện vật lý trước khi phát hành rộng.

## Kiểm thử local

`npm test` có các kiểm thử chặn cài khi lưu lỗi/upload, thứ tự lưu → apply → reconnect và chống bấm lặp. `dotnet run --project tests/launcher-updates/LauncherUpdates.csproj -- build/update-tests-local` kiểm tra lựa chọn Release, ZIP, tải/hash qua transport giả lập, bảo toàn bytes và rollback. Dùng thư mục fixture mới nếu chạy lại; dọn fixture trong build sau kiểm tra.

`powershell -NoProfile -File scripts/test-updater.ps1` chạy launcher/helper thật trong fixture cổng 17846: thành công, executable mới hỏng, file chương trình bị khóa và bản mới khởi động với version sai cần rollback. Chỉ dừng tiến trình nằm trong fixture. `tests/e2e/updates.spec.js` bao phủ giao diện 390/768/1440, tên bản quyền, xác nhận/hủy, focus, không outbound từ frontend và lỗi offline. Không chạy các test này trên CI theo yêu cầu hiện tại.
