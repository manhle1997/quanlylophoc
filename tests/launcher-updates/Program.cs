using System.IO.Compression;
using System.Text.Json;

var root = Path.GetFullPath(args[0]);
if (!Path.GetFileName(root).StartsWith("update-tests-")) throw new Exception("Use an isolated fixture directory");
Directory.CreateDirectory(root);
var count = 0;
void Check(bool ok, string label) { if (!ok) throw new Exception(label); count++; Console.WriteLine($"PASS {label}"); }
void Reject(Action action, string label) { try { action(); } catch { Check(true, label); return; } throw new Exception(label); }
object Release(string version, bool draft = false, bool prerelease = false, string? digest = null) => new {
    tag_name = "v" + version, draft, prerelease, published_at = draft ? null : "2026-11-26T00:00:00Z",
    assets = new[] { new { name = $"Lop-Hoc-Vui-{version}-rc-win-x64.zip", state = "uploaded", size = 1234, digest = digest ?? "sha256:" + new string('a', 64), browser_download_url = $"https://github.com/{UpdateService.Repository}/releases/download/v{version}/Lop-Hoc-Vui-{version}-rc-win-x64.zip" } }
};
UpdateRelease? Select(params object[] values) { using var json = JsonDocument.Parse(JsonSerializer.Serialize(values)); return UpdateService.SelectRelease(json.RootElement, "0.5.1"); }
Check(Select(Release("0.5.1"), Release("0.4.9"), Release("0.6.0", true)) is null, "ignore same version, downgrades and drafts");
Check(Select(Release("0.5.9"), Release("0.5.10", prerelease: true)) is { Version: "0.5.10", Prerelease: true }, "numeric version ordering and labelled published prereleases");
Reject(() => Select(Release("0.5.2", digest: "")), "reject missing GitHub SHA-256 digest");
using (var malicious = JsonDocument.Parse(JsonSerializer.Serialize(new[] { Release("0.5.2") }).Replace("https://github.com/", "https://untrusted.example/"))) Reject(() => UpdateService.SelectRelease(malicious.RootElement, "0.5.1"), "reject foreign download URLs");

