using System.Diagnostics;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

// Network access is opt-in. No profile, classroom data, paths or tokens leave this device.
internal sealed record UpdateRelease(string Version, string Url, string Digest, long Size, bool Prerelease);
internal sealed record UpdateStatus(string State, string CurrentVersion, string? Version = null, bool Prerelease = false, long Received = 0, long Total = 0, string? Message = null);
internal sealed record UpdateManifest(int ParentPid, long ParentStarted, int Port, string Version);

internal sealed class UpdateService(string baseDirectory, string currentVersion, int port, Func<HttpClient>? clientFactory = null)
{
    internal const string Repository = "manhle1997/quanlylophoc";
    private readonly object gate = new();
    private UpdateStatus status = InitialStatus(baseDirectory, currentVersion);
    private UpdateRelease? release;
    private CancellationTokenSource? cancellation;
    private string? stage;
    private bool applying;

    private static UpdateStatus InitialStatus(string root, string current)
    {
        try
        {
            using var result = JsonDocument.Parse(File.ReadAllText(Path.Combine(root, ".updates", "result.json")));
            if (result.RootElement.GetProperty("state").GetString() == "rolled-back" && ParseVersion(result.RootElement.GetProperty("version").GetString() ?? "") > ParseVersion(current)) return new("idle", current, Message: "Cài bản mới chưa thành công. Ứng dụng đã quay về bản trước; dữ liệu vẫn được giữ nguyên.");
        }
        catch { }
        return new("idle", current);
    }

    public UpdateStatus Status { get { lock (gate) return status; } }
    private void Set(UpdateStatus value) { lock (gate) status = value; }

    public UpdateStatus Start(bool download)
    {
        lock (gate)
        {
            if (cancellation is not null || applying) throw new StorageIssue("UPDATE_BUSY", "Một thao tác cập nhật đang chạy.", 409);
            if (download && (release is null || status.State != "available")) throw new StorageIssue("UPDATE_NOT_CHECKED", "Hãy kiểm tra phiên bản mới trước khi tải.", 409);
            cancellation = new CancellationTokenSource(TimeSpan.FromMinutes(download ? 15 : 1));
            var source = cancellation;
            status = new(download ? "downloading" : "checking", currentVersion, release?.Version, release?.Prerelease ?? false, Total: download ? release!.Size : 0);
            _ = Task.Run(async () =>
            {
                try
                {
                    if (download) await Download(release!, source.Token);
                    else
                    {
                        using var client = clientFactory?.Invoke() ?? Client();
                        using var response = await client.GetAsync($"https://api.github.com/repos/{Repository}/releases?per_page=100", HttpCompletionOption.ResponseHeadersRead, source.Token);
                        response.EnsureSuccessStatusCode();
                        var bytes = await ReadLimited(response.Content, 4 * 1024 * 1024, source.Token);
                        using var json = JsonDocument.Parse(bytes);
                        release = SelectRelease(json.RootElement, currentVersion);
                        Set(new(release is null ? "latest" : "available", currentVersion, release?.Version, release?.Prerelease ?? false));
                    }
                }
                catch (OperationCanceledException) { Set(new(release is null ? "idle" : "available", currentVersion, release?.Version, release?.Prerelease ?? false, Message: "Đã dừng tải hoặc hết thời gian chờ. Bạn có thể thử lại.")); }
                catch (Exception error)
                {
                    Set(new("error", currentVersion, Message: error is StorageIssue ? error.Message : "Chưa cập nhật được. Kiểm tra kết nối Internet và thử lại. Bản đang dùng và dữ liệu vẫn được giữ nguyên."));
                }
                finally { lock (gate) { cancellation = null; source.Dispose(); } }
            });
            return status;
        }
    }

    public UpdateStatus Cancel() { lock (gate) { cancellation?.Cancel(); return status; } }

    internal static Version? ParseVersion(string text) => Regex.IsMatch(text, @"^\d{1,6}\.\d{1,6}\.\d{1,6}$") && Version.TryParse(text, out var value) ? value : null;

