Set-Location 'C:\Users\jihon\projects\earnings-monitor'
$secret = ((Get-Content .env.local | Select-String '^CRON_SECRET=').Line -split '=', 2)[1]
Write-Output 'Backfill starting...'
$t0 = Get-Date
$output = ''
try {
  $resp = Invoke-RestMethod -Uri 'http://localhost:3000/api/cron/refresh' -Headers @{ Authorization = "Bearer $secret" } -TimeoutSec 2100
  $elapsed = [int]((Get-Date) - $t0).TotalSeconds
  $output = "Done in $($elapsed)s`n" + ($resp | ConvertTo-Json -Depth 6)
} catch {
  $output = "Error after $([int]((Get-Date) - $t0).TotalSeconds)s: $($_.Exception.Message)"
  if ($_.ErrorDetails) { $output += "`n" + $_.ErrorDetails.Message }
}
Set-Content -Path backfill-result.json -Value $output -Encoding utf8
Write-Output 'finished — result saved to backfill-result.json'
