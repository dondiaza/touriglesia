param(
  [string]$ProjectName = "touriglesia"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:VERCEL_TOKEN)) {
  throw "Missing VERCEL_TOKEN environment variable."
}

$headers = @{
  Authorization = "Bearer $env:VERCEL_TOKEN"
}

$projects = Invoke-RestMethod -Method Get -Uri "https://api.vercel.com/v9/projects?limit=1" -Headers $headers
$teamId = $projects.projects[0].accountId
$project = Invoke-RestMethod -Method Get -Uri ("https://api.vercel.com/v9/projects/{0}?teamId={1}" -f $ProjectName, $teamId) -Headers $headers
$envResponse = Invoke-RestMethod -Method Get -Uri ("https://api.vercel.com/v10/projects/{0}/env?teamId={1}" -f $project.id, $teamId) -Headers $headers

Write-Output ("TEAM_ID={0}" -f $teamId)
Write-Output ("PROJECT_ID={0}" -f $project.id)

foreach ($item in $envResponse.envs) {
  $targets = ($item.target -join ",")
  Write-Output ("ENV_KEY={0} TARGET={1} ID={2}" -f $item.key, $targets, $item.id)
}
