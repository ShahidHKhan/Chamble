# Chamble

Chess + Gamble. A real-time multiplayer chess platform with game variants: **Chess-21** (blackjack captures), **Chess-Matics** (math challenges on captures), and **Chess-Roulette** (wheel-based piece selection).

Built as a pnpm monorepo with Turbo.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, React Router, Vite, TypeScript |
| Chess | chess.js (rules engine), react-chessboard (UI) |
| Real-time | Socket.IO (client + server) |
| Backend | Express 5, Node.js, TypeScript |
| Auth | bcrypt + custom JWTs |
| Monorepo | Turbo 2, pnpm 11 |

## External Services

### Supabase
**What it does:** Hosts the PostgreSQL database.
**Stores:** Users, matches, friendships, password reset tokens.
**Dashboard:** https://supabase.com

Required env vars:
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

### Resend
**What it does:** Sends transactional emails (password reset codes).
**Dashboard:** https://resend.com

Required env vars:
```
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@chamble.net
```

### Cloudflare
**What it does:** Domain registrar and DNS management for `chamble.net`. DNS records are configured here so Resend can send email from `@chamble.net` addresses.
**Dashboard:** https://dash.cloudflare.com

## Repo Structure

```
Chamble/
├── apps/
│   ├── web/            # React frontend
│   └── server/         # Express + Socket.IO backend
├── packages/
│   └── shared/         # Shared types and Socket.IO event constants
├── turbo.json
└── package.json
```

## Routes

| Route | Page |
|---|---|
| `/` | Login |
| `/register` | Create account |
| `/forgot-password` | Password reset |
| `/home` | Dashboard |
| `/games` | Browse game modes |
| `/games/chess21` | Chess-21 lobby |
| `/games/chessmatics` | Chess-Matics lobby |
| `/games/chessroulette` | Chess-Roulette lobby |
| `/play` | Live game |
| `/profile` | Stats, match history, friends |

## Running Locally

**Prerequisites:** Node.js, pnpm

```bash
pnpm install
pnpm dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3001 |

## Environment Variables

`apps/server/.env`:
```
PORT=3001
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
- Password reset via 6-digit emailed code (15-minute expiry, single-use, stored as SHA-256 hash)