    internal static UpdateRelease? SelectRelease(JsonElement releases, string current)
    {
        var installed = ParseVersion(current) ?? throw new InvalidDataException("Invalid installed version");
        UpdateRelease? selected = null;
        foreach (var item in releases.EnumerateArray().OrderByDescending(item => ParseVersion((item.GetProperty("tag_name").GetString() ?? "").TrimStart('v'))))
        {
            if (item.GetProperty("draft").GetBoolean() || item.GetProperty("published_at").ValueKind != JsonValueKind.String) continue;
            var tag = item.GetProperty("tag_name").GetString() ?? "";
            var text = tag.StartsWith('v') ? tag[1..] : tag;
            var version = ParseVersion(text);
            if (version is null || version <= installed || selected is not null && version <= ParseVersion(selected.Version)) continue;
            var name = $"Lop-Hoc-Vui-{text}-rc-win-x64.zip";
            var assets = item.GetProperty("assets").EnumerateArray().Where(a => a.GetProperty("name").GetString() == name && a.GetProperty("state").GetString() == "uploaded").ToArray();
            if (assets.Length != 1) throw new StorageIssue("UPDATE_METADATA", "Bản phát hành mới chưa có đúng gói Windows x64. Hãy liên hệ người phát hành.");
            var asset = assets[0];
            var url = asset.GetProperty("browser_download_url").GetString() ?? "";
            var digest = asset.TryGetProperty("digest", out var d) ? d.GetString() ?? "" : "";
            var size = asset.GetProperty("size").GetInt64();
            if (url != $"https://github.com/{Repository}/releases/download/{tag}/{name}" || !Regex.IsMatch(digest, @"^sha256:[a-fA-F0-9]{64}$") || size <= 0 || size > 256L * 1024 * 1024)
                throw new StorageIssue("UPDATE_METADATA", "Bản phát hành chưa có gói hoặc mã kiểm tra hợp lệ. Hãy liên hệ người phát hành.");
            selected = new(text, url, digest[7..], size, item.GetProperty("prerelease").GetBoolean());
        }
        return selected;
    }

