param(
  [string]$Message = "Update WikiMarketing",
  [string]$CoolifyToken = $env:COOLIFY_TOKEN,
  [string]$CoolifyApiUrl = $(if ($env:COOLIFY_API_URL) { $env:COOLIFY_API_URL } else { "https://sistemas.faesde.com.br/api/v1" }),
  [string]$CoolifyAppUuid = $(if ($env:COOLIFY_APP_UUID) { $env:COOLIFY_APP_UUID } else { "rf5qjrkb1mfg4jp59twsqbyk" }),
  [switch]$NoDeploy
)

$ErrorActionPreference = "Stop"

function Test-GitRepo {
  param([string]$Path)

  try {
    $result = git -C $Path rev-parse --is-inside-work-tree 2>$null
    return $LASTEXITCODE -eq 0 -and $result -eq "true"
  } catch {
    return $false
  }
}

function Get-PublishRepo {
  param([string]$Root)

  if (Test-GitRepo $Root) {
    return $Root
  }

  $versionsRoot = Join-Path $Root "_versions"
  if (-not (Test-Path -LiteralPath $versionsRoot)) {
    throw "This folder is not a git repository and _versions was not found."
  }

  $repo = Get-ChildItem -LiteralPath $versionsRoot -Directory |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "03-publish-clean" } |
    Where-Object { Test-GitRepo $_ } |
    Select-Object -First 1

  if (-not $repo) {
    throw "Could not find a git repository under _versions/*/03-publish-clean."
  }

  return $repo
}

function Sync-RootToPublishRepo {
  param(
    [string]$Root,
    [string]$Repo
  )

  if ($Root -eq $Repo) {
    return
  }

  $resolvedRoot = (Resolve-Path $Root).Path
  $resolvedRepo = (Resolve-Path $Repo).Path
  $resolvedVersions = (Resolve-Path (Join-Path $Root "_versions")).Path

  if (-not $resolvedRepo.StartsWith($resolvedVersions, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to sync because the publish repo is outside _versions: $resolvedRepo"
  }

  Write-Host "Syncing workspace into publish repository..."
  Get-ChildItem -LiteralPath $resolvedRepo -Force |
    Where-Object { $_.Name -ne ".git" } |
    Remove-Item -Recurse -Force

  $excludedDirs = @(".git", ".codex", ".agents", "_versions", "node_modules", "dist", "dist-ssr")
  $excludedFiles = @(".env", ".env.local", ".env.development", ".env.production", ".env.test")
  $robocopyArgs = @($resolvedRoot, $resolvedRepo, "/E", "/XD") + $excludedDirs + @("/XF") + $excludedFiles
  robocopy @robocopyArgs | Out-Null

  if ($LASTEXITCODE -gt 7) {
    throw "Robocopy failed with exit code $LASTEXITCODE."
  }
}

function Invoke-CoolifyDeploy {
  param(
    [string]$ApiUrl,
    [string]$AppUuid,
    [string]$Token
  )

  if (-not $Token) {
    throw "COOLIFY_TOKEN is missing. Set it or pass -CoolifyToken."
  }

  $deployUrl = "$($ApiUrl.TrimEnd('/'))/deploy?uuid=$AppUuid&force=true"
  $headers = @{
    Authorization = "Bearer $Token"
    Accept = "application/json"
  }

  Write-Host "Triggering Coolify deploy for $AppUuid..."
  $response = Invoke-RestMethod -Method Get -Uri $deployUrl -Headers $headers -TimeoutSec 60
  $deployment = $response.deployments | Select-Object -First 1

  if ($deployment) {
    Write-Host "Coolify deployment queued: $($deployment.deployment_uuid)"
  } else {
    Write-Host "Coolify deploy response received."
  }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repo = Get-PublishRepo $root

Sync-RootToPublishRepo -Root $root -Repo $repo

Write-Host "Using git repository: $repo"
git -C $repo add -A

$hasChanges = $true
git -C $repo diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  $hasChanges = $false
}

if ($hasChanges) {
  git -C $repo commit -m $Message
} else {
  Write-Host "No git changes to commit."
}

$branch = git -C $repo branch --show-current
git -C $repo push origin $branch

if (-not $NoDeploy) {
  Invoke-CoolifyDeploy -ApiUrl $CoolifyApiUrl -AppUuid $CoolifyAppUuid -Token $CoolifyToken
}
