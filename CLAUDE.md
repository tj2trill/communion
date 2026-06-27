# CLAUDE.md

This file gives Claude Code repository-specific guidance. The current `main`
branch is the integrated app: do not assume the backend is missing, and do not
replace the frontend with older branch work.

## Collaboration Rules

- Preserve existing frontend work unless an integration bug requires a small,
  targeted edit. Prefer backend/runtime changes when bringing the simulation to
  life.
- Before editing React, Three.js, CSS, textures, or model assets, inspect
  `git diff`, `git status`, and the relevant component. Avoid wholesale rewrites
  of `src/App.tsx`, `src/components/WorldScene.tsx`, `src/styles-*`, or
  `public/`.
- Branch `visuals/3d-models` contains older visual experiments. Cherry-pick
  ideas only when needed; do not merge it wholesale because it removes the
  server implementation and current data assets.
- Keep AI autonomy bounded to the fictional simulation state machine. Models can
  choose simulated civic actions, but they must not gain shell, browser,
  account, infrastructure, weapons, or external-world authority.

## Architecture

- `server/world.ts`: authoritative world engine, economy, diplomacy, conflict,
  free-land claims, gold conservation, scheduling, and deterministic test path.
- `server/providers.ts`: live provider adapters for OpenAI, xAI, Anthropic, and
  Gemini. Provider output is untrusted JSON and must pass schema validation
  before mutating state.
- `server/index.ts`: Express API, SSE stream, persistence, audit, and run loop.
- `src/lib/types.ts`: shared `WorldState` contract between server and client.
- `src/components/`: React/Three.js dashboard, globe, flags, delegates, panels,
  and selected-country drilldown.
- `public/`: checked-in runtime assets, including Earth textures and rigged
  model files.

## Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run check`: strict TypeScript validation.
- `npm test`: deterministic engine and provider-safety tests.
- `npm run build`: type-check and production client build.
- `npm run dev`: start server and Vite client for development.
- `npm start`: serve the production build and API from port `8787`.

Run `npm run check`, `npm test`, and `npm run build` before claiming the app is
ready.

## Runtime Notes

- `COMMUNION_MODE=live` is strict: configured providers run as the actual model;
  missing or failed providers are visibly blocked instead of mocked.
- `COMMUNION_MODE=hybrid` allows configured providers to run live while missing
  providers use deterministic fallback.
- `COMMUNION_MODE=mock` is for offline tests and development only.
- Provider keys stay in `.env`; never commit secrets or generated state.
- Internal `turn` fields are audit/event counters. User-facing behavior should
  be treated as continuous live flow, not fixed round-robin turns.
