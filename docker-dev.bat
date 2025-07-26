@echo off

REM Docker development helper script for Swapanza (Windows)

if "%1"=="start" (
    echo Starting Swapanza with Docker Compose...
    docker-compose up --build
) else if "%1"=="stop" (
    echo Stopping all services...
    docker-compose down
) else if "%1"=="restart" (
    echo Restarting all services...
    docker-compose down
    docker-compose up --build
) else if "%1"=="logs" (
    echo Showing logs...
    docker-compose logs -f
) else if "%1"=="shell" (
    echo Opening Django shell...
    docker-compose exec backend python manage.py shell
) else if "%1"=="migrate" (
    echo Running migrations...
    docker-compose exec backend python manage.py migrate
) else if "%1"=="superuser" (
    echo Creating superuser...
    docker-compose exec backend python manage.py createsuperuser
) else if "%1"=="clean" (
    echo Cleaning up Docker resources...
    docker-compose down -v
    docker system prune -f
) else if "%1"=="rebuild" (
    echo Rebuilding all containers...
    docker-compose down
    docker-compose build --no-cache
    docker-compose up
) else (
    echo Usage: %0 {start^|stop^|restart^|logs^|shell^|migrate^|superuser^|clean^|rebuild}
    echo.
    echo Commands:
    echo   start     - Start all services
    echo   stop      - Stop all services
    echo   restart   - Restart all services
    echo   logs      - Show logs
    echo   shell     - Open Django shell
    echo   migrate   - Run migrations
    echo   superuser - Create superuser
    echo   clean     - Clean up Docker resources
    echo   rebuild   - Rebuild all containers
    exit /b 1
) 