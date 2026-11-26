param([int]$Port = 17846)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$currentVersion = (Get-Content -LiteralPath (Join-Path $workspace 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
$versionParts = $currentVersion.Split('.')
$futureVersion = $versionParts[0] + '.' + $versionParts[1] + '.' + ([int]$versionParts[2] + 1)
$fixture = Join-Path $workspace ('build\update-process-' + [guid]::NewGuid().ToString('N'))
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Write-Utf8($Path, $Text) { [System.IO.File]::WriteAllText($Path, $Text, $utf8) }
function Assert($Condition, $Label) { if (-not $Condition) { throw $Label }; Write-Output "PASS $Label" }
function Wait-Server($Address) {
  for ($n = 0; $n -lt 80; $n++) {
    try { return Invoke-RestMethod "$Address/api/session" -TimeoutSec 1 } catch { Start-Sleep -Milliseconds 250 }
  }
  throw 'Fixture server did not start'
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw 'Fixture port already in use' }
New-Item -ItemType Directory -Path $fixture | Out-Null
try {
  foreach ($scenario in @('success', 'invalid-launcher', 'locked-file', 'health-failure')) {
    $install = Join-Path $fixture $scenario
    New-Item -ItemType Directory -Path (Join-Path $install 'app'), (Join-Path $install 'data\profile-images'), (Join-Path $install 'data\backups'), (Join-Path $install 'data\profile-backups') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $workspace 'build\launcher\Start.exe') -Destination (Join-Path $install 'Start.exe')
    Write-Utf8 (Join-Path $install 'app\index.html') '<!doctype html><title>Fixture old UI</title>'
    Write-Utf8 (Join-Path $install 'app\classquest-version.json') '{"app":"ClassQuest","version":"0.5.0","name":"Lớp Học Vui"}'
    foreach ($name in @('school-data.json', 'user-profile.json', 'profile-images\logo.png', 'backups\prior.json', 'profile-backups\prior.json')) { Write-Utf8 (Join-Path $install ('data\' + $name)) ('Synthetic retained bytes: ' + $name) }
    $before = @{}
    Get-ChildItem -LiteralPath (Join-Path $install 'data') -Recurse -File | ForEach-Object { $before[$_.FullName] = (Get-FileHash -LiteralPath $_.FullName).Hash }
    $stage = Join-Path $install ('.updates\' + [guid]::NewGuid().ToString('N'))
    # Start the parent first: its startup recovery should not discard our pending fixture.
    $parent = Start-Process -FilePath (Join-Path $install 'Start.exe') -ArgumentList '--no-browser', "--port=$Port" -WorkingDirectory $install -WindowStyle Hidden -PassThru
    $address = "http://127.0.0.1:$Port"
    $oldSession = Wait-Server $address
    New-Item -ItemType Directory -Path (Join-Path $stage 'next') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $workspace 'dist') -Destination (Join-Path $stage 'next\app') -Recurse
    Copy-Item -LiteralPath (Join-Path $workspace 'build\launcher\Start.exe') -Destination (Join-Path $stage 'next\Start.exe')
    if ($scenario -eq 'invalid-launcher') { Write-Utf8 (Join-Path $stage 'next\Start.exe') 'Synthetic invalid executable' }
    $targetVersion = $currentVersion
    if ($scenario -eq 'health-failure') {
      $targetVersion = $futureVersion
      Write-Utf8 (Join-Path $stage 'next\app\classquest-version.json') (@{app='ClassQuest';version=$futureVersion;name='Lớp Học Vui'} | ConvertTo-Json -Compress)
    }
    Copy-Item -LiteralPath (Join-Path $workspace 'build\launcher\Start.exe') -Destination (Join-Path $stage 'Updater.exe')
    $manifest = @{ ParentPid=$parent.Id; ParentStarted=$parent.StartTime.ToUniversalTime().Ticks; Port=$Port; Version=$targetVersion } | ConvertTo-Json
    Write-Utf8 (Join-Path $stage 'manifest.json') $manifest
    $locked = $null
    if ($scenario -eq 'locked-file') { $locked = [System.IO.File]::Open((Join-Path $install 'app\index.html'), 'Open', 'Read', 'Read') }
    $helper = Start-Process -FilePath (Join-Path $stage 'Updater.exe') -ArgumentList '--apply-update' -WorkingDirectory $stage -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 750
    Assert (-not $parent.HasExited -and (Get-Content -LiteralPath (Join-Path $install 'app\index.html') -Raw).Contains('Fixture old UI')) "$scenario waits for parent exit"
    Stop-Process -Id $parent.Id
    if (-not $helper.WaitForExit(60000)) { throw 'Updater helper timed out' }
    if ($locked) { $locked.Dispose() }
    $session = Wait-Server $address
    $result = Get-Content -LiteralPath (Join-Path $install '.updates\result.json') -Raw | ConvertFrom-Json
    Assert ($session.token -ne $oldSession.token) "$scenario restarts with a new session"
    $expected = if ($scenario -eq 'success') { 'success' } else { 'rolled-back' }
    Assert ($result.state -eq $expected) "$scenario transaction result"
    $marker = Invoke-RestMethod "$address/classquest-version.json"
    $expectedVersion = if ($scenario -eq 'success') { $currentVersion } else { '0.5.0' }
    Assert ($marker.version -eq $expectedVersion) "$scenario serves expected program"
    foreach ($file in $before.Keys) { Assert ((Get-FileHash -LiteralPath $file).Hash -eq $before[$file]) "$scenario retains $([System.IO.Path]::GetFileName($file))" }
    # Only processes whose executable is inside this isolated fixture can be stopped.
    Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($fixture + '\', [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 300
  }
  Write-Output 'Updater process smoke PASS: 4 scenarios'
} catch {
  Get-ChildItem -LiteralPath $fixture -Recurse -File -Filter '*error.log' | ForEach-Object { Get-Content -LiteralPath $_.FullName }
  throw
} finally {
  if ($locked) { $locked.Dispose() }
  $resolved = [System.IO.Path]::GetFullPath($fixture)
  if (-not $resolved.StartsWith((Join-Path $workspace 'build\update-process-'), [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe fixture cleanup path' }
  Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($resolved + '\', [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; Wait-Process -Id $_.ProcessId -Timeout 10 -ErrorAction SilentlyContinue }
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    try { Remove-Item -LiteralPath $resolved -Recurse -Force; break } catch { if ($attempt -eq 9) { Write-Warning 'Fixture cleanup delayed by a file lock.' }; Start-Sleep -Milliseconds 250 }
  }
}
