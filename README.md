# Swapanza

Swapanza is a chat application with a unique twist - it allows users to temporarily swap their identities (usernames and profile pictures) during conversations.

## Table of Contents

- [Technologies](#technologies)
- [Project Overview](#project-overview)
- [Features](#features)
- [Setup & Installation](#setup--installation)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Running the Application](#running-the-application)
- [User Guide](#user-guide)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)

## Technologies

### Backend
- **Django**: Web framework
- **Django REST Framework**: API development
- **PostgreSQL**: Database (configurable)
- **JWT Authentication**: Token-based authentication for API endpoints
- **Cloudinary**: Cloud-based image and video management for storing user uploads
- **Celery**: Distributed task queue for handling asynchronous tasks
- **Redis**: Message broker for Celery and real-time features

### Frontend
- **ReactJS**: JavaScript library for building web user interfaces
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client for API requests

### DevOps & Tooling
- **Static Files**: Django staticfiles for serving static content
- **npm**: Package manager for frontend dependencies
- **pip**: Package manager for backend dependencies

## Project Overview

This platform is created to demonstrate my knowledge of backend web development with Python (Django) and frontend development with JavaScript (React). Swapanza is a fun and interactive chat application with a unique twist - users can temporarily swap their usernames and profile pictures during conversations, creating amusing and sometimes confusing chat experiences.

The application allows users to create profiles, chat with others, and initiate "Swapanza" requests that, when accepted, switch the visual identities of the participants. This interactive functionality showcases both the technical implementation and the creative concept behind the project.

## Features

### User Authentication and Profiles
- User registration and login with JWT authentication
- Profile customization with bio and profile image
- User search functionality

### Real-time Chat
- Start chat conversations with other users
- Real-time message delivery using WebSockets
- Chat history preservation

### Swapanza Feature
- Request to swap identities with chat partners
- Temporary username and profile picture exchange
- Return to normal identities after "Swapanza" mode expires

### User Dashboard
- View all recent chats
- Manage profile settings
- See online status of other users

## Setup & Installation

### Prerequisites

- Python 3.8+ 
- Node.js 14+ and npm
- PostgreSQL
- Git

### Backend Setup

1. Clone the repository:
```
git clone https://github.com/Nikoloff10/Swapanza
cd Swapanza
code .
```

2. Create and activate a virtual environment:
```
python -m venv venv
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

3. Install backend dependencies:
```
pip install -r requirements.txt
```

4. Set up environment variables (create a .env file in the project root):
```
DEBUG=True
SECRET_KEY=your_secret_key
DATABASE_URL=postgresql://user:password@localhost/dbname

REDIS_URL=redis://localhost:6379/1 # Adjust if your Redis runs elsewhere

# Cloudinary Credentials (Get from your Cloudinary account)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

5. Run migrations:
```
python manage.py migrate
```

6. Create a superuser:
```
python manage.py createsuperuser
```

7. Collect static files:
```
python manage.py collectstatic --noinput
```

### Frontend Setup

1. Navigate to the frontend directory:
```
cd frontend
```

2. Install dependencies:
```
npm install
```

3. Create a .env file for frontend configuration:
```
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_WEBSOCKET_URL=ws://localhost:8000
```

### Running the Application

Ensure your Redis server is running before starting the other components.

1. **Ensure Redis is running**:
   - If installed as a service, it might already be running.
   - If running manually, start it (command depends on your OS/installation, e.g., `redis-server`).

2. **Start the Django backend server**:
```
# From the project root, with venv activated
python manage.py runserver
```

3. **Start the Celery worker and beat**:
```
# In a new terminal, from the project root, with venv activated
celery -A swapanzaBackend worker --loglevel=info
# In another new terminal, from the porject root, with venv activated
celery -A swapanzaBackend beat -l info
```

4. **Start the React development server**:
```
# In another new terminal, from the frontend directory
npm start
```

5. **Access the application**:
   - http://localhost:8000

## User Guide

### Registration and Login

1. Navigate to the homepage and click "Register" to create a new account
2. Fill in your details and submit the registration form
3. After registration, log in with your credentials
4. You'll be directed to your dashboard/homepage

### Setting Up Your Profile

1. Click on your profile icon
2. Upload a profile image and add a bio.
3. Save your changes.

### Starting a Chat

1. Search for the username of the user you wish to chat with in the search bar.
2. Click on their username in the search results.
3. The chat window opens with the corresponding user's chat history loaded (if you have chatted before). You can now send messages.

### Initiating a Swap

1. While in a chat window, click on the purple "Swapanza" button.
2. A swap request is sent to the other user. Wait for them to accept or reject.
3. If the other user accepts, your usernames and profile pictures will be temporarily swapped *within that specific chat and also all   chats you initiate during your active Swapanza session*.
4. Enjoy the fun and confusion this creates as you communicate with swapped identities!

### Managing Swaps

- Swaps are temporary and will automatically expire after a set duration.
- When the swap expires, your identities within the chat will automatically revert to normal.
````

