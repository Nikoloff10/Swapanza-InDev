# Swapanza

## Project Overview
Swapanza is a real-time chat application with a unique twist: users can temporarily swap their identities during conversations. It features JWT authentication, real-time messaging, Swapanza mode, and robust security best practices.

---

## Setup & Installation

### 1. Clone the Repository
```sh
git clone <repo-url>
cd Swapanza
```

### 2. Python Backend Setup
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

### 3. Frontend Setup
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

### 4. Redis & Celery (for real-time and background tasks)
- Start Redis server (see Redis docs for your OS).
- Start Celery worker:
  ```sh
  celery -A swapanzaBackend worker --loglevel=info --pool=solo
  ```
- Start Celery beat (for scheduled tasks):
  ```sh
  celery -A swapanzaBackend beat --loglevel=info
  ```

---

## Environment Variables
Create a `.env` file in the project root with the following (example):
```
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=http://localhost:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///db.sqlite3
```
- **Never set DEBUG=True in production!**
- Set your production domain(s) in `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS`.

---

## Security & Best Practices
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

---

## Contributing
- Please lint and format your code before submitting PRs:
  - Frontend: `npm run lint` and `npm run format`
  - Backend: `black .` and `flake8`

---

## License
MIT
````

