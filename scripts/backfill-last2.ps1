Set-Location 'C:\Users\jihon\projects\earnings-monitor'
$secret = ((Get-Content .env.local | Select-String '^CRON_SECRET=').Line -split '=', 2)[1]
$slugs = @('mufg','alibaba')
foreach ($slug in $slugs) {
  $t0 = Get-Date
  Write-Output "===== $slug ====="
  try {
    $resp = Invoke-RestMethod -Uri "http://localhost:3000/api/cron/refresh?only=$slug" -Headers @{ Authorization = "Bearer $secret" } -TimeoutSec 900
    $elapsed = [int]((Get-Date) - $t0).TotalSeconds
    $r = $resp.results[0]
    Write-Output "  $($r.status) in $($elapsed)s: $($r.fiscalPeriod) $($r.reason) $($r.errorMessage)"
  } catch {
    $elapsed = [int]((Get-Date) - $t0).TotalSeconds
    Write-Output "  EXCEPTION in $($elapsed)s: $($_.Exception.Message)"
  }
}
