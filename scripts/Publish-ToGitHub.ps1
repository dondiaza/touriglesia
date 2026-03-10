param(
  [string]$RepoName = "touriglesia",
  [switch]$Private
)

$ErrorActionPreference = "Stop"

function Invoke-GitHubJson {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null
  )

  $headers = @{
    Authorization = "token $env:GITHUB_TOKEN"
    Accept        = "application/vnd.github+json"
    "User-Agent"  = "touriglesia-deployer"
  }

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
  }

  $json = $Body | ConvertTo-Json -Depth 20 -Compress
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ContentType "application/json" -Body $json
}

function Get-RepoOrNull {
  param([string]$Uri)

  try {
    return Invoke-GitHubJson -Method Get -Uri $Uri
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 404) {
      return $null
    }

    throw
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$user = Invoke-GitHubJson -Method Get -Uri "https://api.github.com/user"
$owner = $user.login
$repoUri = "https://api.github.com/repos/$owner/$RepoName"
$repo = Get-RepoOrNull -Uri $repoUri

if ($null -eq $repo) {
  $repo = Invoke-GitHubJson -Method Post -Uri "https://api.github.com/user/repos" -Body @{
    name        = $RepoName
    description = "MVP web para planificar recorridos andando entre iglesias y otros puntos."
    private     = [bool]$Private
    auto_init   = $true
  }
}

$branch = $repo.default_branch
$fileItems = Get-ChildItem -Path $repoRoot -Recurse -File | Where-Object {
  $fullName = $_.FullName

  -not $fullName.Contains("\.next\") -and
  -not $fullName.Contains("\node_modules\") -and
  -not $fullName.Contains("\.vercel\") -and
  -not $fullName.Contains("\dist\") -and
  -not $fullName.Contains("\coverage\")
}

foreach ($fileItem in $fileItems) {
  $relativePath = $fileItem.FullName.Substring($repoRoot.Length).TrimStart("\").Replace("\", "/")
  $encodedPath = $relativePath.Split("/") | ForEach-Object { [uri]::EscapeDataString($_) }
  $contentsUri = "https://api.github.com/repos/$owner/$RepoName/contents/" + ($encodedPath -join "/")
  $contentBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($fileItem.FullName))
  $existing = Get-RepoOrNull -Uri ($contentsUri + "?ref=" + $branch)

  $body = @{
    message = if ($null -eq $existing) { "chore: add $relativePath" } else { "chore: update $relativePath" }
    content = $contentBase64
    branch  = $branch
  }

  if ($null -ne $existing -and $existing.sha) {
    $body.sha = $existing.sha
  }

  Invoke-GitHubJson -Method Put -Uri $contentsUri -Body $body | Out-Null
  Write-Output ("UPLOADED={0}" -f $relativePath)
}

$branchInfo = Invoke-GitHubJson -Method Get -Uri "https://api.github.com/repos/$owner/$RepoName/branches/$branch"

Write-Output ("OWNER={0}" -f $owner)
Write-Output ("REPO_URL={0}" -f $repo.html_url)
Write-Output ("DEFAULT_BRANCH={0}" -f $branch)
Write-Output ("HEAD_SHA={0}" -f $branchInfo.commit.sha)
