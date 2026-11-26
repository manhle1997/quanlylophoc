using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

internal sealed class StorageIssue(string code, string message, int status = 422) : Exception(message)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
}

internal static class DocumentValidator
{
    private static void Bad() => throw new StorageIssue("INVALID_DATA", "Danh sách lớp học chưa hợp lệ. Bản đã lưu vẫn được giữ nguyên.");
    private static JsonObject Obj(JsonNode? n) { if (n is JsonObject o) return o; Bad(); return null!; }
    private static JsonArray Arr(JsonNode? n) { if (n is JsonArray a) return a; Bad(); return null!; }
    private static string Str(JsonNode? n, int max, bool empty = false)
    {
        if (n is not JsonValue v || !v.TryGetValue<string>(out var s) || s is null || s.Length > max * 2 || s.EnumerateRunes().Count() > max || (!empty && string.IsNullOrWhiteSpace(s))) { Bad(); return null!; }
        return s;
    }
    private static string Id(JsonNode? n) { var id = Str(n, 200); if (!Regex.IsMatch(id, "^[A-Za-z0-9][A-Za-z0-9_-]*$")) Bad(); return id; }
    private static void Bool(JsonNode? n) { if (n is not JsonValue v || !v.TryGetValue<bool>(out _)) Bad(); }
    private static void Enum(JsonNode? n, params string[] choices) { if (!choices.Contains(Str(n, 50), StringComparer.Ordinal)) Bad(); }
    private static void Date(JsonNode? n) { var date = Str(n, 60); if (!date.Contains('T') || !DateTimeOffset.TryParse(date, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _)) Bad(); }
    public static long Revision(JsonObject doc) { if (doc["revision"] is not JsonValue v || !v.TryGetValue<long>(out var r) || r < 0 || r > 9007199254740990) { Bad(); return 0; } return r; }
    public static JsonObject Validate(JsonNode? input)
    {
        var doc = Obj(input);
        if (doc["schemaVersion"] is JsonValue version && version.TryGetValue<int>(out var schema) && schema > 2) throw new StorageIssue("FUTURE_SCHEMA", "Dữ liệu cần một phiên bản Lớp Học Vui mới hơn. Bản hiện tại được giữ nguyên.");
        if (doc["schemaVersion"]?.ToJsonString() is not ("1" or "2")) Bad();
        Id(doc["documentId"]); Revision(doc); Date(doc["updatedAt"]); Str(doc["schoolName"], 120, true);
        var seen = new HashSet<string>(StringComparer.Ordinal); var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase); var members = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var entry in Arr(doc["classes"]))
        {
            var c = Obj(entry); var classId = Id(c["id"]); if (!seen.Add(classId)) Bad();
            var name = Str(c["name"], 60).Normalize().Trim(); var year = Str(c["schoolYear"], 30, true).Normalize().Trim(); if (!names.Add(name + "\0" + year)) Bad(); Bool(c["archived"]);
            var ids = new HashSet<string>(StringComparer.Ordinal); members.Add(classId, ids);
            foreach (var student in Arr(c["students"])) { var s = Obj(student); var studentId = Id(s["id"]); if (!seen.Add(studentId)) Bad(); ids.Add(studentId); Str(s["fullName"], 80); Str(s["labelSuffix"], 30, true); Bool(s["active"]); }
        }
        var roundClasses = new HashSet<string>(); var roundIds = new HashSet<string>();
        foreach (var entry in Arr(doc["rounds"]))
        {
            var r = Obj(entry); var classId = Id(r["classId"]); if (!members.TryGetValue(classId, out var ids) || !roundClasses.Add(classId) || !roundIds.Add(Id(r["roundId"]))) { Bad(); continue; }
            var called = new HashSet<string>(); foreach (var value in Arr(r["calledStudentIds"])) { var studentId = Id(value); if (!ids.Contains(studentId) || !called.Add(studentId)) Bad(); }
        }
        var plays = new HashSet<string>(); var historyIds = new HashSet<string>();
        foreach (var entry in Arr(doc["history"]))
        {
            var h = Obj(entry); var classId = Id(h["classId"]); if (!members.TryGetValue(classId, out var ids) || !ids.Contains(Id(h["studentId"])) || !plays.Add(Id(h["playId"])) || !historyIds.Add(Id(h["id"]))) Bad();
            Enum(h["mode"], "normal", "unique"); Enum(h["gameId"], "fishing", "ufo", "claw", "marble", "treasure"); Date(h["revealedAt"]);
            if (h["roundId"] is not null) Id(h["roundId"]); else if (h["mode"]!.GetValue<string>() == "unique") Bad();
        }
        var settings = Obj(doc["settings"]); Enum(settings["mode"], "normal", "unique"); Enum(settings["durationPreset"], "quick", "normal", "dramatic"); Enum(settings["hookMode"], "random", "0", "1", "2"); Enum(settings["quality"], "auto", "low", "medium", "high");
        var attendanceDays = new HashSet<string>(); var attendanceIds = new HashSet<string>();
        var records = doc["schemaVersion"]!.GetValue<int>() == 1 && doc["attendanceRecords"] is null ? new JsonArray() : Arr(doc["attendanceRecords"]);
        foreach (var entry in records)
        {
            var record = Obj(entry); var classId = Id(record["classId"]); var day = Str(record["date"], 10);
            if (!members.TryGetValue(classId, out var ids) || !attendanceIds.Add(Id(record["id"])) || !DateOnly.TryParseExact(day, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _) || !attendanceDays.Add(classId + ":" + day)) { Bad(); continue; }
            Date(record["updatedAt"]); var students = new HashSet<string>();
            foreach (var attendance in Arr(record["entries"])) { var e = Obj(attendance); var studentId = Id(e["studentId"]); if (!ids.Contains(studentId) || !students.Add(studentId)) Bad(); Enum(e["status"], "present", "late", "excused", "absent"); }
        }
        foreach (var key in new[] { "soundEnabled", "musicEnabled", "reducedMotion" }) Bool(settings[key]);
        if (settings["volume"] is not JsonValue volume || !volume.TryGetValue<double>(out var number) || !double.IsFinite(number) || number < 0 || number > 1) Bad();
        return doc;
    }
}
