[CmdletBinding()]
param(
    [int]$Port = 4173
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$contentTypes = @{
    ".css"  = "text/css; charset=utf-8"
    ".html" = "text/html; charset=utf-8"
    ".ico"  = "image/x-icon"
    ".jpeg" = "image/jpeg"
    ".jpg"  = "image/jpeg"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".md"   = "text/markdown; charset=utf-8"
    ".png"  = "image/png"
    ".sql"  = "text/plain; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".toml" = "text/plain; charset=utf-8"
    ".txt"  = "text/plain; charset=utf-8"
    ".xlsx" = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
}

$dataDir = Join-Path $projectRoot "data"
$dbPath = Join-Path $dataDir "interviewplus-db.json"

function Initialize-Database {
    if (-not (Test-Path -LiteralPath $dataDir -PathType Container)) {
        New-Item -ItemType Directory -Path $dataDir | Out-Null
    }

    if (-not (Test-Path -LiteralPath $dbPath -PathType Leaf)) {
        @{
            users = @()
            sessions = @()
            tokens = @{}
        } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $dbPath -Encoding UTF8
    }
}

function Read-Database {
    Initialize-Database
    $raw = Get-Content -LiteralPath $dbPath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return @{
            users = @()
            sessions = @()
            tokens = @{}
        }
    }
    return $raw | ConvertFrom-Json
}

function Save-Database {
    param([Parameter(Mandatory = $true)]$Database)
    $Database | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $dbPath -Encoding UTF8
}

function Get-Array {
    param($Value)
    if ($null -eq $Value) { return @() }
    if ($Value -is [System.Array]) { return @($Value) }
    return @($Value)
}

function Get-PasswordHash {
    param(
        [Parameter(Mandatory = $true)][string]$Password,
        [Parameter(Mandatory = $true)][string]$Salt
    )
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("$Salt`:$Password")
        return [Convert]::ToBase64String($sha.ComputeHash($bytes))
    }
    finally {
        $sha.Dispose()
    }
}

function New-PublicUser {
    param([Parameter(Mandatory = $true)]$User)
    return @{
        id = $User.id
        name = $User.name
        email = $User.email
        createdAt = $User.createdAt
    }
}

function Write-JsonResponse {
    param(
        [Parameter(Mandatory = $true)][System.Net.Sockets.NetworkStream]$Stream,
        [Parameter(Mandatory = $true)][int]$StatusCode,
        [Parameter(Mandatory = $true)][string]$StatusText,
        [Parameter(Mandatory = $true)]$Body
    )
    $json = $Body | ConvertTo-Json -Depth 80
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    Write-HttpResponse -Stream $Stream -StatusCode $StatusCode -StatusText $StatusText -BodyBytes $bodyBytes -ContentType "application/json; charset=utf-8"
}

