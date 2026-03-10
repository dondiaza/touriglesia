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
$deployment = Invoke-RestMethod -Method Get -Uri ("https://api.vercel.com/v13/deployments/{0}?teamId={1}" -f $DeploymentId, $teamId) -Headers $headers

Write-Output ("DEPLOYMENT_ID={0}" -f $deployment.id)
Write-Output ("READY_STATE={0}" -f $deployment.readyState)
Write-Output ("READY_SUBSTATE={0}" -f $deployment.readySubstate)
Write-Output ("URL=https://{0}" -f $deployment.url)

if ($deployment.errorMessage) {
  Write-Output ("ERROR_MESSAGE={0}" -f $deployment.errorMessage)
}

if ($deployment.errorCode) {
  Write-Output ("ERROR_CODE={0}" -f $deployment.errorCode)
}