    private static HttpClient Client()
    {
        var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = Timeout.InfiniteTimeSpan };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("LopHocVui-Updater/1.0");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
        client.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
        return client;
    }

    private static async Task<byte[]> ReadLimited(HttpContent content, int limit, CancellationToken ct)
    {
        using var output = new MemoryStream();
        await using var input = await content.ReadAsStreamAsync(ct);
        var buffer = new byte[64 * 1024];
        int count;
        while ((count = await input.ReadAsync(buffer, ct)) > 0) { if (output.Length + count > limit) throw new InvalidDataException("Response too large"); await output.WriteAsync(buffer.AsMemory(0, count), ct); }
        return output.ToArray();
    }

    private async Task Download(UpdateRelease selected, CancellationToken ct)
    {
        if (stage is not null) UpdateInstaller.RemoveStage(stage);
        var updates = Path.Combine(baseDirectory, ".updates");
        UpdateInstaller.NoLinks(baseDirectory);
        Directory.CreateDirectory(updates);
        stage = Path.Combine(updates, Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(stage);
        try
        {
            using var client = clientFactory?.Invoke() ?? Client();
            var url = new Uri(selected.Url);
            HttpResponseMessage? response = null;
            // GitHub sends release binaries through its HTTPS asset hosts. No arbitrary redirects.
            for (var redirects = 0; redirects < 6; redirects++)
            {
                if (url.Scheme != "https" || !url.IsDefaultPort || url.UserInfo.Length != 0 || !(url.Host is "github.com" or "release-assets.githubusercontent.com" or "objects.githubusercontent.com" or "github-releases.githubusercontent.com")) throw new InvalidDataException("Untrusted redirect");
                response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
                if ((int)response.StatusCode is 301 or 302 or 303 or 307 or 308)
                {
                    var next = response.Headers.Location ?? throw new InvalidDataException("Missing redirect");
                    url = next.IsAbsoluteUri ? next : new Uri(url, next); response.Dispose(); response = null; continue;
                }
                break;
            }
            using (response)
            {
                if (response is null) throw new InvalidDataException("Too many redirects");
                response.EnsureSuccessStatusCode();
                if (response.Content.Headers.ContentLength is long length && length != selected.Size) throw new InvalidDataException("Size mismatch");
                await using var input = await response.Content.ReadAsStreamAsync(ct);
                await using var output = new FileStream(Path.Combine(stage, "package.zip"), FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, FileOptions.Asynchronous);
                using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
                var buffer = new byte[64 * 1024]; long received = 0; int count;
                while ((count = await input.ReadAsync(buffer, ct)) > 0)
                {
                    received += count;
                    if (received > selected.Size) throw new InvalidDataException("Size mismatch");
                    hash.AppendData(buffer, 0, count); await output.WriteAsync(buffer.AsMemory(0, count), ct);
                    Set(new("downloading", currentVersion, selected.Version, selected.Prerelease, received, selected.Size));
                }
                if (received != selected.Size || !CryptographicOperations.FixedTimeEquals(hash.GetHashAndReset(), Convert.FromHexString(selected.Digest))) throw new StorageIssue("UPDATE_CHECKSUM", "Gói tải về không khớp mã kiểm tra. Hãy tải lại; ứng dụng hiện tại chưa thay đổi.");
                output.Flush(true);
            }
            ct.ThrowIfCancellationRequested();
            UpdateInstaller.Extract(Path.Combine(stage, "package.zip"), Path.Combine(stage, "next"), selected.Version);
            ct.ThrowIfCancellationRequested();
            Set(new("ready", currentVersion, selected.Version, selected.Prerelease, selected.Size, selected.Size));
        }
        catch { UpdateInstaller.RemoveStage(stage); stage = null; throw; }
    }

    public UpdateStatus Apply()
    {
        lock (gate)
        {
            if (cancellation is not null || applying || status.State != "ready" || stage is null || release is null) throw new StorageIssue("UPDATE_NOT_READY", "Bản cập nhật chưa sẵn sàng để cài đặt.", 409);
            UpdateInstaller.NoLinks(baseDirectory);
            UpdateInstaller.ValidatePackage(Path.Combine(stage, "next"), release.Version);
            using var parent = Process.GetCurrentProcess();
            var manifest = new UpdateManifest(parent.Id, parent.StartTime.ToUniversalTime().Ticks, port, release.Version);
            UpdateInstaller.WriteDurable(Path.Combine(stage, "manifest.json"), JsonSerializer.Serialize(manifest));
            var helper = Path.Combine(stage, "Updater.exe");
            File.Copy(Environment.ProcessPath!, helper, true);
            var start = new ProcessStartInfo(helper) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = stage };
            start.ArgumentList.Add("--apply-update");
            if (Process.Start(start) is null) throw new IOException("Updater did not start");
            applying = true;
            return status = status with { State = "applying" };
        }
    }
}

internal static class UpdateInstaller
{
    internal static readonly string[] Entries = ["app", "licenses", "Start.staticwebassets.endpoints.json", "web.config", "README-VI.txt", "THIRD_PARTY_NOTICES.txt", "Start.exe"];

