param([Parameter(Mandatory=$true)][string]$SourcePath, [Parameter(Mandatory=$true)][string]$ZipPath)
$ErrorActionPreference = 'Stop'
$workspacePath = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$archiveBoundaries = @('release','build') | ForEach-Object { [System.IO.Path]::GetFullPath((Join-Path $workspacePath $_)) + [System.IO.Path]::DirectorySeparatorChar }
$resolvedSource = [System.IO.Path]::GetFullPath($SourcePath)
$resolvedZip = [System.IO.Path]::GetFullPath($ZipPath)
foreach ($archiveTarget in @($resolvedSource,$resolvedZip)) {
  if (-not @($archiveBoundaries | Where-Object { $archiveTarget.StartsWith($_,[System.StringComparison]::OrdinalIgnoreCase) }).Count) { throw 'Archive paths must remain in workspace/build or workspace/release.' }
}
if (Test-Path -LiteralPath $resolvedZip) { throw 'ZIP already exists; preserving it.' }
if ((Get-Item -LiteralPath $resolvedSource -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Archive source cannot be a link.' }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archiveRootName = [System.IO.Path]::GetFileName($resolvedSource)
$temporaryZip = $resolvedZip + '.' + [guid]::NewGuid().ToString('N') + '.tmp'
$archive = $null
function Add-ProgramEntry([string]$EntryPath) {
  $archiveItem = Get-Item -LiteralPath $EntryPath -Force
  if ($archiveItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Archive entries cannot be links.' }
  if ($archiveItem.PSIsContainer) {
    foreach ($archiveChild in Get-ChildItem -LiteralPath $EntryPath -Force) { Add-ProgramEntry -EntryPath $archiveChild.FullName }
  } else {
    $entryName = $archiveRootName + '/' + $archiveItem.FullName.Substring($resolvedSource.Length + 1).Replace('\','/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$archiveItem.FullName,$entryName,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
}
try {
  $archive = [System.IO.Compression.ZipFile]::Open($temporaryZip,[System.IO.Compression.ZipArchiveMode]::Create)
  # Explicit program whitelist: never archive installed class data, backups or unrelated files.
  foreach ($programName in @('Start.exe','Start.staticwebassets.endpoints.json','web.config','README-VI.txt','THIRD_PARTY_NOTICES.txt','app','licenses')) {
    $programPath = Join-Path $resolvedSource $programName
    if (Test-Path -LiteralPath $programPath) { Add-ProgramEntry -EntryPath $programPath }
  }
  $archive.CreateEntry($archiveRootName + '/data/backups/') | Out-Null
  $archive.Dispose(); $archive = $null
  [System.IO.File]::Move($temporaryZip,$resolvedZip)
} finally {
  if ($archive) { $archive.Dispose() }
  if (Test-Path -LiteralPath $temporaryZip) { Remove-Item -LiteralPath $temporaryZip -Force }
}
