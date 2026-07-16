param(
  [int]$Port = 4173
)

$ErrorActionPreference = "SilentlyContinue"
$connections = Get-NetTCPConnection -LocalPort $Port -State Listen
foreach ($connection in $connections) {
  Stop-Process -Id $connection.OwningProcess -Force
}

netstat -ano |
  Select-String -Pattern "LISTENING\s+(\d+)\s*$" |
  Where-Object { $_.Line -match "[:.]$Port\s" } |
  ForEach-Object {
    Stop-Process -Id ([int]$Matches[1]) -Force
  }
