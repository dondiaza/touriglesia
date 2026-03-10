$ErrorActionPreference = "Stop"

function Get-Json {
  param(
    [string]$Uri,
    [hashtable]$Headers
  )

  return Invoke-RestMethod -Method Get -Uri $Uri -Headers $Headers
}

$githubToken = $env:GITHUB_TOKEN
$vercelToken = $env:VERCEL_TOKEN

if ([string]::IsNullOrWhiteSpace($githubToken)) {
  throw "Missing GITHUB_TOKEN environment variable."
}

if ([string]::IsNullOrWhiteSpace($vercelToken)) {
  throw "Missing VERCEL_TOKEN environment variable."
}

$githubHeaders = @{
  Authorization = "token $githubToken"
  Accept        = "application/vnd.github+json"
  "User-Agent"  = "touriglesia-deployer"
}

$vercelHeaders = @{
  Authorization = "Bearer $vercelToken"
}

$githubUser = Get-Json -Uri "https://api.github.com/user" -Headers $githubHeaders
$vercelUser = Get-Json -Uri "https://api.vercel.com/v2/user" -Headers $vercelHeaders

Write-Output ("GITHUB_LOGIN={0}" -f $githubUser.login)
Write-Output ("VERCEL_USER={0}" -f $vercelUser.user.username)
