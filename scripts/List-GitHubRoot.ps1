param(
  [string]$RepoName = "touriglesia",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$headers = @{
  Authorization = "token $env:GITHUB_TOKEN"
  Accept        = "application/vnd.github+json"
  "User-Agent"  = "touriglesia-list"
}

$user = Invoke-RestMethod -Method Get -Uri "https://api.github.com/user" -Headers $headers
$owner = $user.login
$items = Invoke-RestMethod -Method Get -Uri ("https://api.github.com/repos/{0}/{1}/contents?ref={2}" -f $owner, $RepoName, $Branch) -Headers $headers

foreach ($item in $items) {
  Write-Output ("ROOT_ITEM={0}" -f $item.name)
}
