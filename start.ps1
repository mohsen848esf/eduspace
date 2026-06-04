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
# Interactive Arrow-Key Menu Selector
# ---------------------------------------------------------------------------
function Show-Menu {
    param(
        [string]$Question,
        [string[]]$Options,
        [int]$DefaultIndex = 0
    )

    $isInteractive = $true
    try {
        $startRow = [Console]::CursorTop
        $startCol = [Console]::CursorLeft
        $null = [Console]::KeyAvailable
    } catch {
        $isInteractive = $false
    }

    if (-not $isInteractive) {
        Write-Host $Question -ForegroundColor Cyan
        for ($i = 0; $i -lt $Options.Count; $i++) {
            Write-Host ("  [{0}] {1}" -f ($i + 1), $Options[$i])
        }
        $raw = Read-Host ("Enter choice (default {0})" -f ($DefaultIndex + 1))
        if ([string]::IsNullOrWhiteSpace($raw)) { return $DefaultIndex }
        if ([int]::TryParse($raw, [ref]$val)) {
            $idx = $val - 1
            if ($idx -ge 0 -and $idx -lt $Options.Count) { return $idx }
        }
        return $DefaultIndex
    }

    $selectedIndex = $DefaultIndex
    $running = $true

    $cursorVisible = $true
    try {
        $cursorVisible = [Console]::CursorVisible
        [Console]::CursorVisible = $false
    } catch {}

    # Clear key buffer
    while ([Console]::KeyAvailable) {
        $null = [Console]::ReadKey($true)
    }

    while ($running) {
        try {
            [Console]::SetCursorPosition($startCol, $startRow)
        } catch {}

        Write-Host $Question -ForegroundColor Cyan
        for ($i = 0; $i -lt $Options.Count; $i++) {
            if ($i -eq $selectedIndex) {
                Write-Host (" > {0}" -f $Options[$i]) -ForegroundColor Green
            } else {
                Write-Host ("   {0}" -f $Options[$i]) -ForegroundColor Gray
            }
        }

        $keyInfo = [Console]::ReadKey($true)
        switch ($keyInfo.Key) {
            'UpArrow' {
                $selectedIndex = ($selectedIndex - 1 + $Options.Count) % $Options.Count
            }
            'DownArrow' {
                $selectedIndex = ($selectedIndex + 1) % $Options.Count
            }
            'Enter' {
                $running = $false
            }
        }
    }

    try {
        [Console]::CursorVisible = $cursorVisible
    } catch {}

    # Clear the menu lines from console
    try {
        [Console]::SetCursorPosition($startCol, $startRow)
        $bufferWidth = 80
        try { $bufferWidth = [Console]::BufferWidth } catch {}
        $linesToClear = $Options.Count + 1
        for ($i = 0; $i -lt $linesToClear; $i++) {
            Write-Host (" " * ($bufferWidth - 1))
        }
        [Console]::SetCursorPosition($startCol, $startRow)
    } catch {}

    Write-Host ("{0} Selected: {1}" -f $Question, $Options[$selectedIndex]) -ForegroundColor Green
    return $selectedIndex
}


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
        $options = @()
        foreach ($av in $available) {
            $options += $av.Name
        }
        $options += "don't open any editor"
        
        $idx = Show-Menu -Question 'Which editor do you want to open?' -Options $options -DefaultIndex 0
        if ($idx -lt $available.Count) {
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
# Docker Desktop on Windows takes 15-30 s to start the Linux engine
# and create the named pipe. Give it a head-start before the first
# probe so we don't print a scary error on the first attempt.
Start-Sleep -Seconds 8
do {
    # Run docker info via cmd to completely avoid PowerShell stream conversion/crash
    # when $ErrorActionPreference = 'Stop'
    $null = cmd /c "docker info 2>nul"
    if ($LASTEXITCODE -eq 0) { break }
    $tries += 1
    if ($tries -gt 40) {
        Write-Host 'Docker did not become ready within ~2 minutes. Aborting.' -ForegroundColor Red
        exit 1
    }
    Write-Host ("  still waiting... ({0})" -f $tries) -ForegroundColor DarkGray
    Start-Sleep -Seconds 4
} while ($true)

Write-Host 'Docker is ready.' -ForegroundColor Green

Write-Host 'Bringing up the dev stack (db, redis, livekit, livekit-egress)...' -ForegroundColor Yellow
docker compose up -d

# ---------------------------------------------------------------------------
# Backend & frontend in their own terminals
# ---------------------------------------------------------------------------
$serviceOptions = @(
    'Both (Backend & Frontend)',
    'Frontend only',
    'Backend only',
    'None'
)
Write-Host ''
$serviceIdx = Show-Menu -Question 'Which services do you want to start?' -Options $serviceOptions -DefaultIndex 0

$startBackend = $false
$startFrontend = $false

if ($serviceIdx -eq 0) {
    $startBackend = $true
    $startFrontend = $true
} elseif ($serviceIdx -eq 1) {
    $startFrontend = $true
} elseif ($serviceIdx -eq 2) {
    $startBackend = $true
}

$backendCmd = "cd '$projectRoot\backend'; .\venv\Scripts\activate; uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --reload"
$frontendCmd = "cd '$projectRoot\frontend'; npm run dev"

if ($startBackend) {
    Write-Host 'Starting Backend in a new window...' -ForegroundColor Yellow
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $backendCmd
}
if ($startFrontend) {
    Write-Host 'Starting Frontend in a new window...' -ForegroundColor Yellow
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $frontendCmd
}

Write-Host ''
if ($startBackend -or $startFrontend) {
    Write-Host 'Selected services started.' -ForegroundColor Green
    if ($startFrontend) { Write-Host '  Frontend: http://localhost:5173' -ForegroundColor Cyan }
    if ($startBackend)  { Write-Host '  Backend:  http://localhost:8000' -ForegroundColor Cyan }
} else {
    Write-Host 'No services started.' -ForegroundColor Yellow
}
