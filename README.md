# Chamble
Recreation of Chess21.

## Scaffold

- client: Vite + React + TypeScript
- server: Express + Socket.IO
- shared types are duplicated in client/server for now

## Quick Start

1) Install dependencies in each workspace
2) Run both dev servers

```
npm install
npm run dev
```

## Scripts

- `npm run dev` runs client + server
- `npm run dev:client` runs the Vite client only
- `npm run dev:server` runs the Socket.IO server only
- `npm run typecheck` runs both type checks
