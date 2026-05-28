# EduSpace — Frontend

React 18 + TypeScript + Vite + Tailwind CSS v4

## Setup

```bash
npm install
npm run dev
```

## Tech Stack

- **React 18** + TypeScript
- **Vite** — build tool
- **Tailwind CSS v4** — styling
- **Zustand** — client state management
- **React Query (TanStack)** — server state
- **React Hook Form + Zod** — forms & validation
- **LiveKit Components** — video call UI
- **react-hot-toast** — notifications

## Structure

```
src/
├── features/           # Feature-based modules
│   ├── auth/           # Login, Register, Auth store
│   ├── room/           # Video call, PreJoin, Controls
│   ├── games/          # Game container (iframe)
│   └── dashboard/      # Dashboard page
├── components/
│   └── ui/             # Shared: Button, Input, Spinner, Tooltip
├── lib/
│   ├── api/            # Axios client
│   ├── constants/      # Icons (SVG), Strings (i18n-ready)
│   └── utils.ts        # cn() helper
└── router/             # React Router, PrivateRoute, PublicRoute
```

## Design System

CSS variables defined in `src/styles/design-system.css`:

```css
--brand: #6366f1; /* Primary color */
--s0..s3: ...; /* Surface colors */
--t1..t3: ...; /* Text colors */
```

Dark mode / Light mode supported via `.light` class on root.

## Adding a Game

1. Place game files in `/games/your-game/`
2. Add `game-bridge.js` to handle postMessage protocol
3. Copy to `frontend/public/games/your-game/`
4. Register in game list via admin panel

## Environment

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```
