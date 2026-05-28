# EduSpace 🎓

**An open-source, self-hosted educational platform** — built for communities where access to international services like Google Meet, Zoom, or Microsoft Teams is restricted or unavailable.

> **Built to run entirely on local/private infrastructure.** No external dependencies. No cloud lock-in. Your data stays with you.

---

## ✨ Why EduSpace?

Many educators and students around the world face challenges accessing global platforms due to network restrictions, censorship, or infrastructure limitations. EduSpace was built to solve this — giving any school, institute, or individual the power to run a full-featured educational platform on their own server.

**EduSpace replaces:**
- 📹 Google Meet / Zoom / Microsoft Teams → with self-hosted video calls
- 🎮 Disconnected game tools → with real-time in-call educational games
- 📝 Third-party exam platforms → with built-in online exams
- 💬 External chat tools → with integrated persistent chat

---

## 🚀 Features

### 📹 Video Calls
- HD video conferencing (up to 20 participants)
- Screen sharing with audio
- Background blur & virtual backgrounds
- Pre-join screen with device selection
- Custom layouts: Grid, Spotlight, Sidebar
- Persistent chat with emoji support
- Host controls: mute, kick, grant screen share
- Room invite system with real-time notifications

### 🎮 Educational Games
- Real-time multiplayer games inside calls or standalone
- **Word Quest** — vocabulary game with battle mode
- Plugin-based game architecture (add any game with any framework)
- Solo, Battle, and Class modes
- Leaderboard & scoring system

### 📝 Online Exams *(coming soon)*
- Teacher-created exams with auto-grading
- Configurable: allow/deny backtracking, retakes
- Resume after disconnection
- Real-time monitoring

### 🏫 Multi-tenant SaaS Ready
- Multiple institutes can use the same deployment
- Free tier + paid tier support
- Role-based access: Student, Teacher, Admin

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | Django 6 + Django REST Framework + Django Channels |
| Video | LiveKit (self-hosted) |
| Real-time | WebSocket (Django Channels + Redis) |
| Database | PostgreSQL |
| Cache / Pub-Sub | Redis |
| Container | Docker + Docker Compose |

---

## 📦 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/eduspace.git
cd eduspace
```

### 2. Start infrastructure
```bash
docker compose up -d
```

### 3. Backend setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
```

### 4. Run backend
```bash
# For WebSocket support (recommended)
uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --reload

# Or standard Django (HTTP only)
python manage.py runserver
```

### 5. Frontend setup
```bash
cd frontend
npm install
npm run dev
```

### 6. Open the app
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Admin panel: http://localhost:8000/admin

---

## 🐳 Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache & pub/sub |
| LiveKit | 7880-7882 | Video server |

---

## 📁 Project Structure

```
eduspace/
├── frontend/          # React + TypeScript + Vite
│   └── src/
│       ├── features/  # Feature-based modules
│       │   ├── auth/
│       │   ├── room/
│       │   ├── games/
│       │   └── dashboard/
│       └── components/ui/  # Shared UI components
├── backend/           # Django + DRF + Channels
│   ├── accounts/      # User management & auth
│   ├── rooms/         # Video rooms & LiveKit
│   └── games/         # Game engine & WebSocket
├── games/             # Game files (HTML/JS/React)
│   └── word-quest/    # Vocabulary game
└── docker-compose.yml
```

---

## 🎮 Adding Custom Games

EduSpace uses an **iframe-based plugin architecture**. Any game built with any technology can be integrated:

```javascript
// game-bridge.js — add to your game
window.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  if (type === 'GAME_INIT') { /* setup game */ }
  if (type === 'GAME_START') { /* start game */ }
});

// Send events back to platform
window.parent.postMessage({ type: 'SCORE_UPDATE', payload: { score: 100 } }, '*');
```

**Supported game modes:** Solo · Battle · Class (teacher-controlled)

---

## 🔧 Configuration

### LiveKit Keys (production)
```yaml
# docker-compose.yml
livekit:
  command: ["--keys", "your-api-key: your-secret-key"]
```

### Environment Variables
```env
# backend/.env
SECRET_KEY=your-django-secret-key
DB_NAME=eduspace
DB_USER=edu
DB_PASSWORD=your-password
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret
```

---

## 🗺 Roadmap

- [x] Video calls with LiveKit
- [x] Background blur & virtual backgrounds
- [x] In-call educational games
- [x] Host controls (mute, kick)
- [x] Real-time notifications
- [ ] Session recording
- [ ] AI-powered session summary
- [ ] Collaborative whiteboard (Excalidraw)
- [ ] Scheduled sessions & calendar
- [ ] Mobile app (React Native)
- [ ] Online exams with auto-grading

---

## 🤝 Contributing

Contributions are welcome! This project was built to serve communities with limited access to educational tools. If you can help improve it, please do.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 💙 Acknowledgments

Built with [LiveKit](https://livekit.io), [Django](https://djangoproject.com), [React](https://react.dev), and a lot of ☕.

*For everyone who deserves access to quality education — regardless of where they are.*
