using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

// A separate document: restoring a class snapshot never replaces the teacher's identity.
internal sealed class ProfileStore(string baseDirectory)
{
    public const int MaxImageBytes = 8 * 1024 * 1024;
    private readonly string directory = Path.Combine(baseDirectory, "data");
    private readonly SemaphoreSlim gate = new(1, 1);
    private string MainFile => Path.Combine(directory, "user-profile.json");
    private string Images => Path.Combine(directory, "profile-images");
    private string Backups => Path.Combine(directory, "profile-backups");
    private static readonly Regex ImageId = new(@"\A[a-f0-9]{64}\.(png|jpg|webp|gif)\z");
    private static string Hash(byte[]? bytes) => bytes is null ? "missing" : Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    private static void Safe(string path)
    {
        try { if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) throw new StorageIssue("UNSAFE_LOCATION", "Không thể truy cập nơi lưu hồ sơ. Hãy nhờ người hỗ trợ kiểm tra ứng dụng.", 503); }
        catch (FileNotFoundException) { } catch (DirectoryNotFoundException) { }
    }
    private async Task<byte[]?> Read()
    {
        Safe(directory); Safe(MainFile);
        try { if (new FileInfo(MainFile).Length > 32 * 1024) throw new StorageIssue("PROFILE_INVALID", "Hồ sơ quá lớn để mở an toàn."); return await File.ReadAllBytesAsync(MainFile); }
        catch (FileNotFoundException) { return null; } catch (DirectoryNotFoundException) { return null; }
    }
    private static JsonObject Validate(JsonNode? node)
    {
        if (node is not JsonObject profile) throw new StorageIssue("PROFILE_INVALID", "Thông tin cá nhân chưa hợp lệ.");
        if (profile["schemaVersion"]?.GetValue<int>() is > 1) throw new StorageIssue("FUTURE_SCHEMA", "Hồ sơ được tạo bởi phiên bản mới hơn. Hãy mở bằng ứng dụng mới nhất.");
        if (profile["schemaVersion"]?.GetValue<int>() != 1) throw new StorageIssue("PROFILE_INVALID", "Phiên bản hồ sơ chưa hợp lệ.");
        var fields = new Dictionary<string, int> { ["teacherName"] = 120, ["schoolName"] = 200, ["subject"] = 120, ["email"] = 160, ["phone"] = 40 };
        var result = new JsonObject { ["schemaVersion"] = 1 };
        foreach (var (key, max) in fields)
        {
            var value = profile[key]?.GetValue<string>();
            if (value is null || value.Length > max || value.Any(char.IsControl)) throw new StorageIssue("PROFILE_INVALID", "Thông tin cá nhân quá dài hoặc chứa ký tự chưa hợp lệ.");
            result[key] = value;
        }
        var color = profile["accentColor"]?.GetValue<string>() ?? "";
        if (!Regex.IsMatch(color, @"\A#[a-fA-F0-9]{6}\z")) throw new StorageIssue("PROFILE_INVALID", "Màu ứng dụng chưa hợp lệ.");
        result["accentColor"] = color.ToLowerInvariant();
        foreach (var key in new[] { "avatar", "schoolLogo" })
        {
            var value = profile[key]?.GetValue<string>();
            if (value is not null && !ImageId.IsMatch(value)) throw new StorageIssue("PROFILE_INVALID", "Ảnh trong hồ sơ chưa hợp lệ.");
            result[key] = value;
        }
        return result;
    }
    private static JsonObject Parse(byte[] bytes) => Validate(JsonNode.Parse(Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF')));
    public async Task<object> Load()
    {
        await gate.WaitAsync();
        try { var bytes = await Read(); return new { profile = bytes is null ? null : Parse(bytes), etag = Hash(bytes) }; }
        finally { gate.Release(); }
    }
    public async Task<object> Save(JsonObject input, string expectedEtag)
    {
        var profile = Validate(input);
        await gate.WaitAsync();
        try
        {
            var previous = await Read(); var current = previous is null ? null : Parse(previous);
            if (Hash(previous) != expectedEtag)
            {
                if (JsonNode.DeepEquals(current, profile)) return new { profile = current, etag = Hash(previous) };
                throw new StorageIssue("CONFLICT", "Hồ sơ đã thay đổi ở cửa sổ khác. Nội dung đang sửa được giữ lại; hãy tải lại hồ sơ trước khi tiếp tục.", 409);
            }
            foreach (var key in new[] { "avatar", "schoolLogo" })
                if (profile[key]?.GetValue<string>() is string id) { Safe(directory); Safe(Images); var file = Path.Combine(Images, id); Safe(file); if (!File.Exists(file)) throw new StorageIssue("IMAGE_MISSING", "Ảnh chưa được sao chép. Hãy chọn lại ảnh."); }
            var bytes = Encoding.UTF8.GetBytes(profile.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
            if (current is not null && JsonNode.DeepEquals(current, profile)) return new { profile = current, etag = Hash(previous) };
            Safe(directory); Directory.CreateDirectory(directory); Safe(Backups); Directory.CreateDirectory(Backups);
            if (previous is not null) await WriteNew(Path.Combine(Backups, $"profile-{DateTime.UtcNow:yyyyMMddTHHmmssfffffffZ}-{Guid.NewGuid():N}.json"), previous);
            var temp = Path.Combine(directory, $".profile-{Guid.NewGuid():N}.tmp");
            try { await WriteNew(temp, bytes); Safe(MainFile); File.Move(temp, MainFile, true); if (Hash(await Read()) != Hash(bytes)) throw new StorageIssue("VERIFY_FAILED", "Chưa xác nhận được lần lưu hồ sơ. Hãy thử lại.", 503); }
            finally { if (File.Exists(temp)) File.Delete(temp); }
            try { foreach (var old in Directory.EnumerateFiles(Backups, "profile-*.json").OrderByDescending(Path.GetFileName).Skip(20)) { Safe(old); File.Delete(old); } }
            catch (IOException) { } catch (UnauthorizedAccessException) { }
            return new { profile, etag = Hash(bytes) };
        }
        finally { gate.Release(); }
    }
    private static async Task WriteNew(string file, byte[] bytes)
    {
        await using (var stream = new FileStream(file, FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, FileOptions.Asynchronous | FileOptions.WriteThrough)) { await stream.WriteAsync(bytes); await stream.FlushAsync(); stream.Flush(true); }
        if (Hash(await File.ReadAllBytesAsync(file)) != Hash(bytes)) throw new StorageIssue("VERIFY_FAILED", "Chưa xác nhận được bản sao hồ sơ. Hãy thử lại.", 503);
    }
    private static (string extension, string mime) ImageType(byte[] b)
    {
        if (b.Length >= 24 && b.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) && Encoding.ASCII.GetString(b, 12, 4) == "IHDR") return ("png", "image/png");
        if (b.Length >= 4 && b[0] == 255 && b[1] == 216 && b[2] == 255) return ("jpg", "image/jpeg");
        if (b.Length >= 16 && Encoding.ASCII.GetString(b, 0, 4) == "RIFF" && Encoding.ASCII.GetString(b, 8, 4) == "WEBP") return ("webp", "image/webp");
        if (b.Length >= 13 && Encoding.ASCII.GetString(b, 0, 6) is "GIF87a" or "GIF89a") return ("gif", "image/gif");
        throw new StorageIssue("IMAGE_TYPE", "Hãy chọn ảnh PNG, JPG, WebP hoặc GIF hợp lệ.", 415);
    }
    public async Task<object> Upload(HttpRequest request)
    {
        if (request.ContentLength > MaxImageBytes) throw new StorageIssue("IMAGE_TOO_LARGE", "Ảnh tối đa 8 MB.", 413);
        using var buffer = new MemoryStream(); var chunk = new byte[65536]; int count;
        while ((count = await request.Body.ReadAsync(chunk, request.HttpContext.RequestAborted)) > 0)
        {
            if (buffer.Length + count > MaxImageBytes) throw new StorageIssue("IMAGE_TOO_LARGE", "Ảnh tối đa 8 MB.", 413);
            await buffer.WriteAsync(chunk.AsMemory(0, count));
        }
        var bytes = buffer.ToArray(); var (extension, mime) = ImageType(bytes);
        if (request.ContentType?.Split(';')[0] != mime) throw new StorageIssue("IMAGE_TYPE", "Định dạng ảnh chưa hợp lệ.", 415);
        var id = $"{Hash(bytes)}.{extension}";
        await gate.WaitAsync();
        try
        {
            Safe(directory); Directory.CreateDirectory(directory); Safe(Images); Directory.CreateDirectory(Images);
            var file = Path.Combine(Images, id); Safe(file);
            if (!File.Exists(file))
            {
                var temp = Path.Combine(Images, $".image-{Guid.NewGuid():N}.tmp");
                try { await WriteNew(temp, bytes); File.Move(temp, file); }
                finally { if (File.Exists(temp)) File.Delete(temp); }
            }
            else if (Hash(await File.ReadAllBytesAsync(file)) != Hash(bytes)) throw new StorageIssue("VERIFY_FAILED", "Bản sao ảnh đã thay đổi. Hãy nhờ người hỗ trợ kiểm tra.", 503);
            return new { imageId = id };
        }
        finally { gate.Release(); }
    }
    public async Task SendImage(HttpContext context, string id)
    {
        if (!ImageId.IsMatch(id)) throw new StorageIssue("IMAGE_MISSING", "Không tìm thấy ảnh.", 404);
        await gate.WaitAsync();
        try
        {
            Safe(directory); Safe(Images); var file = Path.Combine(Images, id); Safe(file);
            if (!File.Exists(file)) throw new StorageIssue("IMAGE_MISSING", "Không tìm thấy ảnh. Hãy chọn lại ảnh trong hồ sơ.", 404);
            if (new FileInfo(file).Length > MaxImageBytes) throw new StorageIssue("IMAGE_TOO_LARGE", "Ảnh quá lớn để mở.", 413);
            var bytes = await File.ReadAllBytesAsync(file); var (_, mime) = ImageType(bytes);
            context.Response.ContentType = mime; context.Response.ContentLength = bytes.Length;
            await context.Response.Body.WriteAsync(bytes, context.RequestAborted);
        }
        finally { gate.Release(); }
    }
}
