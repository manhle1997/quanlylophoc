using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

internal sealed class LocalDataStore(string baseDirectory)
{
    private const int MaxBytes = 20 * 1024 * 1024;
    private readonly string directory = Path.Combine(baseDirectory, "data");
    private readonly SemaphoreSlim gate = new(1, 1);
    private string MainFile => Path.Combine(directory, "school-data.json");
    private string BackupDirectory => Path.Combine(directory, "backups");
    private static readonly JsonSerializerOptions Format = new() { WriteIndented = true };
    private static string Hash(byte[]? bytes) => bytes is null ? "missing" : Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    private static void SafeEntry(string path)
    {
        try { if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) throw new StorageIssue("UNSAFE_LOCATION", "Không thể truy cập nơi lưu lớp học. Hãy nhờ người hỗ trợ kiểm tra ứng dụng.", 503); }
        catch (FileNotFoundException) { } catch (DirectoryNotFoundException) { }
    }
    private async Task<byte[]?> ReadMain()
    {
        SafeEntry(directory); SafeEntry(MainFile);
        try { if (new FileInfo(MainFile).Length > MaxBytes) throw new StorageIssue("TOO_LARGE", "Dữ liệu lớp học quá lớn để mở an toàn."); return await File.ReadAllBytesAsync(MainFile); }
        catch (FileNotFoundException) { return null; } catch (DirectoryNotFoundException) { return null; }
    }
    private static JsonObject Parse(byte[] bytes)
    {
        try { return DocumentValidator.Validate(JsonNode.Parse(Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF'))); }
        catch (StorageIssue) { throw; }
        catch (Exception error) when (error is JsonException or InvalidOperationException or FormatException) { throw new StorageIssue("CORRUPT_DATA", "Chưa mở được danh sách lớp học. Bạn có thể phục hồi một lần lưu gần đây; bản hiện tại vẫn được giữ nguyên."); }
    }
    private static bool Equivalent(JsonObject a, JsonObject b)
    {
        var left = (JsonObject)a.DeepClone(); var right = (JsonObject)b.DeepClone();
        left.Remove("revision"); left.Remove("updatedAt"); right.Remove("revision"); right.Remove("updatedAt");
        return JsonNode.DeepEquals(left, right);
    }
    public async Task<object> Load()
    {
        await gate.WaitAsync();
        try { var bytes = await ReadMain(); return new { document = bytes is null ? null : Parse(bytes), etag = Hash(bytes) }; }
        finally { gate.Release(); }
    }
    public async Task<object> Save(JsonObject document, string expectedEtag)
    {
        DocumentValidator.Validate(document);
        await gate.WaitAsync();
        try
        {
            var previous = await ReadMain(); var current = previous is null ? null : Parse(previous);
            if (Hash(previous) != expectedEtag)
            {
                // An interrupted response can be retried without a second write or backup.
                if (current is not null && Equivalent(current, document)) return new { document = current, etag = Hash(previous) };
                throw new StorageIssue("CONFLICT", "Danh sách đã thay đổi ở cửa sổ khác. Bản đang làm vẫn được giữ; hãy đóng cửa sổ kia và tải lại danh sách mới.", 409);
            }
            document = (JsonObject)document.DeepClone(); document["revision"] = (current is null ? 0 : DocumentValidator.Revision(current)) + 1; document["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
            return await Commit(document, previous);
        }
        finally { gate.Release(); }
    }
    private async Task<object> Commit(JsonObject document, byte[]? previous)
    {
        var bytes = Encoding.UTF8.GetBytes(document.ToJsonString(Format)); if (bytes.Length > MaxBytes) throw new StorageIssue("TOO_LARGE", "Danh sách quá lớn để lưu an toàn.");
        SafeEntry(directory); Directory.CreateDirectory(directory); SafeEntry(BackupDirectory); Directory.CreateDirectory(BackupDirectory);
        if (previous is not null)
        {
            var backup = Path.Combine(BackupDirectory, $"auto-v2-{DateTime.UtcNow:yyyyMMddTHHmmssfffffffZ}-{Guid.NewGuid():N}.json");
            await WriteNew(backup, previous);
        }
        var temporary = Path.Combine(directory, $".school-data-{Guid.NewGuid():N}.tmp");
        try
        {
            await WriteNew(temporary, bytes); SafeEntry(MainFile);
            File.Move(temporary, MainFile, true);
            var verified = await ReadMain(); if (verified is null || Hash(verified) != Hash(bytes)) throw new StorageIssue("VERIFY_FAILED", "Chưa xác nhận được lần lưu này. Giữ ứng dụng mở và thử lại.", 503);
            Parse(verified);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
        // Rotate only backups created by this version. Legacy backups are preserved.
        try { foreach (var old in Directory.EnumerateFiles(BackupDirectory, "auto-v2-*.json").OrderByDescending(Path.GetFileName).Skip(20)) { SafeEntry(old); File.Delete(old); } }
        catch (IOException) { } catch (UnauthorizedAccessException) { }
        return new { document, etag = Hash(bytes) };
    }
    private static async Task WriteNew(string path, byte[] bytes)
    {
        await using (var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, FileOptions.Asynchronous | FileOptions.WriteThrough)) { await stream.WriteAsync(bytes); await stream.FlushAsync(); stream.Flush(true); }
        if (Hash(await File.ReadAllBytesAsync(path)) != Hash(bytes)) throw new StorageIssue("BACKUP_FAILED", "Chưa tạo được bản lưu an toàn. Bản trước vẫn được giữ; hãy thử lại.", 503);
    }
    private IEnumerable<string> Candidates()
    {
        SafeEntry(directory); SafeEntry(BackupDirectory);
        return Directory.Exists(BackupDirectory) ? Directory.EnumerateFiles(BackupDirectory, "*.json").OrderByDescending(File.GetLastWriteTimeUtc).Take(500) : [];
    }
    public async Task<object> Backups()
    {
        await gate.WaitAsync();
        try
        {
            var backups = new List<object>();
            foreach (var path in Candidates())
            {
                try { SafeEntry(path); if (new FileInfo(path).Length > MaxBytes) continue; var doc = Parse(await File.ReadAllBytesAsync(path)); var classes = (JsonArray)doc["classes"]!; backups.Add(new { id = Hash(Encoding.UTF8.GetBytes(Path.GetFileName(path))), savedAt = File.GetLastWriteTimeUtc(path).ToString("O"), classes = classes.Count, students = classes.Sum(c => ((JsonArray)c!["students"]!).Count), plays = ((JsonArray)doc["history"]!).Count, attendanceDays = (doc["attendanceRecords"] as JsonArray)?.Count ?? 0 }); }
                catch (StorageIssue) { } catch (IOException) { }
            }
            return new { backups };
        }
        finally { gate.Release(); }
    }
    public async Task<object> Restore(string backupId, string expectedEtag)
    {
        await gate.WaitAsync();
        try
        {
            var previous = await ReadMain(); if (Hash(previous) != expectedEtag) throw new StorageIssue("CONFLICT", "Danh sách đã thay đổi. Hãy tải lại trước khi phục hồi.", 409);
            var path = Candidates().FirstOrDefault(p => Hash(Encoding.UTF8.GetBytes(Path.GetFileName(p))) == backupId) ?? throw new StorageIssue("BACKUP_MISSING", "Bản lưu này không còn khả dụng. Hãy chọn một lần lưu khác.", 404);
            SafeEntry(path); if (new FileInfo(path).Length > MaxBytes) throw new StorageIssue("TOO_LARGE", "Bản lưu này quá lớn.");
            var document = Parse(await File.ReadAllBytesAsync(path));
            if (previous is not null) { try { var current = Parse(previous); document["revision"] = DocumentValidator.Revision(current) + 1; } catch (StorageIssue e) when (e.Code != "FUTURE_SCHEMA") { document["revision"] = DocumentValidator.Revision(document) + 1; } }
            document["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
            return await Commit(document, previous);
        }
        finally { gate.Release(); }
    }
    public async Task<string> CurrentEtag() { await gate.WaitAsync(); try { return Hash(await ReadMain()); } finally { gate.Release(); } }
}