function Get-AuthUser {
    param(
        [Parameter(Mandatory = $true)]$Headers,
        [Parameter(Mandatory = $true)]$Database
    )
    if (-not $Headers.ContainsKey("authorization")) {
        return $null
    }
    $authorization = [string]$Headers["authorization"]
    if (-not $authorization.StartsWith("Bearer ", [System.StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }
    $token = $authorization.Substring(7).Trim()
    if (-not $Database.tokens.PSObject.Properties.Name.Contains($token)) {
        return $null
    }
    $userId = [string]$Database.tokens.$token
    return (Get-Array $Database.users | Where-Object { $_.id -eq $userId } | Select-Object -First 1)
}

function Invoke-ApiRoute {
    param(
        [Parameter(Mandatory = $true)][System.Net.Sockets.NetworkStream]$Stream,
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Headers,
        [string]$BodyText = ""
    )

    $db = Read-Database
    $body = $null
    if (-not [string]::IsNullOrWhiteSpace($BodyText)) {
        try { $body = $BodyText | ConvertFrom-Json } catch { $body = $null }
    }

    if ($Method -eq "POST" -and $Path -eq "/api/auth/signup") {
        $name = [string]$body.name
        $email = ([string]$body.email).Trim().ToLowerInvariant()
        $password = [string]$body.password
        if ([string]::IsNullOrWhiteSpace($name) -or $email -notmatch "^[^\s@]+@[^\s@]+\.[^\s@]+$" -or $password.Length -lt 8) {
            Write-JsonResponse -Stream $Stream -StatusCode 400 -StatusText "Bad Request" -Body @{ error = "INVALID_FORM" }
            return
        }
        if (Get-Array $db.users | Where-Object { $_.email -eq $email } | Select-Object -First 1) {
            Write-JsonResponse -Stream $Stream -StatusCode 409 -StatusText "Conflict" -Body @{ error = "EMAIL_ALREADY_EXISTS" }
            return
        }

        $salt = [guid]::NewGuid().ToString("N")
        $user = @{
            id = [guid]::NewGuid().ToString()
            name = $name.Trim()
            email = $email
            passwordSalt = $salt
            passwordHash = Get-PasswordHash -Password $password -Salt $salt
            createdAt = [DateTime]::UtcNow.ToString("o")
        }
        $db.users = @(Get-Array $db.users) + @($user)
        $token = [guid]::NewGuid().ToString("N")
        $db.tokens | Add-Member -NotePropertyName $token -NotePropertyValue $user.id -Force
        Save-Database -Database $db
        Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Body @{ user = New-PublicUser -User $user; token = $token }
        return
    }

    if ($Method -eq "POST" -and $Path -eq "/api/auth/signin") {
        $email = ([string]$body.email).Trim().ToLowerInvariant()
        $password = [string]$body.password
        $user = Get-Array $db.users | Where-Object { $_.email -eq $email } | Select-Object -First 1
        if ($null -eq $user -or $user.passwordHash -ne (Get-PasswordHash -Password $password -Salt $user.passwordSalt)) {
            Write-JsonResponse -Stream $Stream -StatusCode 401 -StatusText "Unauthorized" -Body @{ error = "INVALID_CREDENTIALS" }
            return
        }

        $token = [guid]::NewGuid().ToString("N")
        $db.tokens | Add-Member -NotePropertyName $token -NotePropertyValue $user.id -Force
        Save-Database -Database $db
        Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Body @{ user = New-PublicUser -User $user; token = $token }
        return
    }

    $authUser = Get-AuthUser -Headers $Headers -Database $db
    if ($null -eq $authUser) {
        Write-JsonResponse -Stream $Stream -StatusCode 401 -StatusText "Unauthorized" -Body @{ error = "AUTH_REQUIRED" }
        return
    }

    if ($Method -eq "GET" -and $Path -eq "/api/me") {
        Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Body @{ user = New-PublicUser -User $authUser }
        return
    }

    if ($Method -eq "GET" -and $Path -eq "/api/sessions") {
        $sessions = Get-Array $db.sessions | Where-Object { $_.userId -eq $authUser.id } | Sort-Object completedAt -Descending
        Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Body @{ sessions = @($sessions) }
        return
    }

    if ($Method -eq "POST" -and $Path -eq "/api/sessions") {
        $session = $body.session
        if ($null -eq $session -or [string]::IsNullOrWhiteSpace([string]$session.id)) {
            Write-JsonResponse -Stream $Stream -StatusCode 400 -StatusText "Bad Request" -Body @{ error = "INVALID_SESSION" }
            return
        }

        $session.userId = $authUser.id
        $sessions = @(Get-Array $db.sessions | Where-Object { $_.id -ne $session.id })
        $db.sessions = $sessions + @($session)
        Save-Database -Database $db
        Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Body @{ session = $session }
        return
    }

    Write-JsonResponse -Stream $Stream -StatusCode 404 -StatusText "Not Found" -Body @{ error = "NOT_FOUND" }
}

function Write-HttpResponse {
    param(
        [Parameter(Mandatory = $true)]
        [System.Net.Sockets.NetworkStream]$Stream,
        [Parameter(Mandatory = $true)]
        [int]$StatusCode,
        [Parameter(Mandatory = $true)]
        [string]$StatusText,
        [Parameter(Mandatory = $true)]
        [byte[]]$BodyBytes,
        [Parameter(Mandatory = $true)]
        [string]$ContentType
    )

    $headers = @(
        "HTTP/1.1 $StatusCode $StatusText"
        "Content-Type: $ContentType"
        "Content-Length: $($BodyBytes.Length)"
        "Connection: close"
        ""
        ""
    ) -join "`r`n"

    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)

    if ($BodyBytes.Length -gt 0) {
        $Stream.Write($BodyBytes, 0, $BodyBytes.Length)
    }

    $Stream.Flush()
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::IPv6Any, $Port)
$listener.Server.DualMode = $true
$null = Initialize-Database
$listener.Start()

Write-Host "InterviewPlus available at http://localhost:$Port/"

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()

        try {
            $client.ReceiveTimeout = 500
            $stream = $client.GetStream()
            $stream.ReadTimeout = 500
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $false, 1024, $true)

            $requestLine = $reader.ReadLine()

            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                continue
            }

            $headers = @{}
            while (($line = $reader.ReadLine()) -ne "") {
                if ($null -eq $line) {
                    break
                }
                $separatorIndex = $line.IndexOf(":")
                if ($separatorIndex -gt 0) {
                    $headerName = $line.Substring(0, $separatorIndex).Trim().ToLowerInvariant()
                    $headerValue = $line.Substring($separatorIndex + 1).Trim()
                    $headers[$headerName] = $headerValue
                }
            }

            $parts = $requestLine.Split(" ")
            $method = if ($parts.Length -ge 1) { $parts[0].ToUpperInvariant() } else { "GET" }
            $requestPath = if ($parts.Length -ge 2) { $parts[1] } else { "/" }
            $cleanPath = $requestPath.Split("?")[0]
            $decodedPath = [System.Uri]::UnescapeDataString($cleanPath)

            $bodyText = ""
            if ($headers.ContainsKey("content-length")) {
                $contentLength = [int]$headers["content-length"]
                if ($contentLength -gt 0) {
                    $buffer = New-Object char[] $contentLength
                    $read = $reader.ReadBlock($buffer, 0, $contentLength)
                    if ($read -gt 0) {
                        $bodyText = -join $buffer[0..($read - 1)]
                    }
                }
            }

            if ($decodedPath.StartsWith("/api/", [System.StringComparison]::OrdinalIgnoreCase)) {
                Invoke-ApiRoute -Stream $stream -Method $method -Path $decodedPath -Headers $headers -BodyText $bodyText
                continue
            }

            $relativePath = if ($decodedPath -eq "/") { "index.html" } else { $decodedPath.TrimStart("/") }

            $absolutePath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $relativePath))

            if (-not $absolutePath.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
                $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
                Write-HttpResponse -Stream $stream -StatusCode 403 -StatusText "Forbidden" -BodyBytes $bodyBytes -ContentType "text/plain; charset=utf-8"
                continue
            }

            if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
                $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
                Write-HttpResponse -Stream $stream -StatusCode 404 -StatusText "Not Found" -BodyBytes $bodyBytes -ContentType "text/plain; charset=utf-8"
                continue
            }

            $bodyBytes = [System.IO.File]::ReadAllBytes($absolutePath)
            $extension = [System.IO.Path]::GetExtension($absolutePath).ToLowerInvariant()
            $contentType = if ($contentTypes.ContainsKey($extension)) { $contentTypes[$extension] } else { "application/octet-stream" }

            Write-HttpResponse -Stream $stream -StatusCode 200 -StatusText "OK" -BodyBytes $bodyBytes -ContentType $contentType
        }
        catch {
            # A browser may open an idle speculative connection; close it quickly.
        }
        finally {
            if ($reader) {
                $reader.Dispose()
            }

            if ($stream) {
                $stream.Dispose()
            }

            $client.Dispose()
            $reader = $null
            $stream = $null
        }
    }
}
finally {
    $listener.Stop()
}
