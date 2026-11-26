using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

internal sealed class StorageApi(string baseDirectory, string allowedOrigin, UpdateService updates, IHostApplicationLifetime lifetime)
{
    private readonly LocalDataStore store = new(baseDirectory);
    private readonly ProfileStore profileStore = new(baseDirectory);
    private readonly string token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    public async Task Handle(HttpContext context, string path)
    {
        context.Response.Headers.CacheControl = "no-store";
        context.Response.ContentType = "application/json; charset=utf-8";
        var origin = context.Request.Headers.Origin.ToString();
        if (origin.Length > 0 && origin != allowedOrigin || context.Request.Headers["Sec-Fetch-Site"] == "cross-site") { context.Response.StatusCode = 403; await context.Response.WriteAsJsonAsync(new { code = "ORIGIN_DENIED", message = "Không thể thực hiện yêu cầu từ cửa sổ này." }); return; }
        if (path == "/api/session" && HttpMethods.IsGet(context.Request.Method)) { await context.Response.WriteAsJsonAsync(new { token, version = Program.AppVersion, name = "Lớp Học Vui" }); return; }
        var received = Encoding.UTF8.GetBytes(context.Request.Headers["X-ClassQuest-Token"].ToString());
        if (!CryptographicOperations.FixedTimeEquals(received, Encoding.UTF8.GetBytes(token))) { context.Response.StatusCode = 403; await context.Response.WriteAsJsonAsync(new { code = "SESSION_EXPIRED", message = "Ứng dụng vừa được mở lại. Hãy tải lại cửa sổ để tiếp tục." }); return; }
        try
        {
            object result;
            if (path.StartsWith("/api/profile/images/", StringComparison.Ordinal) && HttpMethods.IsGet(context.Request.Method)) { await profileStore.SendImage(context, path[20..]); return; }
            if (path == "/api/updates" && HttpMethods.IsGet(context.Request.Method)) result = updates.Status;
            else if (path == "/api/updates/check" && HttpMethods.IsPost(context.Request.Method)) result = updates.Start(false);
            else if (path == "/api/updates/download" && HttpMethods.IsPost(context.Request.Method)) result = updates.Start(true);
            else if (path == "/api/updates/cancel" && HttpMethods.IsPost(context.Request.Method)) result = updates.Cancel();
            else if (path == "/api/updates/apply" && HttpMethods.IsPost(context.Request.Method))
            {
                result = updates.Apply();
                context.Response.OnCompleted(() => { lifetime.StopApplication(); return Task.CompletedTask; });
            }
            else if (path == "/api/profile/images" && HttpMethods.IsPost(context.Request.Method)) result = await profileStore.Upload(context.Request);
            else if (path == "/api/profile" && HttpMethods.IsGet(context.Request.Method)) result = await profileStore.Load();
            else if (path == "/api/profile" && HttpMethods.IsPost(context.Request.Method))
            {
                if (!context.Request.HasJsonContentType()) throw new StorageIssue("CONTENT_TYPE", "Yêu cầu lưu hồ sơ chưa hợp lệ.", 415);
                var body = await JsonNode.ParseAsync(context.Request.Body) as JsonObject ?? throw new StorageIssue("PROFILE_INVALID", "Hồ sơ chưa hợp lệ.");
                result = await profileStore.Save(body["profile"] as JsonObject ?? throw new StorageIssue("PROFILE_INVALID", "Hồ sơ chưa hợp lệ."), body["expectedEtag"]?.GetValue<string>() ?? throw new StorageIssue("MISSING_REVISION", "Hãy tải lại hồ sơ trước khi tiếp tục.", 409));
            }
            else if (path == "/api/storage" && HttpMethods.IsGet(context.Request.Method)) result = await store.Load();
            else if (path == "/api/storage/backups" && HttpMethods.IsGet(context.Request.Method)) result = await store.Backups();
            else if ((path == "/api/storage" || path == "/api/storage/restore") && HttpMethods.IsPost(context.Request.Method))
            {
                if (!context.Request.HasJsonContentType()) throw new StorageIssue("CONTENT_TYPE", "Yêu cầu lưu chưa hợp lệ.", 415);
                var body = await JsonNode.ParseAsync(context.Request.Body) as JsonObject ?? throw new StorageIssue("INVALID_REQUEST", "Yêu cầu lưu chưa hợp lệ.", 400);
                var expected = body["expectedEtag"]?.GetValue<string>() ?? throw new StorageIssue("MISSING_REVISION", "Hãy tải lại danh sách trước khi tiếp tục.", 409);
                result = path == "/api/storage" ? await store.Save(body["document"] as JsonObject ?? throw new StorageIssue("INVALID_REQUEST", "Danh sách chưa hợp lệ."), expected) : await store.Restore(body["backupId"]?.GetValue<string>() ?? "", expected);
            }
            else { context.Response.StatusCode = 405; await context.Response.WriteAsJsonAsync(new { code = "METHOD_NOT_ALLOWED", message = "Thao tác chưa được hỗ trợ." }); return; }
            await context.Response.WriteAsJsonAsync(result);
        }
        catch (StorageIssue error)
        {
            context.Response.StatusCode = error.Status;
            string? etag = null; try { etag = await store.CurrentEtag(); } catch { }
            await context.Response.WriteAsJsonAsync(new { code = error.Code, message = error.Message, etag });
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            context.Response.StatusCode = 503;
            await context.Response.WriteAsJsonAsync(path.StartsWith("/api/updates", StringComparison.Ordinal)
                ? new { code = "UPDATE_UNAVAILABLE", message = "Chưa cài được bản cập nhật. Giữ ứng dụng mở, kiểm tra quyền ghi và dung lượng thiết bị rồi thử lại." }
                : new { code = "STORAGE_UNAVAILABLE", message = "Chưa lưu được thay đổi. Giữ ứng dụng mở, kiểm tra thiết bị đang dùng rồi thử lại." });
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException or FormatException)
        {
            context.Response.StatusCode = 422; await context.Response.WriteAsJsonAsync(new { code = "INVALID_REQUEST", message = path.StartsWith("/api/profile", StringComparison.Ordinal) ? "Hồ sơ chưa hợp lệ. Bản trước vẫn được giữ nguyên." : "Danh sách chưa hợp lệ. Bản trước vẫn được giữ nguyên." });
        }
    }
}

