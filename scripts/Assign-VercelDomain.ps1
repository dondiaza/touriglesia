param(
  [string]$ProjectName = "touriglesia",
  [string]$DomainName = "touriglesia.panojotro.com"
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
$domain = Invoke-VercelJson -Method Post -Uri ("https://api.vercel.com/v10/projects/{0}/domains?teamId={1}" -f $ProjectName, $teamId) -Body @{
  name = $DomainName
}

Write-Output ("PROJECT_NAME={0}" -f $ProjectName)
Write-Output ("DOMAIN_NAME={0}" -f $domain.name)
Write-Output ("DOMAIN_GIT_BRANCH={0}" -f $domain.gitBranch)
Write-Output ("DOMAIN_REDIRECT={0}" -f $domain.redirect)
