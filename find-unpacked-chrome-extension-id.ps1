param(
    [string]$ExtensionPath = ".\src",
    [string]$ChromeUserDataDir = "$env:LOCALAPPDATA\Google\Chrome\User Data"
)

$resolvedExtensionPath = (Resolve-Path $ExtensionPath -ErrorAction Stop).Path

if (-not (Test-Path $ChromeUserDataDir)) {
    Write-Error "Chrome user data directory not found: $ChromeUserDataDir"
    exit 1
}

$profiles = Get-ChildItem $ChromeUserDataDir -Directory | Where-Object {
    $_.Name -eq 'Default' -or $_.Name -match '^Profile \d+$'
}

$matches = @()

foreach ($profile in $profiles) {
    $preferencesPath = Join-Path $profile.FullName 'Preferences'
    if (-not (Test-Path $preferencesPath)) {
        continue
    }

    try {
        $json = Get-Content $preferencesPath -Raw | ConvertFrom-Json -Depth 100
    } catch {
        continue
    }

    $settings = $json.extensions.settings.PSObject.Properties
    foreach ($setting in $settings) {
        $extensionId = $setting.Name
        $extension = $setting.Value
        $unpackedPath = $extension.path
        if (-not $unpackedPath) {
            continue
        }

        $resolvedUnpackedPath = (Resolve-Path $unpackedPath -ErrorAction SilentlyContinue).Path
        if (-not $resolvedUnpackedPath) {
            continue
        }

        if ($resolvedUnpackedPath -eq $resolvedExtensionPath) {
            $matches += [PSCustomObject]@{
                Profile     = $profile.Name
                ExtensionId = $extensionId
                Path        = $resolvedUnpackedPath
                Enabled     = ($extension.state -eq 1)
            }
        }
    }
}

if ($matches.Count -eq 0) {
    Write-Host "No unpacked Chrome extension matched: $resolvedExtensionPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manual fallback:" -ForegroundColor Cyan
    Write-Host "1. Open chrome://extensions"
    Write-Host "2. Enable Developer mode"
    Write-Host "3. Find the MarkSnip card for this unpacked load"
    Write-Host "4. Copy the ID shown on the card"
    exit 2
}

$matches | Format-Table -AutoSize
