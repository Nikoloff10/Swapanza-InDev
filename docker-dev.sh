#!/bin/bash

# Docker development helper script for Swapanza

case "$1" in
    "start")
        echo "Starting Swapanza with Docker Compose..."
        docker-compose up --build
        ;;
    "stop")
        echo "Stopping all services..."
        docker-compose down
        ;;
    "restart")
        echo "Restarting all services..."
        docker-compose down
        docker-compose up --build
        ;;
    "logs")
        echo "Showing logs..."
        docker-compose logs -f
        ;;
    "shell")
        echo "Opening Django shell..."
        docker-compose exec backend python manage.py shell
        ;;
    "migrate")
        echo "Running migrations..."
        docker-compose exec backend python manage.py migrate
        ;;
    "superuser")
        echo "Creating superuser..."
        docker-compose exec backend python manage.py createsuperuser
        ;;
    "clean")
        echo "Cleaning up Docker resources..."
        docker-compose down -v
        docker system prune -f
        ;;
    "rebuild")
        echo "Rebuilding all containers..."
        docker-compose down
        docker-compose build --no-cache
        docker-compose up
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|shell|migrate|superuser|clean|rebuild}"
        echo ""
        echo "Commands:"
        echo "  start     - Start all services"
        echo "  stop      - Stop all services"
        echo "  restart   - Restart all services"
        echo "  logs      - Show logs"
        echo "  shell     - Open Django shell"
        echo "  migrate   - Run migrations"
        echo "  superuser - Create superuser"
        echo "  clean     - Clean up Docker resources"
        echo "  rebuild   - Rebuild all containers"
        exit 1
        ;;
esac 