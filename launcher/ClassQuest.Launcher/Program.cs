using System.Diagnostics;
using System.Net;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;

internal static class Program
{
    private static int Port = 17843;
    private static string Address => $"http://127.0.0.1:{Port}/";
    private const string Marker = "{\"app\":\"ClassQuest\",\"version\":\"0.5.1\",\"name\":\"Lớp Học Vui\"}";
    private static readonly Dictionary<string, string> Mime = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8", [".js"] = "application/javascript; charset=utf-8",
        [".css"] = "text/css; charset=utf-8", [".json"] = "application/json; charset=utf-8",
        [".svg"] = "image/svg+xml", [".png"] = "image/png", [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg", [".ico"] = "image/x-icon", [".woff2"] = "font/woff2",
        [".woff"] = "font/woff", [".wasm"] = "application/wasm", [".glb"] = "model/gltf-binary",
        [".ogg"] = "audio/ogg", [".mp3"] = "audio/mpeg", [".wav"] = "audio/wav", [".txt"] = "text/plain; charset=utf-8",
    };

    public static int Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        if (args.Length == 1 && args[0] == "--apply-update")
        {
            try { return UpdateInstaller.RunHelper(AppContext.BaseDirectory).GetAwaiter().GetResult(); }
            catch { return 1; }
        }
        Console.Title = "Lớp Học Vui";
        // Developer/test override; normal desktop use always keeps the default origin.
        var overridePort = args.FirstOrDefault(a => a.StartsWith("--port=", StringComparison.Ordinal));
        if (overridePort is not null) { if (!int.TryParse(overridePort[7..], out Port) || Port < 1024 || Port > 65535) { Console.Error.WriteLine("Cổng không hợp lệ."); return 2; } }
        var openBrowser = !args.Contains("--no-browser", StringComparer.Ordinal);
        using (var updating = new Mutex(false, $@"Local\ClassQuest-Update-{Port}-v1"))
        {
            bool available; try { available = updating.WaitOne(0); } catch (AbandonedMutexException) { available = true; }
            if (available) updating.ReleaseMutex();
            else if (!args.Contains("--update-restart", StringComparer.Ordinal)) { Console.WriteLine("Đang cài bản cập nhật. Hãy chờ ứng dụng mở lại."); return 2; }
        }
        // Keep Mutex ownership on this synchronous main thread, including release.
        using var instance = new Mutex(false, $@"Local\ClassQuest-Static-{Port}-v1");
        bool owns;
        try { owns = instance.WaitOne(0); } catch (AbandonedMutexException) { owns = true; }
        if (!owns)
        {
            if (IsExistingClassQuest().GetAwaiter().GetResult())
            {
                Console.WriteLine("Lớp Học Vui đang chạy. Mở lại ứng dụng hiện tại.");
                if (openBrowser) OpenBrowser();
                return 0;
            }
            Console.Error.WriteLine("Có instance đang khởi động hoặc cổng không xác minh được. Hãy chờ hoặc đóng instance cũ.");
            return 2;
        }
        try { return Run(openBrowser).GetAwaiter().GetResult(); }
        catch (Exception error)
        {
            Console.Error.WriteLine($"Không thể khởi động Lớp Học Vui: {error.Message}");
            Console.Error.WriteLine("Kiểm tra app/ và cổng 127.0.0.1:17843. Không tự đổi cổng hoặc mở một dịch vụ khác.");
            return 1;
        }
        finally { instance.ReleaseMutex(); }
    }

    private static async Task<int> Run(bool openBrowser)
    {
        UpdateInstaller.RecoverInterrupted(AppContext.BaseDirectory);
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "app"));
        if (!Directory.Exists(root) || !File.Exists(Path.Combine(root, "index.html")) || HasReparsePoint(root))
            throw new IOException("Thiếu thư mục app hoặc app là liên kết không được hỗ trợ.");
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions { ContentRootPath = AppContext.BaseDirectory, Args = [] });
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(options =>
        {
            options.AddServerHeader = false;
            options.Limits.MaxRequestBodySize = 21 * 1024 * 1024;
            options.Listen(IPAddress.Loopback, Port, endpoint => endpoint.Protocols = HttpProtocols.Http1);
        });
        await using var app = builder.Build();
        var storageApi = new StorageApi(AppContext.BaseDirectory, Address.TrimEnd('/'), new UpdateService(AppContext.BaseDirectory, typeof(Program).Assembly.GetName().Version!.ToString(3), Port), app.Lifetime);
        app.Run(async context =>
        {
            context.Response.Headers.XContentTypeOptions = "nosniff";
            context.Response.Headers.XFrameOptions = "DENY";
            context.Response.Headers["Referrer-Policy"] = "no-referrer";
            context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin";
            context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; worker-src 'none'";
            if (!string.Equals(context.Request.Host.Value, $"127.0.0.1:{Port}", StringComparison.OrdinalIgnoreCase)) { context.Response.StatusCode = 400; return; }
            var rawTarget = context.Features.Get<IHttpRequestFeature>()?.RawTarget ?? "/";
            var rawPath = rawTarget.Split('?')[0];
            string decoded;
            try { decoded = Uri.UnescapeDataString(Uri.UnescapeDataString(rawPath)); }
            catch { context.Response.StatusCode = 404; return; }
            if (!decoded.StartsWith('/') || decoded.StartsWith("//", StringComparison.Ordinal) || decoded.Contains('\\') || decoded.Contains(':') || decoded.Contains('%') || decoded.Any(char.IsControl)) { context.Response.StatusCode = 404; return; }
            var segments = decoded.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Any(segment => segment is "." or "..") || segments.FirstOrDefault()?.Equals("data", StringComparison.OrdinalIgnoreCase) == true || segments.FirstOrDefault()?.Equals("backups", StringComparison.OrdinalIgnoreCase) == true) { context.Response.StatusCode = 404; return; }
            if (decoded.StartsWith("/api/", StringComparison.Ordinal)) { await storageApi.Handle(context, decoded); return; }
            if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method)) { context.Response.StatusCode = 405; context.Response.Headers.Allow = "GET, HEAD"; return; }
            var relative = segments.Length == 0 ? "index.html" : Path.Combine(segments);
            var path = Path.GetFullPath(Path.Combine(root, relative));
            if (!path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || !Mime.TryGetValue(Path.GetExtension(path), out var type)) { context.Response.StatusCode = 404; return; }
            var cursor = root;
            foreach (var segment in relative.Split(Path.DirectorySeparatorChar))
            {
                cursor = Path.Combine(cursor, segment);
                if (HasReparsePoint(cursor)) { context.Response.StatusCode = 404; return; }
            }
            if (!File.Exists(path)) { context.Response.StatusCode = 404; return; }
            try
            {
                await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan);
                context.Response.ContentType = type; context.Response.ContentLength = stream.Length;
                context.Response.Headers.CacheControl = "no-cache";
                if (HttpMethods.IsGet(context.Request.Method)) await stream.CopyToAsync(context.Response.Body, context.RequestAborted);
            }
            catch (FileNotFoundException) { context.Response.StatusCode = 404; }
            catch (UnauthorizedAccessException) { context.Response.StatusCode = 404; }
        });
        // Start must succeed before opening a URL: an unrelated port owner never gets opened.
        await app.StartAsync();
        Console.WriteLine($"Lớp Học Vui 0.5.1 · {Address}");
        Console.WriteLine("Giữ cửa sổ này mở. Đóng cửa sổ hoặc Ctrl+C để dừng server.");
        Console.WriteLine("Lớp học được mở và lưu tự động. Chỉ cần thêm lớp và học sinh trong ứng dụng.");
        if (openBrowser) OpenBrowser();
        await app.WaitForShutdownAsync();
        return 0;
    }

    private static bool HasReparsePoint(string path)
    {
        try { return (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0; }
        catch (FileNotFoundException) { return false; }
        catch (DirectoryNotFoundException) { return false; }
    }
    private static async Task<bool> IsExistingClassQuest()
    {
        try
        {
            using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false, UseProxy = false }) { Timeout = TimeSpan.FromSeconds(2) };
            return (await client.GetStringAsync(Address + "classquest-version.json")).Trim() == Marker;
        }
        catch { return false; }
    }
    private static void OpenBrowser()
    {
        try { Process.Start(new ProcessStartInfo(Address) { UseShellExecute = true }); }
        catch { Console.WriteLine($"Mở thủ công bằng Chrome/Edge: {Address}"); }
    }
}

