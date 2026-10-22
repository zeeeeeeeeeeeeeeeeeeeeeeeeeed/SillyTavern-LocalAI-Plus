# local.ai+ — удаление дополнения из SillyTavern. Персонажи, чаты и настройки не трогаются.

param([string]$Path = '', [string]$Lang = '')

. (Join-Path $PSScriptRoot 'lib.ps1')

if ($Lang -and $script:Languages.Contains($Lang)) { Use-InstallerLanguage $Lang } else { Select-InstallerLanguage }

try {
    Write-Step (L StepUninstall)
    $stPath = Select-StPath $Path
    if (-not (AskYesNo (L UninstallAsk $stPath) $false)) { return }

    Remove-Addon $stPath

    $backup = Join-Path $stPath 'config.yaml.before-localai'
    if ((Test-Path $backup) -and (AskYesNo (L RestoreConfigAsk) $false)) {
        Copy-Item $backup (Join-Path $stPath 'config.yaml') -Force
        Write-Ok (L ConfigRestored)
    } else {
        Write-Info (L ConfigKept)
    }

    if (Test-Path $script:StateFile) { Remove-Item $script:StateFile -Force }
    Write-Step (L StepDone)
    Write-Info (L UninstallNext)
} catch {
    Write-Host (L UninstallFailed $_.Exception.Message) -ForegroundColor Red
    exit 1
}
