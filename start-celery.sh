#!/bin/bash
echo "Starting Celery Worker and Beat for Swapanza..."
echo ""
echo "Make sure Redis is running on localhost:6379"
echo ""

export DJANGO_SETTINGS_MODULE=swapanzaBackend.settings
export CELERY_BROKER_URL=redis://localhost:6379/0
export CELERY_RESULT_BACKEND=redis://localhost:6379/0

echo "Starting Celery Worker..."
celery -A swapanzaBackend worker --loglevel=info &
WORKER_PID=$!

echo "Starting Celery Beat..."
celery -A swapanzaBackend beat --loglevel=info &
BEAT_PID=$!

echo ""
echo "Celery Worker (PID: $WORKER_PID) and Beat (PID: $BEAT_PID) started."
echo "Press Ctrl+C to stop both processes..."

# Wait for Ctrl+C
trap "echo 'Stopping Celery processes...'; kill $WORKER_PID $BEAT_PID; exit" INT
wait
