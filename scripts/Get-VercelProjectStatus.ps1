param(
  [string]$ProjectName = "touriglesia"
)

$ErrorActionPreference = "Stop"

function Invoke-VercelJson {
  param(
    [string]$Uri
  )

  $headers = @{
    Authorization = "Bearer $env:VERCEL_TOKEN"
  }

  return Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers
}

$projectsResponse = Invoke-VercelJson -Uri "https://api.vercel.com/v9/projects?limit=1"
$teamId = $projectsResponse.projects[0].accountId
$project = Invoke-VercelJson -Uri ("https://api.vercel.com/v9/projects/{0}?teamId={1}" -f $ProjectName, $teamId)

Write-Output ("TEAM_ID={0}" -f $teamId)
Write-Output ("PROJECT_ID={0}" -f $project.id)
Write-Output ("PROJECT_NAME={0}" -f $project.name)

if ($project.link) {
  Write-Output ("LINK_TYPE={0}" -f $project.link.type)
  Write-Output ("LINK_REPO={0}/{1}" -f $project.link.org, $project.link.repo)
}

$latest = $project.latestDeployments | Select-Object -First 1

if ($null -eq $latest) {
  Write-Output "DEPLOYMENT_STATUS=NONE"
} else {
  Write-Output ("DEPLOYMENT_ID={0}" -f $latest.id)
  Write-Output ("DEPLOYMENT_STATE={0}" -f $latest.readyState)
  Write-Output ("DEPLOYMENT_URL=https://{0}" -f $latest.url)
  Write-Output ("DEPLOYMENT_TARGET={0}" -f $latest.target)
}
