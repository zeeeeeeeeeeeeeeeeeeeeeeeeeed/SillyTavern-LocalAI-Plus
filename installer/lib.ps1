# local.ai+ — общие функции установщика (Windows PowerShell 5.1+).
# Подключается из install.ps1 / uninstall.ps1 через dot-sourcing.
# Тексты — в installer/i18n/<язык>.psd1; новый язык = новый файл + строка в $script:Languages.

$ErrorActionPreference = 'Stop'
$script:RepoRoot = Split-Path -Parent $PSScriptRoot
$script:StateDir = Join-Path $env:LOCALAPPDATA 'localai-plus'
$script:StateFile = Join-Path $script:StateDir 'install.json'
$script:MinStVersion = [version]'1.13.0'

# ---------------------------------------------------------------- язык установщика

$script:Languages = [ordered]@{ ru = 'Русский'; en = 'English' }
$script:Text = @{}

function Select-InstallerLanguage {
    $default = 'en'
    if ((Get-Culture).TwoLetterISOLanguageName -eq 'ru' -or (Get-UICulture).TwoLetterISOLanguageName -eq 'ru') { $default = 'ru' }
    $codes = @($script:Languages.Keys)
    Write-Host ''
    Write-Host '  Language / Язык:'
    for ($i = 0; $i -lt $codes.Count; $i++) { Write-Host ("    {0}) {1}" -f ($i + 1), $script:Languages[$codes[$i]]) }
    $defaultIndex = [array]::IndexOf($codes, $default) + 1
    $answer = Read-Host "  [$defaultIndex]"
    $n = 0
    $code = $default
    if ([int]::TryParse($answer, [ref]$n) -and $n -ge 1 -and $n -le $codes.Count) { $code = $codes[$n - 1] }
    Use-InstallerLanguage $code
}

function Use-InstallerLanguage($code) {
    $script:Text = Import-PowerShellDataFile (Join-Path $PSScriptRoot "i18n\$code.psd1")
}

# Строка по ключу; {0}, {1} заменяются аргументами
function L($key) {
    $text = $script:Text[$key]
    if (-not $text) { $text = $key }
    if ($args.Count) { return ($text -f $args) }
    return $text
}

# ---------------------------------------------------------------- вывод и вопросы

