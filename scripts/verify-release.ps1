param([switch]$ArchiveOnly)

$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$version = (Get-Content -LiteralPath (Join-Path $workspacePath 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
$zipPath = Join-Path $workspacePath "release/Lop-Hoc-Vui-$version-rc-win-x64.zip"
$installedPath = Join-Path $workspacePath "release/ClassQuest-$version/ClassQuest"
$expectedHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$checksum = [IO.File]::ReadAllText($zipPath + '.sha256').Trim()
if ($checksum -ne ($expectedHash + '  ' + [IO.Path]::GetFileName($zipPath))) { throw 'Checksum or archive name does not match.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
$entryCount = $archive.Entries.Count
try {
    foreach ($entry in $archive.Entries) {
        $name = $entry.FullName
        if (-not $name.StartsWith('ClassQuest/') -or $name.Contains('..') -or $name.Contains('\')) { throw 'Unexpected archive path.' }
        if ($name.StartsWith('ClassQuest/data/') -and $name -ne 'ClassQuest/data/backups/') { throw 'Archive contains user data.' }
        if ($name.EndsWith('/')) { continue }
        $relative = $name.Substring('ClassQuest/'.Length)
        $source = if ($relative.StartsWith('app/')) { Join-Path $workspacePath ('dist/' + $relative.Substring(4)) } elseif ($relative -eq 'Start.exe') { Join-Path $workspacePath 'build/launcher/Start.exe' } else { Join-Path $installedPath $relative }
        $stream = $entry.Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $entryHash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
        finally { $sha.Dispose(); $stream.Dispose() }
        if ($entryHash -ne (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "Archive differs from verified build: $relative" }
    }
    foreach ($sourceFile in Get-ChildItem -LiteralPath (Join-Path $workspacePath 'dist') -Recurse -File) {
        $relative = $sourceFile.FullName.Substring((Join-Path $workspacePath 'dist').Length + 1).Replace('\','/')
        if (-not $archive.GetEntry('ClassQuest/app/' + $relative)) { throw "Missing app entry: $relative" }
    }
} finally { $archive.Dispose() }
if ($ArchiveOnly) {
    Write-Output "PASS: $entryCount ZIP entries and SHA-256 match build; application was not started."
    Write-Output "SHA-256: $expectedHash"
    return
}
$port = 17845
$probe = [Net.Sockets.TcpClient]::new()
try { $probe.Connect('127.0.0.1', $port); throw 'Smoke port is occupied; existing application is preserved.' }
catch [Net.Sockets.SocketException] { }
finally { $probe.Dispose() }
$smokePath = [IO.Path]::GetFullPath((Join-Path $workspacePath ('build/release-smoke-' + [guid]::NewGuid().ToString('N'))))
$buildBoundary = [IO.Path]::GetFullPath((Join-Path $workspacePath 'build')) + [IO.Path]::DirectorySeparatorChar
if (-not $smokePath.StartsWith($buildBoundary, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe smoke target.' }
$process = $null
try {
    [IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $smokePath)
    $process = Start-Process -FilePath (Join-Path $smokePath 'ClassQuest/Start.exe') -ArgumentList '--no-browser',"--port=$port" -WorkingDirectory $workspacePath -WindowStyle Hidden -PassThru
    $origin = "http://127.0.0.1:$port"
    $marker = $null
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        try { $marker = Invoke-RestMethod -Uri "$origin/classquest-version.json" -TimeoutSec 1; break } catch { Start-Sleep -Milliseconds 100 }
    }
    if ($marker.version -ne $version) { throw 'Extracted release did not boot with the current version.' }
    $session = Invoke-RestMethod -Uri "$origin/api/session"
    if ($session.version -ne $version) { throw 'Launcher version does not match app version.' }
    $headers = @{ 'X-ClassQuest-Token' = $session.token; Origin = $origin }
    $classes = Invoke-RestMethod -Uri "$origin/api/storage" -Headers $headers
    $profile = Invoke-RestMethod -Uri "$origin/api/profile" -Headers $headers
    if ($null -ne $classes.document -or $null -ne $profile.profile) { throw 'Extracted release contains user data.' }
    Write-Output "PASS: $entryCount ZIP entries, app/executable bytes match verified build; empty class/profile data; extracted launcher $version boots."
    Write-Output "SHA-256: $expectedHash"
} finally {
    if ($null -ne $process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force; $process.WaitForExit() }
    if (Test-Path -LiteralPath $smokePath) {
        $resolvedSmoke = [IO.Path]::GetFullPath($smokePath)
        if (-not $resolvedSmoke.StartsWith($buildBoundary, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe cleanup target.' }
        Remove-Item -LiteralPath $resolvedSmoke -Recurse -Force
    }
}