string Archive(string name, Action<ZipArchive> fill) { var file = Path.Combine(root, name + ".zip"); using var zip = ZipFile.Open(file, ZipArchiveMode.Create); fill(zip); return file; }
void Entry(ZipArchive zip, string name, string value = "") { using var writer = new StreamWriter(zip.CreateEntry(name).Open()); writer.Write(value); }
void ProgramEntries(ZipArchive zip, string version = "0.5.2") {
    using (var output = zip.CreateEntry("ClassQuest/Start.exe").Open()) output.Write(SyntheticExe());
    Entry(zip, "ClassQuest/app/index.html", "new UI");
    Entry(zip, "ClassQuest/app/classquest-version.json", JsonSerializer.Serialize(new { app = "ClassQuest", version }));
}
byte[] SyntheticExe() { var bytes = new byte[256]; bytes[0] = 0x4D; bytes[1] = 0x5A; bytes[60] = 64; bytes[64] = 0x50; bytes[65] = 0x45; bytes[68] = 0x64; bytes[69] = 0x86; bytes[88] = 0x0B; bytes[89] = 0x02; return bytes; }
foreach (var bad in new[] { "ClassQuest/../escape", "ClassQuest/app/../../escape", "ClassQuest/app/x:stream", "ClassQuest/app/CON.txt", "ClassQuest/app/trailing. ", "ClassQuest/data/school-data.json", "Other/app.js", "ClassQuest/.updates/anything", "ClassQuest/app/x\\evil" }) {
    var zip = Archive("bad-" + count, z => { ProgramEntries(z); Entry(z, bad, "unsafe"); });
    Reject(() => UpdateInstaller.Extract(zip, Path.Combine(root, "bad-output-" + count), "0.5.2"), "reject " + bad);
}
var duplicate = Archive("duplicate", z => { ProgramEntries(z); Entry(z, "ClassQuest/app/INDEX.html", "duplicate"); });
Reject(() => UpdateInstaller.Extract(duplicate, Path.Combine(root, "duplicate-output"), "0.5.2"), "reject case-insensitive duplicate paths");
var linked = Archive("linked", z => { ProgramEntries(z); var entry = z.CreateEntry("ClassQuest/app/link"); entry.ExternalAttributes = unchecked((int)0xA1FF0000); });
Reject(() => UpdateInstaller.Extract(linked, Path.Combine(root, "link-output"), "0.5.2"), "reject archive symlinks");
var mismatch = Archive("mismatch", z => ProgramEntries(z, "9.9.9"));
Reject(() => UpdateInstaller.Extract(mismatch, Path.Combine(root, "mismatch-output"), "0.5.2"), "reject archive marker mismatch");
var invalidExe = Archive("invalid-exe", z => { Entry(z, "ClassQuest/Start.exe", "invalid"); Entry(z, "ClassQuest/app/index.html"); Entry(z, "ClassQuest/app/classquest-version.json", "{\"app\":\"ClassQuest\",\"version\":\"0.5.2\"}"); });
Reject(() => UpdateInstaller.Extract(invalidExe, Path.Combine(root, "invalid-exe-output"), "0.5.2"), "reject a malformed executable before Windows loader runs");
var wrongMachine = SyntheticExe(); wrongMachine[68] = 0x4C; wrongMachine[69] = 0x01;
var foreignExe = Archive("foreign-exe", z => { using (var output = z.CreateEntry("ClassQuest/Start.exe").Open()) output.Write(wrongMachine); Entry(z, "ClassQuest/app/index.html"); Entry(z, "ClassQuest/app/classquest-version.json", "{\"app\":\"ClassQuest\",\"version\":\"0.5.2\"}"); });
Reject(() => UpdateInstaller.Extract(foreignExe, Path.Combine(root, "foreign-exe-output"), "0.5.2"), "reject an executable for a different architecture");

