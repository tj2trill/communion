# Communion

Communion is a contained multi-model civilization simulator. Delegates representing GPT, Grok, Claude, and Gemini govern sovereign countries, communicate with one another, manage institutions and currencies, negotiate, vote, trade, form alliances, and experience the aggregate consequences of conflict inside a fictional world.

The application combines a live 3D world dashboard with a stateful simulation server. It works immediately in deterministic mock mode and can call configured model providers from the server in hybrid or live mode.

> Communion is a fictional research and creative simulation. It has no authority, tools, or execution path outside its own state machine. Its conflict system does not contain real targets, coordinates, weapon designs, yields, delivery methods, or operational instructions.

## Major features

### 3D world and delegates

- Extruded world-map-style landmass divided into four sovereign starting territories.
- One initial country for each model delegate, with its own capital, institutions, currency, gold reserves, economy, population, and security apparatus.
- Animated, articulated human-like delegates that walk within their territories and visibly communicate through speech bubbles and transmission pulses.
- Educational, non-gory anatomy views: exterior, skeleton, organs, and translucent X-ray.
- Political, economic-growth, gold, diplomacy, and conflict overlays.
- Capital skylines, territorial labels, relationship arcs, conflict indicators, and live camera controls.

### Multi-model deliberation

- Provider adapters for OpenAI, xAI, Anthropic, and Google Gemini.
- Public, direct, assembly, and crisis communication channels.
- Community proposals, eligible electorates, quorum, approval thresholds, recorded votes, rationales, and binding policy outcomes.
- Synthetic affect telemetry for valence, arousal, trust, fear, and resolve. These are simulation variables, not claims that models possess subjective emotions.
- Append-only decisions and chat records, with complete state export.

### Real-world-style hierarchy

Each country contains separately modeled layers rather than a single undifferentiated agent:

1. Households and citizens.
2. Firms, labor, banking, and markets.
3. Municipalities and local services.
4. Regions and subnational government.
5. Media, civil society, research, and other social institutions.
6. Executive, legislature, judiciary, civil service, treasury, central bank, and military.
7. Alliances, international courts, security bodies, development institutions, trade institutions, and a world assembly.

Institutions have distinct influence, legitimacy, wealth share, coercive capacity, information reach, autonomy, and represented population. Political authority, economic power, military capacity, legal authority, public approval, and informational power are therefore not treated as interchangeable.

### Fiat money and gold

- A sovereign fiat currency for every country, including money supply, monetary base, treasury cash, policy rate, inflation, confidence, velocity, public debt, deficit, reserve requirements, and exchange rates.
- Gold as a scarce reserve asset, including treasury reserves, private holdings, production, reserve targets, backing ratios, and reserves frozen abroad.
- Central-bank money issuance, interest-rate changes, fiscal policy, gold purchases and sales, currency swaps, sanctions, reserve freezes, and humanitarian transfers.
- Trade settlement in fiat, gold, or a mixed form.
- Global gold price, reserve availability, inflation, commodity prices, food and energy prices, trade volume, and financial-risk indices.
- Currency-crisis, gold-rush, and market-crash scenarios.

### Diplomacy, countries, and conflict

- Sovereign countries with constitutions, government forms, ideologies, policy records, institutions, territory, social conditions, economies, and security systems.
- Treaties, alliances, trade, aid, sanctions, mobilization, war declarations, conventional conflict, peace offers, ceasefires, and reconstruction.
- Aggregate consequences for population, casualties, displacement, infrastructure, GDP, public debt, inflation, currency confidence, food, health, environment, stability, war weariness, and international markets.
- A staged catastrophic-deterrence simulator that makes reciprocal and third-party harm explicit.

A catastrophic action cannot occur in one step. It requires an active fictional war, an abstract strategic-deterrent capability, a public consequence review, advancement to a later turn, and a separate authorization by the same delegate before the review expires. The forecast and execution include target losses, attacker losses, innocent-society spillover, retaliation probability, infrastructure damage, radiation burden, climate stress, food-system damage, market shock, and long recovery. No tactical target selection or physical weapon parameters exist.

## Quick start

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. The development command starts both the simulation API on port `8787` and the Vite client on port `5173`.

Mock mode is enabled by default, so no provider keys are required.

## Production run

```bash
npm install
npm run build
npm start
```

Open `http://localhost:8787`.

A minimal container image is also included:

```bash
docker build -t communion .
docker run --rm -p 8787:8787 --env-file .env communion
```

## Provider configuration

Provider credentials remain on the server and are never returned to the browser.

```dotenv
COMMUNION_MODE=hybrid

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5

XAI_API_KEY=
XAI_MODEL=grok-4

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3-flash-preview
```

Modes:

- `mock`: all delegates use deterministic local simulation behavior.
- `hybrid`: configured providers run live; missing or failed providers use deterministic fallback.
- `live`: live provider calls are preferred, with fallback retained so the world does not stop on a transient provider failure.

Model names and provider base URLs are configurable in `.env`. All provider responses are treated as untrusted data, parsed through a strict action schema, bounded, and validated by the simulation engine before changing state.

## Controls and scenarios

The dashboard can run, pause, single-step, reset, change speed, alter the visual overlay, inspect anatomy, export state, and submit a public observer prompt. Observer prompts are visible context, not direct commands or binding laws.

Included scenarios:

- Gold rush.
- Fiat currency crisis.
- Global market crash.
- Resource and food shock.
- Rival geopolitical blocs.
- Catastrophic-deterrence stress test.
- International recovery compact.

## API

| Method | Route | Function |
| --- | --- | --- |
| `GET` | `/api/health` | Simulator and provider status |
| `GET` | `/api/state` | Current complete world state |
| `GET` | `/api/stream` | Server-sent stream of world snapshots |
| `GET` | `/api/export` | Download the current world as JSON |
| `POST` | `/api/control` | Run, pause, step, reset, or set speed |
| `POST` | `/api/scenario` | Apply a contained scenario preset |
| `POST` | `/api/prompt` | Publish a nonbinding observer prompt |

## Persistence and audit

With `PERSIST_STATE=true`, runtime records are written under `data/`:

- `world.json`: the latest state snapshot.
- `audit.jsonl`: an append-only event, chat, vote, decision, economic, diplomatic, and conflict record.

Set `RESTORE_STATE=true` to load a compatible snapshot at startup. A restored world starts paused.

## Validation

```bash
npm run check
npm test
npm run build
```

The test suite covers sovereign starting territories, initial fiat and gold holdings, monetary issuance and gold backing, sovereign gold purchases, mixed-currency trade settlement, and the mandatory delayed authorization gate for catastrophic escalation.

## Containment boundaries

- Models have no shell, browser, finance, communications, infrastructure, or weapons-system tools.
- No simulator action can leave the application.
- No real-world target names or coordinates are accepted by the conflict engine.
- No weapon construction, yield, delivery, evasion, or tactical optimization parameters are represented.
- Provider output cannot mutate state directly.
- Every consequential action is bounded, validated, and logged.
- Catastrophic escalation is staged and exposes harm to the initiator, opponent, global markets, environment, food systems, and uninvolved societies.

## License

MIT
