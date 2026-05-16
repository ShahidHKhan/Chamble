# Chamble
Chess + gambling game modes (for example, chess + blackjack). This repo sets up the foundation for a realtime, event-driven game platform.

## Stack (simple view)

- React + chess.js: UI and rules on the client for instant moves
- Socket.IO: realtime messenger between players (no storage)
- Redis: live game state and matchmaking queue
- Supabase (Postgres + Auth): permanent records when games finish or users change

## How data flows

1) Client validates and renders moves instantly.
2) Socket.IO relays events between players and the server.
3) Redis holds only active, in-progress game state.
4) Supabase stores completed games, users, stats, and ratings.

## Repo structure

- client: React app
- server: Node.js + Express + Socket.IO
- shared: shared types, constants, and utilities
- infra: deployment and service configs (Redis, Supabase, etc.)
