param(
  [string]$ProjectName = "touriglesia",
  [int]$MaxAttempts = 30,
  [int]$DelaySeconds = 10
)

$ErrorActionPreference = "Stop"

function Invoke-VercelJson {
  param([string]$Uri)

  $headers = @{
    Authorization = "Bearer $env:VERCEL_TOKEN"
  }

  return Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers
}

$projectsResponse = Invoke-VercelJson -Uri "https://api.vercel.com/v9/projects?limit=1"
$teamId = $projectsResponse.projects[0].accountId

for ($attempt = 1; $attempt -le $MaxAttempts; $attempt += 1) {
  $project = Invoke-VercelJson -Uri ("https://api.vercel.com/v9/projects/{0}?teamId={1}" -f $ProjectName, $teamId)
  $latest = $project.latestDeployments | Select-Object -First 1

  if ($null -eq $latest) {
    Write-Output ("ATTEMPT={0} STATE=NONE" -f $attempt)
  } else {
    Write-Output ("ATTEMPT={0} STATE={1} URL=https://{2}" -f $attempt, $latest.readyState, $latest.url)

    if ($latest.readyState -in @("READY", "ERROR", "CANCELED")) {
      exit 0
    }
  }

  Start-Sleep -Seconds $DelaySeconds
}

throw "Deployment did not finish within the expected time."
