[CmdletBinding()]
param(
  [string]$SourceRoot = "generated/pdf",
  [string]$AssetsRoot = "generated/private-cv-assets",
  [string]$ManifestOutputPath = "generated/private-cv-assets/manifest.json"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).ProviderPath
$privateOverlayPath = Join-Path $repoRoot "data/private/cv.private.yml"
$privateGenerationCommandOrder = @(
  "npm run cv:generate-print",
  "npm run pdf:generate",
  ".\scripts\admin\prepare-private-cv-assets.ps1"
)

$assetJobs = @(
  @{
    CvType = "one-page"
    Language = "fr"
    Source = "fr/CV_Constantin_Petrov_One_Page_FR.pdf"
    Asset = "fr/one-page.pdf"
    DownloadFilename = "constantin-petrov-cv-one-page-fr.pdf"
  },
  @{
    CvType = "full-dev"
    Language = "fr"
    Source = "fr/CV_Constantin_Petrov_Full_Dev_FR.pdf"
    Asset = "fr/full-dev.pdf"
    DownloadFilename = "constantin-petrov-cv-full-dev-fr.pdf"
  }
)

function Resolve-RepoPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return Join-Path $repoRoot $Path
}

function ConvertTo-RepoRelativePath {
  param([Parameter(Mandatory = $true)][string]$Path)

  $absolutePath = [System.IO.Path]::GetFullPath($Path)
  $absoluteRoot = [System.IO.Path]::GetFullPath($repoRoot)
  $absoluteRoot = Add-TrailingDirectorySeparator $absoluteRoot

  # Windows PowerShell 5.1 runs on .NET Framework, where Path.GetRelativePath is
  # unavailable. Uri.MakeRelativeUri keeps this script compatible with both
  # Windows PowerShell 5.1 and newer PowerShell versions.
  $rootUri = New-Object System.Uri($absoluteRoot)
  $pathUri = New-Object System.Uri($absolutePath)
  $relativePath = [System.Uri]::UnescapeDataString($rootUri.MakeRelativeUri($pathUri).ToString())

  return $relativePath -replace "\\", "/"
}

function Add-TrailingDirectorySeparator {
  param([Parameter(Mandatory = $true)][string]$Path)

  $absolutePath = [System.IO.Path]::GetFullPath($Path)
  $directorySeparator = [System.IO.Path]::DirectorySeparatorChar
  $alternateDirectorySeparator = [System.IO.Path]::AltDirectorySeparatorChar

  if (
    -not $absolutePath.EndsWith([string]$directorySeparator) -and
    -not $absolutePath.EndsWith([string]$alternateDirectorySeparator)
  ) {
    return "$absolutePath$directorySeparator"
  }

  return $absolutePath
}

function Test-IsSameOrChildPath {
  param(
    [Parameter(Mandatory = $true)][string]$ParentPath,
    [Parameter(Mandatory = $true)][string]$ChildPath
  )

  $parentFullPath = [System.IO.Path]::GetFullPath($ParentPath)
  $childFullPath = [System.IO.Path]::GetFullPath($ChildPath)
  $trimCharacters = [char[]]@(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  $parentTrimmed = $parentFullPath.TrimEnd($trimCharacters)
  $childTrimmed = $childFullPath.TrimEnd($trimCharacters)

  if ([string]::Equals($parentTrimmed, $childTrimmed, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }

  $parentWithSeparator = Add-TrailingDirectorySeparator $parentFullPath
  return $childFullPath.StartsWith($parentWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-IsSameOrChildPath {
  param(
    [Parameter(Mandatory = $true)][string]$ParentPath,
    [Parameter(Mandatory = $true)][string]$ChildPath,
    [Parameter(Mandatory = $true)][string]$Description
  )

  if (-not (Test-IsSameOrChildPath -ParentPath $ParentPath -ChildPath $ChildPath)) {
    throw "$Description must stay inside $(ConvertTo-RepoRelativePath $ParentPath)."
  }
}

$sourceRootPath = Resolve-RepoPath $SourceRoot
$assetsRootPath = Resolve-RepoPath $AssetsRoot
$manifestPath = Resolve-RepoPath $ManifestOutputPath
$expectedAssetsRootPath = Resolve-RepoPath "generated/private-cv-assets"

Assert-IsSameOrChildPath `
  -ParentPath $expectedAssetsRootPath `
  -ChildPath $assetsRootPath `
  -Description "AssetsRoot"
Assert-IsSameOrChildPath `
  -ParentPath $assetsRootPath `
  -ChildPath $manifestPath `
  -Description "ManifestOutputPath"

$missingSources = @()

foreach ($job in $assetJobs) {
  $sourcePath = Join-Path $sourceRootPath $job.Source

  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    $missingSources += ConvertTo-RepoRelativePath $sourcePath
  }
}

if ($missingSources.Count -gt 0) {
  $messageLines = @(
    "Missing private CV PDF files.",
    "Run the private CV generation flow in order:"
  )
  $messageLines += $privateGenerationCommandOrder | ForEach-Object { "- $_" }
  $messageLines += "Missing:"
  $messageLines += $missingSources | ForEach-Object { "- $_" }

  if (-not (Test-Path -LiteralPath $privateOverlayPath -PathType Leaf)) {
    $messageLines = @(
      "Missing private CV overlay: data/private/cv.private.yml",
      "Create it by copying data/private/cv.private.example.yml to data/private/cv.private.yml.",
      "Then replace the placeholder values with private contact details before generating PDFs."
    ) + $messageLines
  }

  Write-Error ($messageLines -join [Environment]::NewLine)
}

New-Item -ItemType Directory -Path $assetsRootPath -Force | Out-Null

$manifest = [ordered]@{}

foreach ($job in $assetJobs) {
  $sourcePath = Join-Path $sourceRootPath $job.Source
  $assetPath = Join-Path $assetsRootPath $job.Asset
  $assetDirectory = Split-Path -Parent $assetPath

  Assert-IsSameOrChildPath `
    -ParentPath $assetsRootPath `
    -ChildPath $assetPath `
    -Description "Private CV asset output"

  New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null
  Copy-Item -LiteralPath $sourcePath -Destination $assetPath -Force

  if (-not $manifest.Contains($job.CvType)) {
    $manifest[$job.CvType] = [ordered]@{}
  }

  $manifest[$job.CvType][$job.Language] = [ordered]@{
    assetPath = "/$($job.Asset -replace "\\", "/")"
    downloadFilename = $job.DownloadFilename
  }
}

$assetsIgnorePath = Join-Path $assetsRootPath ".assetsignore"
Assert-IsSameOrChildPath `
  -ParentPath $assetsRootPath `
  -ChildPath $assetsIgnorePath `
  -Description ".assetsignore output"

@"
*
!fr/
!fr/*.pdf
"@ | Set-Content -LiteralPath $assetsIgnorePath -Encoding utf8

$manifestDirectory = Split-Path -Parent $manifestPath
New-Item -ItemType Directory -Path $manifestDirectory -Force | Out-Null
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Host "Prepared private CV Worker assets."
Write-Host "Asset count: $($assetJobs.Count)"
Write-Host "Assets root: $(ConvertTo-RepoRelativePath $assetsRootPath)"
Write-Host "Manifest file: $(ConvertTo-RepoRelativePath $manifestPath)"
Write-Host "Generated files are ignored by Git. Do not commit private PDFs."
