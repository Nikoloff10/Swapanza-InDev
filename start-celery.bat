@echo off
echo Starting Celery Worker and Beat for Swapanza...
echo.
echo Make sure Redis is running on localhost:6379
echo.

set DJANGO_SETTINGS_MODULE=swapanzaBackend.settings
set CELERY_BROKER_URL=redis://localhost:6379/0
set CELERY_RESULT_BACKEND=redis://localhost:6379/0

echo Starting Celery Worker...
start "Celery Worker" cmd /c "celery -A swapanzaBackend worker --loglevel=info --pool=solo"

timeout /t 3 > nul

echo Starting Celery Beat...
start "Celery Beat" cmd /c "celery -A swapanzaBackend beat --loglevel=info"

echo.
echo Celery Worker and Beat started in separate windows.
echo Check those windows for logs.
echo Press any key to exit this script (Celery will continue running)...
pause > nul