function Write-Step($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "  [ok] $text" -ForegroundColor Green }
function Write-Info($text) { Write-Host "  $text" }
function Write-Warn2($text) { Write-Host "  [!] $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "`n[$(L Error)] $text" -ForegroundColor Red; throw $text }

function Ask($question, $default = '') {
    $suffix = ''
    if ($default -ne '') { $suffix = " [$default]" }
    $answer = Read-Host "  $question$suffix"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $default }
    return $answer.Trim().Trim('"')
}

function AskYesNo($question, $defaultYes = $true) {
    $y = L Yes; $n = L No
    $hint = "$($y.ToUpper())/$n"
    if (-not $defaultYes) { $hint = "$y/$($n.ToUpper())" }
    while ($true) {
        $a = (Read-Host "  $question ($hint)").Trim().ToLower()
        if ($a -eq '') { return $defaultYes }
        if ($a -in @('y', 'yes', 'д', 'да', $y)) { return $true }
        if ($a -in @('n', 'no', 'н', 'нет', $n)) { return $false }
    }
}

function Get-AddonVersion {
    return (Get-Content (Join-Path $script:RepoRoot 'VERSION') -Raw).Trim()
}

# ---------------------------------------------------------------- поиск SillyTavern

function Test-StFolder($path) {
    return ($path -and (Test-Path (Join-Path $path 'server.js')) -and (Test-Path (Join-Path $path 'public\script.js')))
}

function Get-StVersion($stPath) {
    try {
        return [version]((Get-Content (Join-Path $stPath 'package.json') -Raw | ConvertFrom-Json).version)
    } catch {
        return $null
    }
}

# Где обычно лежит SillyTavern: рядом с распакованным архивом, в профиле, на дисках (на 2 уровня вглубь)
function Find-StCandidates {
    $roots = @(
        (Split-Path -Parent $script:RepoRoot),
        (Split-Path -Parent (Split-Path -Parent $script:RepoRoot)),
        $env:USERPROFILE,
        (Join-Path $env:USERPROFILE 'Documents'),
        (Join-Path $env:USERPROFILE 'Desktop'),
        (Join-Path $env:USERPROFILE 'Downloads')
    )
    foreach ($drive in (Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) { $roots += $drive.Root }

    $skip = '^(Windows|Program Files.*|ProgramData|\$.*|AppData|node_modules|System Volume Information)$'
    $found = @()
    foreach ($root in ($roots | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique)) {
        if (Test-StFolder $root) { $found += (Resolve-Path $root).Path }
        foreach ($dir in (Get-ChildItem $root -Directory -ErrorAction SilentlyContinue)) {
            if ($dir.Name -match $skip) { continue }
            if (Test-StFolder $dir.FullName) { $found += $dir.FullName; continue }
            foreach ($sub in (Get-ChildItem $dir.FullName -Directory -ErrorAction SilentlyContinue)) {
                if ($sub.Name -notmatch $skip -and (Test-StFolder $sub.FullName)) { $found += $sub.FullName }
            }
        }
    }
    return ($found | Select-Object -Unique)
}

function Test-StRunning {
    try {
        $r = Invoke-WebRequest 'http://127.0.0.1:8000/version' -UseBasicParsing -TimeoutSec 2
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Read-StPath {
    Write-Info (L HowToFind)
    while ($true) {
        $p = Ask (L AskPath)
        if (Test-StFolder $p) { return (Resolve-Path $p).Path }
        Write-Warn2 (L NotStFolder $p)
    }
}

function Select-StPath($given) {
    if ($given) {
        if (Test-StFolder $given) { return (Resolve-Path $given).Path }
        Fail (L NotStFolder $given)
    }

    $state = Load-State
    if ($state -and (Test-StFolder $state.sillyTavernPath)) {
        Write-Info (L LastTime $state.sillyTavernPath)
        if (AskYesNo (L UpdateThere)) { return $state.sillyTavernPath }
    }

    Write-Info (L Searching)
    $found = @(Find-StCandidates)

    if ($found.Count -eq 1) {
        Write-Ok (L FoundOne $found[0])
        if (AskYesNo (L InstallHere)) { return $found[0] }
        return Read-StPath
    }

    if ($found.Count -gt 1) {
        Write-Info (L FoundMany)
        for ($i = 0; $i -lt $found.Count; $i++) { Write-Host ("    {0}) {1}" -f ($i + 1), $found[$i]) }
        Write-Host ("    {0}) {1}" -f ($found.Count + 1), (L OtherFolder))
        while ($true) {
            $n = 0
            $a = Ask (L WhereToInstall) '1'
            if ([int]::TryParse($a, [ref]$n) -and $n -ge 1 -and $n -le $found.Count + 1) { break }
        }
        if ($n -le $found.Count) { return $found[$n - 1] }
        return Read-StPath
    }

    Write-Warn2 (L NotFound)
    return Read-StPath
}

# ---------------------------------------------------------------- config.yaml SillyTavern

function Set-YamlKey($text, $key, $value) {
    $pattern = "(?m)^$([regex]::Escape($key)):.*$"
    if ($text -match $pattern) { return [regex]::Replace($text, $pattern, "${key}: $value") }
    return $text.TrimEnd() + "`n${key}: $value`n"
}

function Edit-StConfig($stPath, [scriptblock]$change) {
    $config = Join-Path $stPath 'config.yaml'
    if (-not (Test-Path $config)) {
        # SillyTavern ещё ни разу не запускали: берём шаблон, а если его нет — пустой файл.
        # При запуске SillyTavern сам допишет все недостающие ключи со значениями по умолчанию.
        $template = Join-Path $stPath 'default\config.yaml'
        if (Test-Path $template) { Copy-Item $template $config } else { [IO.File]::WriteAllText($config, '') }
    }
    $backup = "$config.before-localai"
    if (-not (Test-Path $backup)) { Copy-Item $config $backup }
    $text = [IO.File]::ReadAllText($config)
    $text = & $change $text
    [IO.File]::WriteAllText($config, $text, (New-Object Text.UTF8Encoding $false))
}

# ---------------------------------------------------------------- дополнение

function Get-AddonExtensions {
    return (Get-ChildItem (Join-Path $script:RepoRoot 'addon\extensions') -Directory)
}

function Install-Addon($stPath, $multilingualMemory) {
    $addon = Join-Path $script:RepoRoot 'addon'

    # Расширения интерфейса — в данные пользователя default-user (обновление SillyTavern их не затрёт)
    $extDir = Join-Path $stPath 'data\default-user\extensions'
    New-Item -ItemType Directory -Force $extDir | Out-Null
    foreach ($ext in (Get-AddonExtensions)) {
        $target = Join-Path $extDir $ext.Name
        if (Test-Path $target) { Remove-Item $target -Recurse -Force }
        Copy-Item $ext.FullName $target -Recurse
        Write-Ok (L InstalledExt $ext.Name)
    }

    # Серверный плагин каталога; config.json пользователя (настройка прокси) не перезаписываем
    $pluginSrc = Join-Path $addon 'plugins\localai-card-sources'
    $pluginDst = Join-Path $stPath 'plugins\localai-card-sources'
    New-Item -ItemType Directory -Force $pluginDst | Out-Null
    Copy-Item (Join-Path $pluginSrc 'index.mjs') $pluginDst -Force
    if (-not (Test-Path (Join-Path $pluginDst 'config.json'))) { Copy-Item (Join-Path $pluginSrc 'config.json') $pluginDst }
    Write-Ok (L InstalledPlugin)

    Edit-StConfig $stPath {
        param($t)
        $t = Set-YamlKey $t 'enableServerPlugins' 'true'
        $t = Set-YamlKey $t 'enableServerPluginsAutoUpdate' 'false'
        if ($multilingualMemory) {
            # мультиязычная модель для поиска по старым сообщениям (стандартная понимает только английский)
            $t = [regex]::Replace($t, '(?m)^(\s+embedding:).*$', '$1 Xenova/multilingual-e5-small')
        }
        return $t
    }
    Write-Ok (L ConfigPlugins)
    if ($multilingualMemory) { Write-Ok (L ConfigMemory) }
}

function Remove-Addon($stPath) {
    $extDir = Join-Path $stPath 'data\default-user\extensions'
    foreach ($ext in (Get-AddonExtensions)) {
        $target = Join-Path $extDir $ext.Name
        if (Test-Path $target) { Remove-Item $target -Recurse -Force; Write-Ok (L RemovedExt $ext.Name) }
    }
    $plugin = Join-Path $stPath 'plugins\localai-card-sources'
    if (Test-Path $plugin) { Remove-Item $plugin -Recurse -Force; Write-Ok (L RemovedPlugin) }
}

# ---------------------------------------------------------------- запоминаем, куда ставили (для обновления)

function Save-State($stPath) {
    New-Item -ItemType Directory -Force $script:StateDir | Out-Null
    @{ sillyTavernPath = $stPath; version = (Get-AddonVersion); installedAt = (Get-Date -Format s) } |
        ConvertTo-Json | Set-Content -Path $script:StateFile -Encoding UTF8
}

function Load-State {
    if (Test-Path $script:StateFile) {
        try { return (Get-Content $script:StateFile -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { }
    }
    return $null
}
