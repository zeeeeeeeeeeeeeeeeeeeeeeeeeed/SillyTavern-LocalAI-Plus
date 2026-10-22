# local.ai+ — установка/обновление дополнения в существующий SillyTavern.
# Запуск: двойной клик по install.bat
# Или: powershell -ExecutionPolicy Bypass -File installer\install.ps1 [-Path <папка SillyTavern>] [-Yes] [-Lang ru|en]
#   -Yes  — без вопросов: путь из -Path или из прошлой установки, мультиязычная память включена

param(
    [string]$Path = '',
    [switch]$Yes,
    [string]$Lang = ''
)

. (Join-Path $PSScriptRoot 'lib.ps1')

if ($Lang -and $script:Languages.Contains($Lang)) { Use-InstallerLanguage $Lang }
elseif ($Yes) { Use-InstallerLanguage 'en' }
else { Select-InstallerLanguage }

$version = Get-AddonVersion
Write-Host ''
Write-Host "  (local.ai+)  v$version" -ForegroundColor White
Write-Host "  $(L Tagline)" -ForegroundColor Gray

try {
    Write-Step (L StepFolder)
    if ($Yes -and -not $Path) {
        $state = Load-State
        if ($state) { $Path = $state.sillyTavernPath }
    }
    $stPath = Select-StPath $Path
    Write-Ok $stPath

    $stVersion = Get-StVersion $stPath
    if ($stVersion) {
        if ($stVersion -lt $script:MinStVersion) {
            Write-Warn2 (L StVersionOld $stVersion $script:MinStVersion)
            if (-not $Yes -and -not (AskYesNo (L ContinueAnyway) $false)) { return }
        } else {
            Write-Ok "SillyTavern $stVersion"
        }
    }

    Write-Step (L StepMemory)
    Write-Info (L MemoryExplain1)
    Write-Info (L MemoryExplain2)
    $multilingual = $true
    if (-not $Yes) { $multilingual = AskYesNo (L MemoryAsk) }

    Write-Step (L StepInstall)
    Install-Addon $stPath $multilingual
    Save-State $stPath

    Write-Step (L StepDone)
    if (Test-StRunning) { Write-Warn2 (L StRunning) }
    Write-Info (L Next1)
    Write-Info (L Next2)
    Write-Info (L Next3)
    Write-Info ''
    Write-Info (L NextUpdate)
    Write-Info (L NextRemove)
} catch {
    Write-Host ''
    Write-Host (L InstallFailed) -ForegroundColor Red
    Write-Host (L Details $_.Exception.Message) -ForegroundColor DarkGray
    exit 1
}
