# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is
Communion is a contained multi-model civilization simulator: an authoritative server-side
simulation engine plus a 3D React/Three.js dashboard. AI "delegates" (OpenAI / xAI / Anthropic /
Google, with a deterministic offline fallback) drive nations through diplomacy, economics
(dual fiat + gold currency), and bounded conflict. The entire world is one `WorldState` snapshot
the server owns and the client renders.

## Repository state (read first)
- The working code is on branch `workbench/validation`. `main` currently holds only a README.
- `package.json` scripts (`dev`, `start`, `test`) reference `server/index.ts` and
  `server/tests/*.test.ts`, which DO NOT yet exist in the repo. Until the Express backend is
  added, `npm run dev`, `npm start`, and `npm test` fail. The frontend typechecks via
  `npm run check` and builds via the `vite build` half of `npm run build`.

## Commands
- `npm run check`  - `tsc --noEmit` typecheck (works today)
- `npm run build`  - `tsc --noEmit && vite build` (frontend builds; needs server for full app)
- `npm run dev`    - concurrently runs `tsx watch server/index.ts` + Vite (needs server/)
- `npm start`      - `tsx server/index.ts` (needs server/)
- `npm test`       - `node --import tsx --test server/tests/*.test.ts` (needs server/tests/)
- Run a single test: `node --import tsx --test server/tests/<name>.test.ts`
- Requires Node >= 20. Project is ESM (`"type": "module"`).

## Architecture
- **WorldState is the contract.** `src/lib/types.ts` defines the entire snapshot (delegates,
  nations, relations, proposals, messages, wars, global market, turn/year). The server mutates it;
  the client only reads it and posts intents. Keep server and client on the same `WorldState` shape.
- **API** (`src/lib/api.ts`): `GET /api/state`; `POST /api/control {action, speed?}`;
  `POST /api/scenario {scenario}`; `POST /api/prompt {text}`. Responses are `{ok, state}`.
  The client polls `/api/state` (no SSE).
- **Dev proxy**: Vite (port 5173) proxies `/api` to the Express server on
  `http://localhost:8787` (see `vite.config.ts`). Validate request/response bodies with `zod`.
- **Rendering** (`src/components/`): `WorldScene`/`WorldMap` render the 3D world via
  `@react-three/fiber` + `drei`; `Humanoid` is the articulated delegate; panel components render
  nation/economy/conflict/activity dashboards from `WorldState`.
- **Domain notes**: economy splits `FiatCurrencyState` (expandable, drives inflation/debt) from
  `GoldState` (conserved stock); `WarState` gates extreme actions behind `CatastrophicReview` /
  `CatastrophicForecast`; `InstitutionState` covers 16 institution kinds; delegate actions are
  the 21-variant `AgentActionPayload`; `ProviderId` is `'openai'|'xai'|'anthropic'|'google'`.

## Conventions
- ESM + TypeScript strict; no secrets in code - providers are configured via `.env`
  (see `.env.example`).
- The simulation must stay deterministic when no live provider is configured (offline fallback).
