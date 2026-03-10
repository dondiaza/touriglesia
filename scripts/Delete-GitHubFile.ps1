param(
  [string]$Path,
  [string]$NameStartsWith,
  [string]$RepoName = "touriglesia",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:GITHUB_TOKEN)) {
  throw "Missing GITHUB_TOKEN environment variable."
}

$headers = @{
  Authorization = "token $env:GITHUB_TOKEN"
  Accept        = "application/vnd.github+json"
  "User-Agent"  = "touriglesia-deleter"
}

$user = Invoke-RestMethod -Method Get -Uri "https://api.github.com/user" -Headers $headers
$owner = $user.login
$rootItems = Invoke-RestMethod -Method Get -Uri ("https://api.github.com/repos/{0}/{1}/contents?ref={2}" -f $owner, $RepoName, $Branch) -Headers $headers
$existing =
if ($hasPath) {
  $rootItems | Where-Object { $_.name -eq $Path -or $_.path -eq $Path } | Select-Object -First 1
} else {
  $rootItems | Where-Object { $_.name.StartsWith($NameStartsWith) } | Select-Object -First 1
}

if ($null -eq $existing) {
  if ($hasPath) {
    throw "No se encontro el archivo '$Path' en la raiz del repositorio."
  }

  throw "No se encontro archivo con prefijo '$NameStartsWith' en la raiz del repositorio."
}

$body = @{
  message = "chore: delete $Path"
  sha     = $existing.sha
  branch  = $Branch
} | ConvertTo-Json -Depth 5 -Compress

Invoke-RestMethod -Method Delete -Uri $existing.url -Headers $headers -ContentType "application/json" -Body $body | Out-Null

Write-Output ("DELETED={0}" -f $existing.path)
Write-Output ("REPO=https://github.com/{0}/{1}" -f $owner, $RepoName)
$hasPath = -not [string]::IsNullOrWhiteSpace($Path)
$hasPrefix = -not [string]::IsNullOrWhiteSpace($NameStartsWith)

if (-not $hasPath -and -not $hasPrefix) {
  throw "Debes indicar -Path o -NameStartsWith."
}
