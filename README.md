# Swapanza

## Project Overview

Swapanza is a real-time chat application with a unique twist: users can temporarily swap their identities during conversations. It features JWT authentication, real-time messaging, Swapanza mode, and robust security best practices.

---

## DISCLAIMER:

For the sake of maintaining notification, chat history and message loading functionalities ALL of the sent messages
are saved to the database.

## Setup & Installation

### Option 1: Docker (Recommended)

The easiest way to run Swapanza is using Docker Compose, which sets up all services automatically:

```sh
# Clone the repository
git clone https://github.com/Nikoloff10/Swapanza-InDev
cd Swapanza

# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

This will start:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Celery Worker**: Background task processing

#### Docker Commands:

```sh
# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (database data)
docker-compose down -v

# Rebuild specific service
docker-compose build backend

# Access backend shell
docker-compose exec backend python manage.py shell

# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser
```

### Option 2: Local Development

#### 1. Clone the Repository

```sh
git clone https://github.com/Nikoloff10/Swapanza-InDev
cd Swapanza
```

#### 2. Python Backend Setup

- Create and activate a virtual environment:
  ```sh
  python -m venv .venv
  source .venv/bin/activate  # On Windows: .venv\Scripts\activate
  ```
- Install dependencies:
  ```sh
  pip install -r requirements.txt
  ```
- Set up your `.env` file (see below).
- Run migrations:
  ```sh
  python manage.py migrate
  ```
- Start the backend server:
  ```sh
  python manage.py runserver
  ```

#### 3. Frontend Setup

- Go to the frontend directory:
  ```sh
  cd frontend
  ```
- Install dependencies:
  ```sh
  npm install
  ```
- Start the frontend server:
  ```sh
  npm start
  ```

#### 4. Redis & Celery (for real-time and background tasks)

- Start Redis server (see Redis docs for your OS).
- Start Celery worker:
  ```sh
  celery -A backend worker --loglevel=info --pool=solo
  ```
- Start Celery beat (for scheduled tasks):
  ```sh
  celery -A backend beat --loglevel=info
  ```

---

## Environment Variables

Create a `.env` file in the project root with the following (example):

```
# Database Configuration
POSTGRES_DB=swapanza
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here

# Cloudinary Configuration (Get these from your Cloudinary dashboard)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Django Configuration
DJANGO_SETTINGS_MODULE=backend.settings
DJANGO_SECRET_KEY=your-secret-key-here-generate-a-new-one
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:80,http://frontend:80
CORS_ALLOW_CREDENTIALS=True

# Frontend Configuration
REACT_APP_API_URL=http://localhost:8000

# Database and Redis URLs (for Docker)
DATABASE_URL=postgresql://postgres:your_secure_password_here@db:5432/swapanza
REDIS_URL=redis://redis:6379/0

# Celery Configuration
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
```

- Set your production domain(s) in `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS`.

---

## Security

- All sensitive settings are controlled via environment variables.
- CORS and CSRF are locked down for production.
- All endpoints require authentication.
- File uploads are validated for type and size.
- Passwords must be strong (min 8 chars, letter, number).
- Logging is used everywhere (no print statements).

---

## Upgrading & Maintenance

- To upgrade frontend dependencies:
  ```sh
  cd frontend
  npm install <package>@latest
  ```
- To upgrade backend dependencies:
  ```sh
  pip install --upgrade <package>
  ```
- After upgrades, always test authentication, chat, Swapanza, and notifications.

---

## UI/UX & Bugfixes

- The frontend uses toast notifications for all user-facing errors.
- All major flows are tested for React 19 and React Router 7 compatibility.
- If you find a bug, check the browser console and backend logs for details.
