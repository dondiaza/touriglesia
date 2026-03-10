param(
  [string]$RepoName = "touriglesia",
  [string]$ProjectName = "touriglesia"
)

$ErrorActionPreference = "Stop"

function Invoke-GitHubJson {
  param([string]$Uri)

  $headers = @{
    Authorization = "token $env:GITHUB_TOKEN"
    Accept        = "application/vnd.github+json"
    "User-Agent"  = "touriglesia-deployer"
  }

  return Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers
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

$projectsResponse = Invoke-VercelJson -Method Get -Uri "https://api.vercel.com/v9/projects?limit=1"
$teamId = $projectsResponse.projects[0].accountId
$project = Invoke-VercelJson -Method Get -Uri ("https://api.vercel.com/v9/projects/{0}?teamId={1}" -f $ProjectName, $teamId)
$githubUser = Invoke-GitHubJson -Uri "https://api.github.com/user"
$githubRepo = Invoke-GitHubJson -Uri ("https://api.github.com/repos/{0}/{1}" -f $githubUser.login, $RepoName)
$branch = Invoke-GitHubJson -Uri ("https://api.github.com/repos/{0}/{1}/branches/{2}" -f $githubUser.login, $RepoName, $githubRepo.default_branch)

$body = @{
  name      = $ProjectName
  target    = "production"
  gitSource = @{
    type   = "github"
    repoId = $githubRepo.id
    ref    = $githubRepo.default_branch
    sha    = $branch.commit.sha
  }
}

$deployment = Invoke-VercelJson -Method Post -Uri ("https://api.vercel.com/v13/deployments?teamId={0}" -f $teamId) -Body $body

Write-Output ("DEPLOYMENT_ID={0}" -f $deployment.id)
Write-Output ("DEPLOYMENT_URL=https://{0}" -f $deployment.url)
Write-Output ("DEPLOYMENT_STATE={0}" -f $deployment.readyState)
