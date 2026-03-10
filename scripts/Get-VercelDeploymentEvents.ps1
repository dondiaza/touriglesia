param(
  [string]$DeploymentId
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DeploymentId)) {
  throw "DeploymentId is required."
}

$headers = @{
  Authorization = "Bearer $env:VERCEL_TOKEN"
}

$projects = Invoke-RestMethod -Method Get -Uri "https://api.vercel.com/v9/projects?limit=1" -Headers $headers
$teamId = $projects.projects[0].accountId
$events = Invoke-RestMethod -Method Get -Uri ("https://api.vercel.com/v2/deployments/{0}/events?teamId={1}" -f $DeploymentId, $teamId) -Headers $headers

$events | ConvertTo-Json -Depth 10
