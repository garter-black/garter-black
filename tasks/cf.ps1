param([string]$Method = 'GET', [Parameter(Mandatory=$true)][string]$Path, [string]$Body = '', [string]$Token = 'CLOUDFLARE_API_TOKEN')
# Cloudflare API helper. Reads the token from C:\Hecate-Umbra\.env without printing it.
$ErrorActionPreference = 'Stop'
function Get-EnvVal($name) { $l = Select-String -Path 'C:\Hecate-Umbra\.env' -Pattern ("^\s*" + [regex]::Escape($name) + "\s*=") | Select-Object -First 1; if ($l) { $l.Line.Split('=',2)[1].Trim().Trim('"').Trim("'") } }
$tok = Get-EnvVal $Token
$acct = Get-EnvVal 'CLOUDFLARE_ACCOUNT_ID'; if (-not $acct) { $acct = '86cf181f919e67fc61e33a0d578903b0' }
$url = 'https://api.cloudflare.com/client/v4/' + $Path.Replace('{acct}', $acct)
$h = @{ Authorization = "Bearer $tok" }
try {
  if ($Body) { $r = Invoke-RestMethod -Method $Method -Uri $url -Headers $h -ContentType 'application/json' -Body $Body }
  else { $r = Invoke-RestMethod -Method $Method -Uri $url -Headers $h }
  $r | ConvertTo-Json -Depth 8
} catch { "ERROR " + $_.Exception.Message; if ($_.ErrorDetails) { $_.ErrorDetails.Message } }
