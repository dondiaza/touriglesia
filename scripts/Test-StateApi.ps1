param(
  [string]$BaseUrl = "https://touriglesia.panojotro.com"
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null
  )

  try {
    if ($null -eq $Body) {
      $response = Invoke-WebRequest -Uri $Uri -Method $Method -UseBasicParsing -Headers @{
        "Content-Type" = "application/json"
      }
    } else {
      $json = $Body | ConvertTo-Json -Depth 20 -Compress
      $response = Invoke-WebRequest -Uri $Uri -Method $Method -UseBasicParsing -Headers @{
        "Content-Type" = "application/json"
      } -Body $json
    }

    return @{
      status  = $response.StatusCode
      content = $response.Content
    }
  } catch {
    if ($_.Exception.Response) {
      $statusCode = [int]$_.Exception.Response.StatusCode
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $content = $reader.ReadToEnd()
      $reader.Close()
      return @{
        status  = $statusCode
        content = $content
      }
    }

    throw
  }
}

$getResult = Invoke-Json -Method Get -Uri ($BaseUrl + "/api/state")
Write-Output ("GET_STATUS={0}" -f $getResult.status)
Write-Output ("GET_BODY={0}" -f $getResult.content)

$sampleState = @{
  key  = "iglesia"
  data = @{
    points = @()
    orderedStops = @()
    routeSummary = $null
    routeHistory = @()
    travelMode = "walking"
    userLocation = $null
    communityPlaces = @()
    activeStopIndex = 0
    nextPointOrder = 1
  }
}

$postResult = Invoke-Json -Method Post -Uri ($BaseUrl + "/api/state") -Body $sampleState
Write-Output ("POST_STATUS={0}" -f $postResult.status)
Write-Output ("POST_BODY={0}" -f $postResult.content)
