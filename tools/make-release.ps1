# Сборка релиза local.ai+: dist/localai-plus-vX.Y.Z.zip
# Запуск из корня репозитория: powershell -ExecutionPolicy Bypass -File tools\make-release.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $root 'VERSION') -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "В VERSION должна быть версия вида 1.2.3, а там: $version" }

# 1. Версия во все manifest.json расширений
foreach ($manifest in (Get-ChildItem (Join-Path $root 'addon\extensions') -Recurse -Filter manifest.json)) {
    $text = [IO.File]::ReadAllText($manifest.FullName)
    $text = [regex]::Replace($text, '"version":\s*"[^"]*"', "`"version`": `"$version`"")
    [IO.File]::WriteAllText($manifest.FullName, $text, (New-Object Text.UTF8Encoding $false))
}
Write-Host "Версия $version проставлена в manifest.json"

# 2. Переводы должны сходиться (нужен Node.js — он и так нужен для SillyTavern)
if (Get-Command node -ErrorAction SilentlyContinue) {
    & node (Join-Path $root 'tools\check-locales.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Переводы не сходятся — см. вывод выше' }
}

# 3. Скрипты и строки PowerShell — UTF-8 с BOM и CRLF (иначе Windows PowerShell 5.1 ломает кириллицу)
$psFiles = Get-ChildItem (Join-Path $root 'installer'), (Join-Path $root 'tools') -Recurse -Include *.ps1, *.psd1
foreach ($ps in $psFiles) {
    $text = [IO.File]::ReadAllText($ps.FullName) -replace "`r?`n", "`r`n"
    [IO.File]::WriteAllText($ps.FullName, $text, (New-Object Text.UTF8Encoding $true))
}
foreach ($bat in (Get-ChildItem $root -Filter *.bat)) {
    $text = [IO.File]::ReadAllText($bat.FullName) -replace "`r?`n", "`r`n"
    [IO.File]::WriteAllText($bat.FullName, $text, [Text.Encoding]::ASCII)
}

# 4. Архив
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist "localai-plus-v$version"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($item in @('install.bat', 'uninstall.bat', 'VERSION', 'README.md', 'CHANGELOG.md', 'LICENSE', 'installer', 'addon', 'docs')) {
    Copy-Item (Join-Path $root $item) $stage -Recurse
}
# служебное, которое не должно попасть к пользователю (кэш превью, тяжёлые скриншоты для README)
Get-ChildItem $stage -Recurse -Directory -Filter thumbs | Remove-Item -Recurse -Force
$shots = Join-Path $stage 'docs\screenshots'
if (Test-Path $shots) { Remove-Item $shots -Recurse -Force }

$zip = Join-Path $dist "localai-plus-v$version.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force
Write-Host "Готово: $zip ($([math]::Round((Get-Item $zip).Length / 1KB)) КБ)"
