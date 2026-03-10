$ErrorActionPreference = "Stop"

$curl = "C:\Windows\System32\curl.exe"
$token = $env:VERCEL_TOKEN

if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Missing VERCEL_TOKEN environment variable."
}

$projects = & $curl -s "https://api.vercel.com/v9/projects?limit=100" -H ("Authorization: Bearer " + $token)
$projectsExit = $LASTEXITCODE
$domain = & $curl -s "https://api.vercel.com/v9/projects/touriglesia/domains/touriglesia.panojotro.com" -H ("Authorization: Bearer " + $token)
$domainExit = $LASTEXITCODE

Write-Output ("PROJECTS_EXIT={0}" -f $projectsExit)
Write-Output $projects
Write-Output ("DOMAIN_EXIT={0}" -f $domainExit)
Write-Output $domain