var installed = Path.Combine(root, "installed"); Directory.CreateDirectory(installed);
var stage = Path.Combine(installed, ".updates", new string('a', 32)); Directory.CreateDirectory(stage);
var valid = Archive("valid", z => { ProgramEntries(z); Entry(z, "ClassQuest/data/"); Entry(z, "ClassQuest/data/backups/"); });
UpdateInstaller.Extract(valid, Path.Combine(stage, "next"), "0.5.2");
Directory.CreateDirectory(Path.Combine(installed, "app"));
File.WriteAllText(Path.Combine(installed, "Start.exe"), "old binary"); File.WriteAllText(Path.Combine(installed, "app", "old.js"), "old UI");
var data = new Dictionary<string, byte[]> { ["school-data.json"] = [1, 2, 3], ["user-profile.json"] = [4, 5, 6], ["profile-images/logo.png"] = [7, 8], ["backups/old.json"] = [9, 10], ["profile-backups/old.json"] = [11, 12] };
foreach (var (name, bytes) in data) { var file = Path.Combine(installed, "data", name); Directory.CreateDirectory(Path.GetDirectoryName(file)!); File.WriteAllBytes(file, bytes); }
bool DataIntact() => data.All(pair => File.ReadAllBytes(Path.Combine(installed, "data", pair.Key)).SequenceEqual(pair.Value));
UpdateInstaller.Install(installed, stage, "0.5.2");
Check(File.ReadAllBytes(Path.Combine(installed, "Start.exe")).SequenceEqual(SyntheticExe()) && !File.Exists(Path.Combine(installed, "app", "old.js")), "replace program files and remove stale assets");
Check(DataIntact(), "install preserves every data/profile/image/backup byte");
UpdateInstaller.Rollback(installed, stage);
Check(File.ReadAllText(Path.Combine(installed, "Start.exe")) == "old binary" && File.Exists(Path.Combine(installed, "app", "old.js")) && DataIntact(), "rollback restores program and preserves data");
// Simulate power loss after moving the first original, before the next entry installs.
Directory.CreateDirectory(Path.Combine(stage, "previous"));
File.WriteAllText(Path.Combine(stage, "journal.json"), JsonSerializer.Serialize(new[] { "app", "Start.exe" }));
Directory.Move(Path.Combine(installed, "app"), Path.Combine(stage, "previous", "app"));
UpdateInstaller.RecoverInterrupted(installed);
Check(File.Exists(Path.Combine(installed, "app", "old.js")) && File.ReadAllText(Path.Combine(installed, "Start.exe")) == "old binary" && DataIntact(), "recover an interrupted replacement at next launch");
Reject(() => UpdateInstaller.RemoveStage(installed), "cleanup cannot delete installation root");
// Exercise the production download path with an in-memory transport, never Internet.
var package = File.ReadAllBytes(valid);
var downloadRoot = Path.Combine(root, "download"); Directory.CreateDirectory(downloadRoot);
var requests = new List<string>();
var corrupt = false;
HttpClient Transport() => new(new FakeHandler(request => {
    requests.Add(request.RequestUri!.AbsoluteUri);
    if (request.RequestUri.Host == "api.github.com") {
        var metadata = JsonSerializer.Serialize(new[] { new {
            tag_name = "v0.5.2", draft = false, prerelease = false, published_at = "2026-11-26T00:00:00Z",
            assets = new[] { new { name = "Lop-Hoc-Vui-0.5.2-rc-win-x64.zip", state = "uploaded", size = package.Length, digest = "sha256:" + Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(package)), browser_download_url = $"https://github.com/{UpdateService.Repository}/releases/download/v0.5.2/Lop-Hoc-Vui-0.5.2-rc-win-x64.zip" } }
        } });
        return new(System.Net.HttpStatusCode.OK) { Content = new StringContent(metadata) };
    }
    var bytes = package.ToArray(); if (corrupt) bytes[0] ^= 1;
    return new(System.Net.HttpStatusCode.OK) { Content = new ByteArrayContent(bytes) };
}));
async Task<UpdateStatus> Finished(UpdateService service) {
    for (var n = 0; n < 200; n++) { var s = service.Status; if (s.State is not ("checking" or "downloading")) { await Task.Delay(10); return s; } await Task.Delay(10); }
    throw new Exception("Update operation timed out");
}
var service = new UpdateService(downloadRoot, "0.5.1", 17846, Transport);
Check(service.Status.State == "idle" && requests.Count == 0, "startup and local status make no remote requests");
service.Start(false); Check((await Finished(service)).State == "available", "explicit check discovers valid published package");
service.Start(true); Check((await Finished(service)).State == "ready", "download verifies hash and stages a valid ZIP");
var corruptService = new UpdateService(Path.Combine(root, "corrupt-download"), "0.5.1", 17846, Transport);
Directory.CreateDirectory(Path.Combine(root, "corrupt-download"));
corruptService.Start(false); await Finished(corruptService); corrupt = true;
corruptService.Start(true); var failed = await Finished(corruptService);
Check(failed.State == "error" && failed.Message!.Contains("mã kiểm tra"), "corrupt downloaded bytes never become installable");
Check(!Directory.GetDirectories(Path.Combine(root, "corrupt-download", ".updates")).Any() && DataIntact(), "failed download cleans only staging and leaves installation data untouched");
File.WriteAllText(Path.Combine(downloadRoot, ".updates", "result.json"), "{\"state\":\"rolled-back\",\"version\":\"0.5.2\"}");
Check(new UpdateService(downloadRoot, "0.5.1", 17846).Status.Message?.Contains("quay về bản trước") == true, "show a rollback result after returning to an older version");
Check(new UpdateService(downloadRoot, "0.5.2", 17846).Status.Message is null, "do not show a stale rollback message after a later successful upgrade");
Console.WriteLine($"Updater checks PASS: {count}");

internal sealed class StorageIssue(string code, string message, int status = 422) : Exception(message) { public string Code => code; public int Status => status; }
internal sealed class FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler {
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(respond(request));
}
