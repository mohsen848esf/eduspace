# start.ps1 — bring up the EduSpace dev stack.
#
# Usage:
#   .\start.ps1                       # interactive editor picker
#   .\start.ps1 -Editor cursor        # skip the prompt, use a specific editor
#   .\start.ps1 -Editor none          # don't open any editor
#
# Built-in editor candidates: cursor, code (VS Code).
# To make the picker also detect other editors installed on your machine,
# create a gitignored file `.editors.local` in the project root with one
# editor command per line, or set the environment variable
# EDUSPACE_EDITORS to a comma-separated list (e.g. "myide,otherone").

[CmdletBinding()]
param(
    [string]$Editor = ''
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host 'Starting EduSpace...' -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# Pick an editor
# ---------------------------------------------------------------------------
function Get-EditorCandidates {
    $candidates = [System.Collections.Generic.List[string]]::new()
    $candidates.Add('cursor')
    $candidates.Add('code')

    # Local override file — gitignored, lets each developer add their own
    # preferred editors without committing the name to the repo.
    $localFile = Join-Path $projectRoot '.editors.local'
    if (Test-Path $localFile) {
        Get-Content $localFile | ForEach-Object {
            $name = $_.Trim()
            if ($name -and -not $candidates.Contains($name)) {
                $candidates.Add($name) | Out-Null
            }
        }
    }

    # Env-var override — same idea, useful in CI / shared shells.
    if ($env:EDUSPACE_EDITORS) {
        foreach ($name in $env:EDUSPACE_EDITORS -split ',') {
            $trimmed = $name.Trim()
            if ($trimmed -and -not $candidates.Contains($trimmed)) {
                $candidates.Add($trimmed) | Out-Null
            }
        }
    }

    return $candidates.ToArray()
}

function Resolve-Editor {
    param([string[]]$Candidates)
    $found = @()
    foreach ($name in $Candidates) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) {
            $found += [pscustomobject]@{
                Name = $name
                Path = $cmd.Source
            }
        }
    }
    return $found
}

$editorChoice = $Editor.ToLower()
if (-not $editorChoice) {
    $available = Resolve-Editor -Candidates (Get-EditorCandidates)
    if ($available.Count -eq 0) {
        Write-Host 'No editor found on PATH. Skipping (set EDUSPACE_EDITORS or .editors.local to add candidates).' -ForegroundColor Yellow
        $editorChoice = 'none'
    }
    elseif ($available.Count -eq 1) {
        $editorChoice = $available[0].Name
        Write-Host ("Only {0} found, using it." -f $editorChoice) -ForegroundColor DarkGray
    }
    else {
        Write-Host ''
        Write-Host 'Which editor do you want to open?' -ForegroundColor Cyan
        for ($i = 0; $i -lt $available.Count; $i++) {
            Write-Host ("  [{0}] {1}" -f ($i + 1), $available[$i].Name)
        }
        Write-Host ("  [{0}] don't open any editor" -f ($available.Count + 1))
        $raw = Read-Host 'Enter choice (default 1)'
        if ([string]::IsNullOrWhiteSpace($raw)) { $raw = '1' }
        $idx = [int]$raw - 1
        if ($idx -ge 0 -and $idx -lt $available.Count) {
            $editorChoice = $available[$idx].Name
        }
        else {
            $editorChoice = 'none'
        }
    }
}

if ($editorChoice -ne 'none') {
    Write-Host ("Opening {0}..." -f $editorChoice) -ForegroundColor Yellow
    Start-Process $editorChoice -ArgumentList '.'
}

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------
$dockerExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
if (Test-Path $dockerExe) {
    Write-Host 'Opening Docker Desktop...' -ForegroundColor Yellow
    Start-Process $dockerExe
} else {
    Write-Host 'Docker Desktop not found at the expected path; assuming the daemon is already running.' -ForegroundColor DarkGray
}

Write-Host 'Waiting for Docker daemon...' -ForegroundColor Yellow
$tries = 0
do {
    Start-Sleep -Seconds 3
    docker info 2>$null | Out-Null
    $tries += 1
    if ($tries -gt 40) {
        Write-Host 'Docker did not become ready within 2 minutes. Aborting.' -ForegroundColor Red
        exit 1
    }
} while ($LASTEXITCODE -ne 0)

Write-Host 'Docker is ready.' -ForegroundColor Green

Write-Host 'Bringing up the dev stack (db, redis, livekit, livekit-egress)...' -ForegroundColor Yellow
docker compose up -d

# ---------------------------------------------------------------------------
# Backend & frontend in their own terminals
# ---------------------------------------------------------------------------
$backendCmd = "cd '$projectRoot\backend'; .\venv\Scripts\activate; uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --reload"
$frontendCmd = "cd '$projectRoot\frontend'; npm run dev"

Start-Process powershell -ArgumentList '-NoExit', '-Command', $backendCmd
Start-Process powershell -ArgumentList '-NoExit', '-Command', $frontendCmd

Write-Host ''
Write-Host 'All services started.' -ForegroundColor Green
Write-Host '  Frontend: http://localhost:5173' -ForegroundColor Cyan
Write-Host '  Backend:  http://localhost:8000' -ForegroundColor Cyan
