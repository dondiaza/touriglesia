param(
  [string]$ProjectName = "touriglesia"
)

$ErrorActionPreference = "Stop"

function Invoke-VercelJson {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null
  )

  $headers = @{
    Authorization = "Bearer $env:VERCEL_TOKEN"
  }

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
  }

  $json = $Body | ConvertTo-Json -Depth 20 -Compress
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ContentType "application/json" -Body $json
}

$projectsResponse = Invoke-VercelJson -Method Get -Uri "https://api.vercel.com/v9/projects?limit=1"
$teamId = $projectsResponse.projects[0].accountId
$project = Invoke-VercelJson -Method Get -Uri ("https://api.vercel.com/v9/projects/{0}?teamId={1}" -f $ProjectName, $teamId)

if (-not $project.link -or -not $project.link.repoId -or -not $project.link.productionBranch) {
  throw "El proyecto no tiene vinculacion GitHub completa (repoId/productionBranch)."
}

$body = @{
  name      = $ProjectName
  target    = "production"
  gitSource = @{
    type   = "github"
    repoId = $project.link.repoId
    ref    = $project.link.productionBranch
  }
}

$deployment = Invoke-VercelJson -Method Post -Uri ("https://api.vercel.com/v13/deployments?teamId={0}" -f $teamId) -Body $body

Write-Output ("TEAM_ID={0}" -f $teamId)
Write-Output ("PROJECT_ID={0}" -f $project.id)
Write-Output ("DEPLOYMENT_ID={0}" -f $deployment.id)
Write-Output ("DEPLOYMENT_URL=https://{0}" -f $deployment.url)
Write-Output ("DEPLOYMENT_STATE={0}" -f $deployment.readyState)
