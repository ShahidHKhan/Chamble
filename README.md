# Chamble

A real-time multiplayer chess platform built for hybrid game modes — starting with **Chess 21** (chess meets blackjack-style scoring). Built as a pnpm monorepo with Turbo.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, TypeScript 6 |
| Chess | chess.js 1.4 (rules engine), react-chessboard 5 (UI) |
| Real-time | Socket.IO 4.8 (client + server) |
| Backend | Express 5, Node.js, TypeScript 6 |
| Live state | Redis 7 via ioredis (Docker) |
| Persistence | Supabase (Postgres + Auth) |
| Monorepo | Turbo 2, pnpm 11 |

## Repo structure

```
Chamble/
├── apps/
│   ├── web/            # React frontend
│   └── server/         # Express + Socket.IO backend
├── packages/
│   └── shared/         # Shared types and Socket.IO event constants
├── docker-compose.yml  # Redis service
├── turbo.json
└── package.json
```

### apps/web

Six pages routed via React Router:

| Route | Page | Description |
|---|---|---|
| `/` | LandingPage | Login / sign-up |
| `/home` | HomePage | Dashboard |
| `/games` | GamesPage | Browse game modes |
| `/games/chess21` | Chess21LobbyPage | Create or join a room |
| `/play` | GamePage | Live chessboard |
| `/profile` | ProfilePage | Stats, history, friends |

Key hooks:
- `useChessGame` — chess engine state, move validation, bot moves
- `useClock` — per-side countdown timer (10 min default)

Key context:
- `AuthContext` — current user, login, logout

### apps/server

- `GET /health` — liveness probe
- Socket.IO handlers: `CREATE_ROOM`, `JOIN_ROOM`, `GAME_START`, `disconnect`
- In-memory room map; Redis and Supabase clients initialized but not yet wired to game logic

### packages/shared

Single source of truth for event names and game types used across both apps.

**Events:**
```
CREATE_ROOM  JOIN_ROOM   ROOM_CREATED  ROOM_JOINED
GAME_START   MOVE        GAME_OVER     DRAW_OFFER
DRAW_ACCEPT  RESIGN      CLOCK_TICK
```

**Types:** `Player`, `GameState`, `Move`

## What works today

- Local 2-player chess (full rules: castling, en passant, promotion, check/checkmate/stalemate)
- Play vs. computer (random-legal-move bot)
- Multiplayer room creation and joining via 4-character room codes (Socket.IO handshake)
- Player info bars: name, ELO, time remaining, captured pieces
- Move history in algebraic notation
- Pause / resume (local games)
- Resign

## What's coming

- [ ] Move relay between players over Socket.IO
- [ ] Server-side move validation and game state in Redis
- [ ] Real auth and Supabase persistence (completed games, ELO updates)
- [ ] Blitz, Wager Match, Team Battle game modes
- [ ] Real-time clock sync between clients
- [ ] Draw offers

## Running locally

**Prerequisites:** Node.js, pnpm, Docker

```bash
# Install dependencies
pnpm install

# Start Redis
docker-compose up -d

# Start all services (frontend + backend)
pnpm dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3001 |

**Demo accounts** (mock auth, no password required):

| Username | Password |
|---|---|
| `demo` | `demo` |
| `magnus` | `magnus` |
| `hikaru` | `hikaru` |

## Environment variables

**apps/web/.env.local**
```
VITE_SERVER_URL=http://localhost:3001
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

**apps/server/.env**
```
PORT=3001
REDIS_URL=redis://localhost:6379
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_KEY=<your-supabase-service-key>
```

## How data flows

1. Client validates and renders moves instantly via chess.js.
2. Socket.IO relays events between players and the server.
3. Redis holds active, in-progress game state.
4. Supabase stores completed games, users, stats, and ratings.

total = 100
pawns = 30%
queen = 10%
knight = 20%
bishop = 20%
rook = 20%