# Al-Muslim Group Garments Factory ERP Server (PowerShell HttpListener)
param(
    [int]$Port = 3030,
    [string]$RootPath = "$PSScriptRoot\public"
)

$DataPath = "$PSScriptRoot\data"
$DbFile = "$DataPath\erp_database.json"
if (!(Test-Path $DataPath)) { New-Item -ItemType Directory -Path $DataPath -Force | Out-Null }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
    $listener.Prefixes.Add("http://127.0.0.1:$Port/")
} catch {}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml; charset=utf-8"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
    ".xlsx" = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
}

try {
    $listener.Start()
    Write-Host "=========================================================================" -ForegroundColor Cyan
    Write-Host "  AL-MUSLIM GROUP - GARMENTS FACTORY MAINTENANCE MACHINE INVENTORY ERP" -ForegroundColor Yellow
    Write-Host "=========================================================================" -ForegroundColor Cyan
    Write-Host "  Server started successfully at http://localhost:$Port/" -ForegroundColor Green
    Write-Host "  Document Root: $RootPath" -ForegroundColor Gray
    Write-Host "  Press Ctrl+C to stop the server.`n" -ForegroundColor DarkGray

    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response

            # Add CORS & No-Cache headers
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")
            $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
            $response.AddHeader("Pragma", "no-cache")
            $response.AddHeader("Expires", "0")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 204
                $response.OutputStream.Close()
                continue
            }

            $urlPath = $request.Url.LocalPath
            if ($urlPath -match "^(?i)/erp(/.*)?$") {
                $urlPath = if ($Matches[1]) { $Matches[1] } else { "/" }
            }
            if ($urlPath -eq "/" -or $urlPath -eq "") {
                $urlPath = "/index.html"
            }

            # Normalize relative path
            $safeRelPath = $urlPath.TrimStart('/').Replace('/', '\')
            $filePath = Join-Path $RootPath $safeRelPath

            # Handle API health check
            if ($urlPath -eq "/api/health") {
                $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok","system":"Al-Muslim Group - Maintenance Department ERP"}')
                $response.ContentType = "application/json; charset=utf-8"
                $response.StatusCode = 200
                $response.ContentLength64 = $jsonBytes.Length
                $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
                $response.OutputStream.Close()
                continue
            }

            # Handle Database Records Store API
            if ($urlPath -eq "/api/db/records") {
                if ($request.HttpMethod -eq "GET") {
                    $jsonStr = if (Test-Path $DbFile) {
                        $c = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8)
                        if ([string]::IsNullOrWhiteSpace($c)) { '{"status":"empty","records":null}' } else { "{`"status`":`"ok`",`"records`":$c}" }
                    } else {
                        '{"status":"empty","records":null}'
                    }
                    $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.StatusCode = 200
                    $response.ContentLength64 = $jsonBytes.Length
                    $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
                    $response.OutputStream.Close()
                    continue
                }
                if ($request.HttpMethod -eq "POST") {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                    $body = $reader.ReadToEnd()
                    [System.IO.File]::WriteAllText($DbFile, $body, [System.Text.Encoding]::UTF8)
                    $respStr = '{"status":"ok","message":"Database records stored successfully to disk"}'
                    $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($respStr)
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.StatusCode = 200
                    $response.ContentLength64 = $jsonBytes.Length
                    $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
                    $response.OutputStream.Close()
                    continue
                }
            }

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
                $response.ContentType = $contentType
                $response.StatusCode = 200

                $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $fileBytes.Length
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
                }
            } else {
                # Fallback to index.html for Single Page App routing
                $indexFile = Join-Path $RootPath "index.html"
                if (Test-Path $indexFile) {
                    $response.ContentType = "text/html; charset=utf-8"
                    $response.StatusCode = 200
                    $fileBytes = [System.IO.File]::ReadAllBytes($indexFile)
                    $response.ContentLength64 = $fileBytes.Length
                    if ($request.HttpMethod -ne "HEAD") {
                        $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
                    }
                } else {
                    $response.StatusCode = 404
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                    $response.ContentLength64 = $errBytes.Length
                    if ($request.HttpMethod -ne "HEAD") {
                        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    }
                }
            }
        } catch {
            # Log minor client disconnect / stream error and continue listening
        } finally {
            try {
                if ($null -ne $response) {
                    $response.OutputStream.Close()
                }
            } catch {}
        }
    }
} catch {
    Write-Host "Server fatal error: $_" -ForegroundColor Red
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
