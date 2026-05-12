[CmdletBinding()]
param(
  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$ApiBase = 'https://cv-request-worker.constantin-cv.workers.dev',

  [Parameter()]
  [ValidateRange(1, 50)]
  [int]$Limit = 10,

  [Parameter()]
  [switch]$ShowEvents
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ConvertFrom-SecureToken {
  param(
    [Parameter(Mandatory = $true)]
    [System.Security.SecureString]$SecureToken
  )

  $tokenPointer = [System.IntPtr]::Zero

  try {
    $tokenPointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
    return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  } finally {
    if ($tokenPointer -ne [System.IntPtr]::Zero) {
      [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
    }
  }
}

function New-AdminRecentRequestsUri {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $true)]
    [int]$RequestLimit
  )

  $normalizedBaseUrl = $BaseUrl.Trim().TrimEnd('/')

  if ([string]::IsNullOrWhiteSpace($normalizedBaseUrl)) {
    throw 'ApiBase is required.'
  }

  $builder = [System.UriBuilder]::new("$normalizedBaseUrl/api/admin/cv-requests/recent")
  $builder.Query = "limit=$RequestLimit"

  return $builder.Uri.AbsoluteUri
}

function Get-HttpStatusCode {
  param(
    [Parameter(Mandatory = $true)]
    [System.Management.Automation.ErrorRecord]$ErrorRecord
  )

  $response = $ErrorRecord.Exception.Response

  if ($null -eq $response -or $null -eq $response.StatusCode) {
    return $null
  }

  try {
    return [int]$response.StatusCode
  } catch {
    return $null
  }
}

function Write-AdminRequestError {
  param(
    [Parameter(Mandatory = $true)]
    [System.Management.Automation.ErrorRecord]$ErrorRecord
  )

  if ($ErrorRecord.Exception.Message -eq 'ADMIN_API_TOKEN is required.') {
    Write-Error 'ADMIN_API_TOKEN is required.' -ErrorAction Continue
    return
  }

  $statusCode = Get-HttpStatusCode -ErrorRecord $ErrorRecord

  switch ($statusCode) {
    401 {
      Write-Error 'Admin API returned 401 Unauthorized. Enter the ADMIN_API_TOKEN when prompted.' -ErrorAction Continue
      break
    }
    403 {
      Write-Error 'Admin API returned 403 Forbidden. Check that the token matches the Worker ADMIN_API_TOKEN secret.' -ErrorAction Continue
      break
    }
    503 {
      Write-Error 'Admin API returned 503 Service Unavailable. Check Worker admin configuration and D1 availability.' -ErrorAction Continue
      break
    }
    $null {
      Write-Error 'Admin API request failed before a response was received. Check ApiBase and network connectivity.' -ErrorAction Continue
      break
    }
    default {
      Write-Error "Admin API request failed with HTTP $statusCode." -ErrorAction Continue
      break
    }
  }
}

function Write-RequestEvents {
  param(
    [Parameter(Mandatory = $true)]
    [object[]]$Requests
  )

  Write-Host ''
  Write-Host 'Events'

  foreach ($request in $Requests) {
    Write-Host $request.requestId

    $eventTypes = @($request.eventTypes)

    if ($eventTypes.Count -eq 0) {
      Write-Host '  - <none>'
      continue
    }

    foreach ($eventType in $eventTypes) {
      Write-Host "  - $eventType"
    }
  }
}

$secureToken = $null
$token = $null
$headers = $null

try {
  $secureToken = Read-Host -Prompt 'ADMIN_API_TOKEN' -AsSecureString

  if ($secureToken.Length -eq 0) {
    throw 'ADMIN_API_TOKEN is required.'
  }

  $token = ConvertFrom-SecureToken -SecureToken $secureToken
  $headers = @{
    Accept = 'application/json'
    Authorization = "Bearer $token"
  }

  $uri = New-AdminRecentRequestsUri -BaseUrl $ApiBase -RequestLimit $Limit
  $response = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -ErrorAction Stop
  $requests = @($response.requests)

  if ($requests.Count -eq 0) {
    Write-Host 'No CV requests returned.'
    return
  }

  $requests |
    Select-Object requestId, status, requestedCvType, requestedLanguage, createdAt, updatedAt |
    Format-Table -AutoSize

  if ($ShowEvents) {
    Write-RequestEvents -Requests $requests
  }
} catch {
  Write-AdminRequestError -ErrorRecord $_
  exit 1
} finally {
  if ($null -ne $headers) {
    $headers['Authorization'] = $null
    $headers.Clear()
  }

  $token = $null

  if ($null -ne $secureToken) {
    $secureToken.Dispose()
  }

  $secureToken = $null
  [System.GC]::Collect()
}
