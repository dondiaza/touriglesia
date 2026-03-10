param(
  [string]$RepoName = "touriglesia",
  [string]$ProjectName = "touriglesia"
)

$ErrorActionPreference = "Stop"

function Invoke-GitHubJson {
  param(
    [string]$Method,
    [string]$Uri
  )

  $headers = @{
    Authorization = "token $env:GITHUB_TOKEN"
    Accept        = "application/vnd.github+json"
    "User-Agent"  = "touriglesia-deployer"
  }

  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
}

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

function Get-VercelProjectOrNull {
  param(
    [string]$ProjectName,
    [string]$TeamId
  )

  try {
    return Invoke-VercelJson -Method Get -Uri ("https://api.vercel.com/v9/projects/{0}?teamId={1}" -f $ProjectName, $TeamId)
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 404) {
      return $null
    }

    throw
  }
}

$githubUser = Invoke-GitHubJson -Method Get -Uri "https://api.github.com/user"
$githubRepo = Invoke-GitHubJson -Method Get -Uri ("https://api.github.com/repos/{0}/{1}" -f $githubUser.login, $RepoName)
$projectsResponse = Invoke-VercelJson -Method Get -Uri "https://api.vercel.com/v9/projects?limit=1"
$teamId = $projectsResponse.projects[0].accountId

$project = Get-VercelProjectOrNull -ProjectName $ProjectName -TeamId $teamId

if ($null -eq $project) {
  $body = @{
    name          = $ProjectName
    framework     = "nextjs"
    gitRepository = @{
      type             = "github"
      repo             = $githubRepo.name
      repoId           = $githubRepo.id
      org              = $githubRepo.owner.login
      productionBranch = $githubRepo.default_branch
    }
  }

  $project = Invoke-VercelJson -Method Post -Uri ("https://api.vercel.com/v10/projects?teamId={0}" -f $teamId) -Body $body
}

Write-Output ("TEAM_ID={0}" -f $teamId)
Write-Output ("PROJECT_ID={0}" -f $project.id)
Write-Output ("PROJECT_NAME={0}" -f $project.name)
Write-Output ("PROJECT_LINKED_REPO={0}/{1}" -f $githubRepo.owner.login, $githubRepo.name)
