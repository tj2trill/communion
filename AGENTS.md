# Repository Guidelines

## Project Structure & Module Organization

Communion is a TypeScript simulation app with a stateful backend engine and a 3D browser dashboard. Keep simulation logic, world state, and invariants in backend engine modules, with provider routing, persistence, audit logs, and API/SSE delivery isolated from UI code. Keep dashboard rendering, inspectors, maps, and overlays in client modules. Place deterministic engine tests near the engine or under a dedicated `tests/` directory, and keep static assets such as map textures, icons, and WebGL resources under client asset folders.

## Build, Test, and Development Commands

Use the npm scripts defined in `package.json` as the source of truth. Expected commands:

- `npm install`: install dependencies from the lockfile.
- `npm run dev`: start the local development server.
- `npm run check`: run strict TypeScript validation.
- `npm test`: run deterministic engine and integration tests.
- `npm run build`: build client and server production bundles.

Before merging, run `npm run check`, `npm test`, and `npm run build`. If API smoke scripts exist, run them after the server build.

## Coding Style & Naming Conventions

Use TypeScript with strict types and explicit domain models for countries, societies, currencies, treaties, conflicts, and audit events. Prefer pure deterministic functions for simulation resolution so scenarios can be replayed in tests. Use two-space indentation, `camelCase` for functions and variables, `PascalCase` for classes and React-style components, and descriptive filenames such as `currencyEngine.ts` or `WorldDashboard.tsx`.

## Testing Guidelines

Prioritize regression tests for simulation invariants: conserved gold, fiat stock-and-flow behavior, treaty resolution, sanctions, conflict consequences, authorization gates, persistence migration, and provider fallbacks. Test names should describe the invariant, for example `conserves global gold during trade settlement`. Keep tests deterministic by avoiding live provider calls unless explicitly mocked.

## Commit & Pull Request Guidelines

Use concise, imperative commit messages such as `Add dual-currency settlement engine`. Pull requests should include a summary, validation commands run, linked issues if applicable, and screenshots or short clips for dashboard changes. Note any schema migrations, new environment variables, or changes to simulation invariants.

## Security & Configuration Tips

Never commit provider API keys, audit databases, generated state files, or local `.env` files. Keep destructive or catastrophic simulation actions behind explicit authorization checks and preserve audit logs for every state-changing request.
