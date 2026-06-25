# Chamble

Chess + Gamble. A real-time multiplayer chess platform with three game variants built on top of standard chess rules.

Live at **[chamble.net](https://chamble.net)**

## How It Works

Players create an account, then choose a game variant from the lobby. Each variant adds a gambling mechanic on top of chess:

- **Chess-21** — when you capture a piece, a blackjack round triggers. Win the hand to keep the capture; bust and the piece is returned.
- **Chess-Matics** — captures are gated behind a math challenge. Solve it in time to complete the move.
- **Chess-Roulette** — before each turn a wheel is spun, locking the player to moving only the piece type it lands on.

Games are played in real-time over WebSockets. Players can set wagers (ELO stakes), enable move timers, and invite opponents via a 4-character room code. Match results, ELO changes, and history are stored per user. A daily reward system gives players a passive ELO bonus each day.

Auth uses bcrypt-hashed passwords and signed JWTs — no third-party auth provider. Password resets are handled via a 6-digit emailed code with a 15-minute expiry.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, React Router, Vite, TypeScript |
| Backend | Express 5, Node.js, TypeScript |
| Real-time | Socket.IO |
| Chess engine | chess.js, react-chessboard |
| Auth | bcrypt + custom JWTs |
| Database | PostgreSQL via Supabase |
| Email | Resend |
| Monorepo | Turbo 2, pnpm 11 |

## Infrastructure

| Service | Role |
|---|---|
| **Cloudflare** | Domain registrar and DNS for `chamble.net`; frontend hosted on Cloudflare Pages |
| **Fly.io** | Backend server (Express + Socket.IO) at `api.chamble.net` |
| **Supabase** | Managed PostgreSQL — users, matches, friendships, tokens |
| **Resend** | Transactional email — password reset and email verification from `noreply@chamble.net` |

## Repo Structure

```
Chamble/
├── apps/
│   ├── web/            # React frontend (Cloudflare Pages)
│   └── server/         # Express + Socket.IO backend (Fly.io)
├── packages/
│   └── shared/         # Shared TypeScript types and Socket.IO event constants
├── Dockerfile          # Multi-stage Docker build for Fly.io
├── fly.toml            # Fly.io app config
├── turbo.json
└── package.json
```

## Routes

| Route | Page |
|---|---|
| `/` | Landing page |
| `/login` | Sign in |
| `/register` | Create account |
| `/verify-email` | Email verification |
| `/forgot-password` | Password reset |
| `/home` | Dashboard |
| `/games` | Browse game modes |
| `/games/chess21` | Chess-21 lobby |
| `/games/chessmatics` | Chess-Matics lobby |
| `/games/chessroulette` | Chess-Roulette lobby |
| `/play` | Live game |
| `/profile/:username` | Public profile, stats, match history |

## Running Locally

**Prerequisites:** Node.js 22+, pnpm 11

```bash
pnpm install
pnpm dev
```

Start Redis (required for local dev):
```bash
docker compose up -d
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3001 |

## Environment Variables

`apps/server/.env`:
```
PORT=3001
CORS_ORIGIN=http://localhost:5173
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
JWT_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@chamble.net
```

## Auth

- Passwords hashed with bcrypt (cost 12)
- Sessions via signed JWTs (7-day expiry)
- Login accepts username or email
- Email verification required on registration
- Password reset via 6-digit emailed code (15-minute expiry, single-use, stored as SHA-256 hash)
