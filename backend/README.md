# EduSpace — Backend

Django 6 + Django REST Framework + Django Channels

## Setup

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
```

## Run

```bash
# With WebSocket support (required for video rooms & notifications)
uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --reload

# HTTP only (no WebSocket)
python manage.py runserver
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register new user |
| POST | `/api/auth/login/` | Login |
| GET | `/api/auth/me/` | Current user |
| POST | `/api/auth/logout/` | Logout |
| GET | `/api/auth/search/?q=` | Search users |

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rooms/create/` | Create room |
| POST | `/api/rooms/{code}/join/` | Join room |
| POST | `/api/rooms/{code}/leave/` | Leave room |
| GET | `/api/rooms/{code}/` | Get room info |
| POST | `/api/rooms/{code}/invite/` | Invite user |
| POST | `/api/rooms/{code}/kick/` | Kick participant |

### Games
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games/` | List games |
| POST | `/api/games/{id}/session/create/` | Create game session |
| GET | `/api/games/session/{code}/` | Get session |

## WebSocket

| Path | Description |
|------|-------------|
| `ws://host/ws/game/{room_code}/` | Game real-time |
| `ws://host/ws/notifications/` | User notifications |

## Apps

- **accounts** — User model (AbstractUser), JWT auth
- **rooms** — Video room management, LiveKit integration
- **games** — Game engine, WebSocket consumer