    internal static void WriteDurable(string path, string text)
    {
        using var stream = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough);
        stream.Write(System.Text.Encoding.UTF8.GetBytes(text)); stream.Flush(true);
    }

    internal static void NoLinks(string path)
    {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) throw new IOException("Linked installation paths are not supported");
        if (Directory.Exists(path)) foreach (var child in Directory.EnumerateFileSystemEntries(path)) NoLinks(child);
    }

    internal static void RemoveStage(string stage)
    {
        var full = Path.GetFullPath(stage);
        if (Directory.GetParent(full)?.Name != ".updates" || !Regex.IsMatch(Path.GetFileName(full), "^[a-f0-9]{32}$")) throw new IOException("Invalid update staging path");
        if (Directory.Exists(full)) { NoLinks(full); Directory.Delete(full, true); }
    }

    internal static void Extract(string zipPath, string target, string version)
    {
        Directory.CreateDirectory(target);
        using var zip = ZipFile.OpenRead(zipPath);
        if (zip.Entries.Count > 10000) throw new InvalidDataException("Too many archive entries");
        long size = 0;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in zip.Entries)
        {
            var directory = entry.FullName.EndsWith('/');
            var parts = entry.FullName.TrimEnd('/').Split('/');
            if (parts.Length < 1 || parts[0] != "ClassQuest" || parts.Any(p => p.Length == 0 || p is "." or ".." || p.EndsWith('.') || p.EndsWith(' ') || p.IndexOfAny(['\\', ':', '\0']) >= 0 || p.Any(char.IsControl) || Regex.IsMatch(p, @"^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)", RegexOptions.IgnoreCase))) throw new InvalidDataException("Unsafe archive path");
            if (((entry.ExternalAttributes >> 16) & 0xF000) == 0xA000 || (entry.ExternalAttributes & (int)FileAttributes.ReparsePoint) != 0) throw new InvalidDataException("Linked archive entry");
            if (parts.Length == 1) { if (!directory) throw new InvalidDataException("Invalid archive root"); continue; }
            if (parts[1] == "data")
            {
                if (!directory || entry.Length != 0 || !(parts.Length == 2 || parts.Length == 3 && parts[2] == "backups")) throw new InvalidDataException("User data in update archive");
                continue;
            }
            if (!Entries.Contains(parts[1], StringComparer.Ordinal) || parts.Length > 2 && parts[1] is not ("app" or "licenses")) throw new InvalidDataException("Unexpected program entry");
            var relative = string.Join(Path.DirectorySeparatorChar, parts.Skip(1));
            if (!seen.Add(relative) || entry.Length > 256L * 1024 * 1024 || (size += entry.Length) > 512L * 1024 * 1024) throw new InvalidDataException("Invalid archive contents");
            var destination = Path.Combine(target, relative);
            if (directory) Directory.CreateDirectory(destination);
            else
            {
                Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                using var input = entry.Open(); using var output = new FileStream(destination, FileMode.CreateNew);
                var buffer = new byte[65536]; long copied = 0; int count;
                while ((count = input.Read(buffer)) > 0) { copied += count; if (copied > entry.Length) throw new InvalidDataException("Expanded archive size mismatch"); output.Write(buffer, 0, count); }
                if (copied != entry.Length) throw new InvalidDataException("Truncated archive entry");
                output.Flush(true);
            }
        }
        ValidatePackage(target, version);
    }

    internal static void ValidatePackage(string root, string version)
    {
        NoLinks(root);
        if (!File.Exists(Path.Combine(root, "Start.exe")) || !File.Exists(Path.Combine(root, "app", "index.html"))) throw new InvalidDataException("Incomplete update package");
        // Reject malformed/foreign executables before Windows attempts to open a loader error dialog.
        using (var executable = new BinaryReader(File.OpenRead(Path.Combine(root, "Start.exe"))))
        {
            if (executable.BaseStream.Length < 256 || executable.ReadUInt16() != 0x5A4D) throw new InvalidDataException("Invalid Windows executable");
            executable.BaseStream.Position = 0x3C;
            var offset = executable.ReadInt32();
            if (offset < 64 || offset > executable.BaseStream.Length - 26) throw new InvalidDataException("Invalid executable header");
            executable.BaseStream.Position = offset;
            if (executable.ReadUInt32() != 0x00004550 || executable.ReadUInt16() != 0x8664) throw new InvalidDataException("Expected Windows x64 executable");
            executable.BaseStream.Position = offset + 24;
            if (executable.ReadUInt16() != 0x20B) throw new InvalidDataException("Expected PE32+ executable");
        }
        using var marker = JsonDocument.Parse(File.ReadAllText(Path.Combine(root, "app", "classquest-version.json")));
        if (marker.RootElement.GetProperty("app").GetString() != "ClassQuest" || marker.RootElement.GetProperty("version").GetString() != version) throw new InvalidDataException("Version mismatch");
    }

    // Keep the installed directory itself and data/ in place. Only known program entries move.
    internal static void Install(string root, string stage, string version)
    {
        NoLinks(root); ValidatePackage(Path.Combine(stage, "next"), version);
        var previous = Path.Combine(stage, "previous"); Directory.CreateDirectory(previous);
        WriteDurable(Path.Combine(stage, "journal.json"), JsonSerializer.Serialize(Entries.Where(e => Exists(Path.Combine(root, e))).ToArray()));
        foreach (var entry in Entries)
        {
            var installed = Path.Combine(root, entry);
            var next = Path.Combine(stage, "next", entry);
            if (entry == "Start.exe" && File.Exists(installed) && File.Exists(next)) { File.Replace(next, installed, Path.Combine(previous, entry)); continue; }
            if (Exists(installed)) Move(installed, Path.Combine(previous, entry));
            if (Exists(next)) Move(next, installed);
        }
        WriteDurable(Path.Combine(stage, "installed"), version);
    }

    internal static void Rollback(string root, string stage)
    {
        NoLinks(root);
        var originals = JsonSerializer.Deserialize<string[]>(File.ReadAllText(Path.Combine(stage, "journal.json"))) ?? throw new InvalidDataException("Invalid recovery journal");
        if (originals.Any(e => !Entries.Contains(e))) throw new InvalidDataException("Invalid recovery entry");
        foreach (var entry in Entries)
        {
            var old = Path.Combine(stage, "previous", entry); var installed = Path.Combine(root, entry);
            // If an original has not moved yet, it still sits safely in the installation.
            if (!Exists(old) && originals.Contains(entry)) continue;
            if (Directory.Exists(installed)) Directory.Delete(installed, true); else if (File.Exists(installed)) File.Delete(installed);
            if (Exists(old)) Move(old, installed);
        }
        File.Delete(Path.Combine(stage, "journal.json"));
        File.Delete(Path.Combine(stage, "installed"));
    }

    internal static void RecoverInterrupted(string root)
    {
        var updates = Path.Combine(root, ".updates");
        if (!Directory.Exists(updates)) return;
        NoLinks(updates);
        foreach (var stage in Directory.GetDirectories(updates))
        {
            if (!Regex.IsMatch(Path.GetFileName(stage), "^[a-f0-9]{32}$")) continue;
            if (File.Exists(Path.Combine(stage, "journal.json")) && !File.Exists(Path.Combine(stage, "installed"))) Rollback(root, stage);
            if (!File.Exists(Path.Combine(stage, "journal.json")))
            {
                try { RemoveStage(stage); } catch (Exception error) when (error is IOException or UnauthorizedAccessException) { /* The helper can still be running. Retry at the next launch. */ }
            }
        }
    }

    internal static async Task<int> RunHelper(string stage)
    {
        var root = Directory.GetParent(stage.TrimEnd(Path.DirectorySeparatorChar))?.Parent?.FullName ?? throw new IOException("Invalid staging root");
        if (Directory.GetParent(stage.TrimEnd(Path.DirectorySeparatorChar))?.Name != ".updates" || !Regex.IsMatch(Path.GetFileName(stage.TrimEnd(Path.DirectorySeparatorChar)), "^[a-f0-9]{32}$")) return 2;
        NoLinks(root);
        var manifest = JsonSerializer.Deserialize<UpdateManifest>(File.ReadAllText(Path.Combine(stage, "manifest.json"))) ?? throw new InvalidDataException("Missing manifest");
        if (manifest.Port < 1024 || manifest.Port > 65535 || UpdateService.ParseVersion(manifest.Version) is null) return 2;
        try
        {
            using var parent = Process.GetProcessById(manifest.ParentPid);
            if (parent.StartTime.ToUniversalTime().Ticks != manifest.ParentStarted) return 2;
            using var wait = new CancellationTokenSource(TimeSpan.FromSeconds(45));
            await parent.WaitForExitAsync(wait.Token);
        }
        catch (ArgumentException) { /* Launcher already exited before the helper started. */ }
        catch (OperationCanceledException) { return 2; }
        // Do not race a second launch or an updater in another window.
        using var mutex = new Mutex(false, $@"Local\ClassQuest-Update-{manifest.Port}-v1");
        bool owns; try { owns = mutex.WaitOne(0); } catch (AbandonedMutexException) { owns = true; }
        if (!owns) return 2;
        // Do not use Mutex ownership across awaits below: this helper is synchronous here.
        try { return ApplyAndRestart(root, stage, manifest); }
        finally { mutex.ReleaseMutex(); }
    }

    private static int ApplyAndRestart(string root, string stage, UpdateManifest manifest)
    {
        Process? child = null;
        try
        {
            using (var instance = new Mutex(false, $@"Local\ClassQuest-Static-{manifest.Port}-v1"))
            {
                bool owns; try { owns = instance.WaitOne(10000); } catch (AbandonedMutexException) { owns = true; }
                if (!owns) return 2;
                try { Install(root, stage, manifest.Version); }
                finally { instance.ReleaseMutex(); }
            }
            child = Launch(root, manifest.Port);
            using var client = new HttpClient(new HttpClientHandler { UseProxy = false, AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(1) };
            var healthy = false;
            for (var n = 0; n < 40; n++)
            {
                try
                {
                    using var marker = JsonDocument.Parse(client.GetStringAsync($"http://127.0.0.1:{manifest.Port}/classquest-version.json").GetAwaiter().GetResult());
                    using var session = JsonDocument.Parse(client.GetStringAsync($"http://127.0.0.1:{manifest.Port}/api/session").GetAwaiter().GetResult());
                    if (!child.HasExited && marker.RootElement.GetProperty("app").GetString() == "ClassQuest" && marker.RootElement.GetProperty("version").GetString() == manifest.Version && session.RootElement.GetProperty("version").GetString() == manifest.Version) { healthy = true; break; }
                }
                catch { }
                if (child.HasExited) throw new IOException("Updated launcher exited before becoming ready");
                Thread.Sleep(500);
            }
            if (!healthy) throw new IOException("Updated launcher did not become ready");
            WriteDurable(Path.Combine(root, ".updates", "result.json"), JsonSerializer.Serialize(new { state = "success", version = manifest.Version }));
            File.Delete(Path.Combine(stage, "journal.json"));
            try { Directory.Delete(Path.Combine(stage, "previous"), true); } catch (Exception error) when (error is IOException or UnauthorizedAccessException) { /* Installation already committed. Clean up on next launch. */ }
            return 0;
        }
        catch (Exception error)
        {
            try { WriteDurable(Path.Combine(stage, "error.log"), error.ToString()); } catch { }
            if (child is not null && !child.HasExited) { child.Kill(); child.WaitForExit(10000); }
            try
            {
                if (File.Exists(Path.Combine(stage, "journal.json"))) Rollback(root, stage);
                WriteDurable(Path.Combine(root, ".updates", "result.json"), JsonSerializer.Serialize(new { state = "rolled-back", version = manifest.Version }));
                Launch(root, manifest.Port);
            }
            catch (Exception recoveryError) { try { WriteDurable(Path.Combine(stage, "recovery-error.log"), recoveryError.ToString()); } catch { } }
            return 1;
        }
        finally { child?.Dispose(); }
    }

    private static Process Launch(string root, int port)
    {
        var start = new ProcessStartInfo(Path.Combine(root, "Start.exe")) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = root };
        start.ArgumentList.Add($"--port={port}"); start.ArgumentList.Add("--no-browser"); start.ArgumentList.Add("--update-restart");
        return Process.Start(start) ?? throw new IOException("Launcher did not start");
    }
    private static bool Exists(string path) => Directory.Exists(path) || File.Exists(path);
    private static void Move(string from, string to) { if (Directory.Exists(from)) Directory.Move(from, to); else File.Move(from, to); }
}
