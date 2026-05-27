# start.ps1
Write-Host "Starting EduSpace..." -ForegroundColor Cyan

# Open Cursor in the current directory
Write-Host "Opening Cursor editor..." -ForegroundColor Yellow
Start-Process cursor -ArgumentList "."

# Start Docker Desktop
Write-Host "Opening Docker Desktop..." -ForegroundColor Yellow
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# Wait for Docker to be ready
Write-Host "Waiting for Docker..." -ForegroundColor Yellow
do {
    Start-Sleep -Seconds 3
    $status = docker info 2>&1
} while ($LASTEXITCODE -ne 0)

Write-Host "Docker is ready!" -ForegroundColor Green

# Start services
docker compose up -d

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; .\venv\Scripts\activate; python manage.py runserver"

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm run dev"

Write-Host "All services started!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan

# running command: .\start.ps1