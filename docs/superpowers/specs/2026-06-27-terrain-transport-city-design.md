# Communion: Terrain, Transport, Resource-Gated Building, and City Zoom

Date: 2026-06-27
Status: Design (awaiting implementation plan)
Scope owner: visuals + simulation engine integration

## 1. Problem

The live globe view lets civilian cohorts and delegates move in straight diagonal
lines that cross open water as if it were land. There is no concept of roads,
rail, ships, or aircraft, so movement ignores terrain entirely. Construction
progresses without a hard materials/money constraint. There is no way to inspect
a single city up close. Citizens are not consistently colored by nation, move
diagonally, and have no thought bubbles.

This design adds, in four sequenced slices:

1. Terrain-aware passability + a transport network + constrained, non-diagonal
   movement + route/vehicle rendering. (Headline fix.)
2. Resource-gated construction with a real bill of materials.
3. A SimCity-style city-zoom scene with institutional & service buildings.
4. Society systems: institutions, regulations (guns/weapons/drugs), crime,
   police, jails, health, education, science/tech, ideology variants -
   mechanical feedback loops.
5. Citizen inspector ("civilian space"): representative sampled individuals with
   wants/needs/thoughts/likes/dislikes/satisfaction.
6. Polish (models, traffic density, panels, performance).

Each slice is shippable and verified before the next begins. (Detailed slice
sections below are numbered 3.x-8 and may use internal "Slice N" labels;
the ordered list here is the canonical build order.)

## 2. Coordinate model (existing, relied upon)

- The simulation is a 2D plane of `Vec2 { x, z }` projected onto the globe via
  `simulationPointToVector` / `lonLatToVector` (`src/lib/globe.ts`,
  `src/components/WorldScene.tsx`).
- "Land" is the union of every `NationState.territory.polygon` and every
  `NeutralTerritoryState.polygon`. Everything else in the plane is water.
- This gives an exact passability test without any new map asset.

## 3. Slice 1 - Terrain, transport network, constrained movement, vehicles

### 3.1 Terrain module (`server/terrain.ts`, new)

Pure, deterministic, no engine state mutation.

- `pointInPolygon(pt: Vec2, polygon: Vec2[]): boolean` - ray casting.
- `landPolygons(world): Vec2[][]` - collect nation + neutral polygons once per call.
- `isLand(pt: Vec2, polys: Vec2[][]): boolean`.
- `segmentOnLand(a: Vec2, b: Vec2, polys, samples = 24): boolean` - true only if
  every sampled point along the segment is land. Used to decide whether a
  road/rail corridor is physically possible.
- `isCoastal(pt: Vec2, polys, probe = 1.4): boolean` - land point with at least
  one water sample within `probe` radius. Used to decide where ports can exist.

### 3.2 Types (`src/lib/types.ts`)

```ts
export type TransportKind = 'road' | 'rail' | 'sea' | 'air';

export interface TransportLink {
  id: string;
  scope: 'nation' | 'international';
  ownerNationId?: string;          // undefined for international sea/air lanes
  kind: TransportKind;
  fromSettlementId: string;
  toSettlementId: string;
  waypoints: Vec2[];               // land-hugging / lane geometry; never diagonal across water
  built: boolean;                  // false while under construction
  progress: number;                // 0..100 construction progress
  capacity: number;                // cohorts/turn it can carry
  condition: number;               // 0..100 wear
}
```

Additions:
- `SettlementState` gains `hasPort: boolean`, `hasAirport: boolean`,
  `hasRailHub: boolean`, `isCoastal: boolean`.
- `CivilianCohortState` gains `mode: TransportKind`, `linkId?: string`,
  `blocked: boolean`, `blockReason?: 'no-route' | 'no-materials'`.
- `WorldState` gains `transportLinks: TransportLink[]` (holds both
  nation-scoped and international links in one array for simple routing).
- `AgentActionType` gains `'build_road' | 'build_rail' | 'build_port' |
  'build_airport'`.
- `AgentActionPayload` gains optional `fromSettlementId?`, `toSettlementId?`,
  `transportKind?: TransportKind`. Note: a pre-existing unrelated field
  `settlement: 'fiat' | 'gold' | 'mixed'` already exists on the payload; the new
  `*SettlementId` fields are distinct and must not be conflated with it.

All new fields are optional-tolerant on load: `normalize`-style code defaults
them so existing persisted state and provider JSON keep validating (per
CLAUDE.md: provider output is untrusted and must not break on missing fields).

### 3.3 Routing module (`server/routing.ts`, new)

- Graph nodes = settlements (across all nations; "frontier hubs" are simply
  settlements of `kind === 'frontier'`, not a separate node concept). Edges =
  links with `built === true`.
- `findRoute(fromId, toId, links): { legs: TransportLink[] } | null` - BFS by
  fewest legs, deterministic tie-break by link id. Returns null when no built
  path exists.
- Mode of each leg is the link's `kind`. A cohort's displayed `mode` is the mode
  of its current leg.

### 3.4 Engine wiring (`server/world.ts`)

- On world init/normalize: auto-create `road` links between same-nation
  settlement pairs whose corridor `segmentOnLand` is true (waypoints = straight
  land segment, subdivided). Mark `built: true` for these starter roads so the
  world is not frozen on first load. Compute `isCoastal` / `hasPort` etc.
  Intended initial behavior: water-separated nation pairs get **no** auto starter
  `sea`/`air` link - inter-nation/over-water travel requires an agent to build a
  port (then a sea lane) or an airport first. The slice-1 blocked-cohort test
  depends on this; it is intended, not a bug.
- Replace the straight-line cohort interpolation (`retargetCivilianCohort` /
  `pointBetween` usage around `world.ts:1261`) with link-following movement:
  - When a cohort needs to travel from A to B, call `findRoute`.
  - If a route exists, set `cohort.linkId`/`mode` and advance `cohort.position`
    along the current leg's `waypoints` (piecewise-linear; never a diagonal
    over-water hop). At a leg end, advance to the next leg.
  - If no route exists, set `blocked: true`, `blockReason: 'no-route'`, hold the
    cohort at the origin/coast, and raise `stress`. The owning delegate gains a
    `build_*` action opportunity.
- Conservation/determinism: keep existing gold and population conservation
  intact; routing/movement must not create or destroy represented population.

### 3.5 Rendering (`src/components/WorldScene.tsx` + new layers)

- `TransportNetworkLayer` - render each built link by kind:
  - road: solid land-hugging line following `waypoints`.
  - rail: line with periodic tie cross-marks.
  - sea: dashed lane that bows over water between two ports.
  - air: high great-arc between two airports.
  Under-construction links render faded.
- `VehicleLayer` - for each moving cohort, place an animated CC0 glTF vehicle at
  `cohort.position` oriented along its current leg: car/truck on road, train on
  rail, ship on sea, plane (raised altitude) on air. Vehicle tinted by the
  owning nation's color.
- Blocked cohorts render a small "needs transport" marker at the coast instead
  of a vehicle.
- Citizen/cohort/delegate coloring: always derive primary tint from
  `nation.color` (secondary accents allowed) so every person is readable as
  belonging to their country.
- Non-diagonal rule: cohorts only ever sit on `waypoints` geometry, which hugs
  land/lanes - there is no diagonal free-floating movement. (City-grid
  non-diagonal movement is handled in Slice 3.)
- Thought bubbles: render an `Html` bubble above each delegate showing
  `delegate.currentThought` (truncated), and above active cohorts a short label
  derived from the existing `CivilianCohortState.purpose`. Bubbles billboard
  toward the camera and fade with distance.

### 3.6 Models

- Pull permissively-licensed (CC0/MIT) glTF for car, truck, train, ship, plane
  from open repos (e.g. Kenney, Quaternius). Commit under
  `public/models/transport/` with a `LICENSE`/attribution note. Load via the
  existing drei/three glTF loader pattern used by `GltfHuman.tsx`. If a model
  cannot be obtained, fall back to a clearly-shaped procedural mesh for that
  vehicle (documented, not silent).

### 3.7 Slice 1 tests (`server/tests/engine.test.ts`)

Deterministic additions:
- `segmentOnLand` true for an intra-nation segment, false for a segment crossing
  the inter-nation water gap.
- `findRoute` returns null between two settlements separated by water with no
  port; returns a route once a built `sea` link + ports exist.
- A cohort with no route is `blocked` with `blockReason: 'no-route'` and does not
  change position across a tick.

## 4. Slice 2 - Resource-gated construction

### 4.1 Bill of materials

A single source-of-truth cost table (`server/build-costs.ts`, new), e.g.:

| Build       | money | trees | stone | sand | gold |
|-------------|-------|-------|-------|------|------|
| road        | yes   |       | yes   |      |      |
| rail        | yes   |       | yes   |      | yes  |
| port        | yes   | yes   | yes   |      |      |
| airport     | yes   |       | yes   | yes  | yes  |
| building    | yes   | yes   | yes   |      |      |

(Exact numeric amounts decided in the implementation plan; the table is the
contract.) Costs scale with link length / settlement size. The plan must pin a
single explicit scaling formula (e.g. `cost = base * (1 + lengthUnits * k)` for
links and `cost = base * (1 + builtArea/100)` for settlement builds) so the
curve is unambiguous and deterministic.

### 4.2 Engine

- `canAfford(nation, cost)` and `consume(nation, cost)` operating on
  `nation.resources` + treasury cash.
- The existing construction loop (`world.ts` ~1226) and all `build_*` actions
  only progress when affordable; otherwise the build halts, `progress` stalls,
  and the cohort/settlement is flagged `blockReason: 'no-materials'`. No silent
  default-on-shortage (per global rule 2 / 56).
- Materials are consumed incrementally as `progress` rises so a half-built link
  has consumed roughly half its bill.

### 4.3 Slice 2 tests

- Construction does not advance when a required material is zero; advances when
  topped up. Resource totals strictly decrease by the consumed amount (no
  creation).

## 5. Slice 3 - City zoom (SimCity-style)

### 5.1 Entry / exit

- App-level state `selectedCityId: string | null`. Clicking a city marker in
  `CityLayer` sets it. A back control clears it.
- When set, render `CityScene` (`src/components/CityScene.tsx`, new) in place of
  (or overlaying) the globe canvas. Globe state keeps ticking underneath.

### 5.2 Scene

- Procedural grid generated deterministically from the settlement's stats
  (`population`, `builtArea`, `industry`, `services`, `housing`,
  `infrastructure`). Grid size scales with `builtArea`.
- Zoned blocks: residential / commercial / industrial, color-coded, building
  height scaled by density. Road grid between blocks. Port district if
  `hasPort`, airport pad if `hasAirport`, rail station if `hasRailHub`.
- Institutional & service buildings, placed deterministically and scaled by the
  relevant stat, each a distinct recognizable model/silhouette:
  - housing (residential), stores/markets (commercial), factories/offices (jobs),
  - schools + universities/research labs (education + science/tech),
  - hospitals/clinics (health), police stations, jails/prisons, courthouses,
  - military bases, government/parliament, central bank/treasury, utilities,
    places of worship, media.
  Each building type maps to an existing `InstitutionKind` or city stat so the
  count/size is data-driven, not arbitrary.
- Citizens: small capsules tinted by nation color, walking **only along the road
  grid in cardinal directions (no diagonals)**, with thought bubbles over heads.
- Vehicles: cars along the grid roads (cardinal turns only).
- A side panel shows the city's resource stockpiles, build queue, and what is
  blocked for lack of materials (ties to Slice 2).

### 5.3 Slice 3 verification

- Manual: run app, click a city, confirm dive-in, grid renders, citizens move
  non-diagonally, back returns to globe. (Rendering verified via screenshots,
  not unit tests.)

## 5.4 SimWorld reference note

`SimWorld-AI/SimWorld` (reviewed 2026-06-27) is an Unreal-Engine-5 embodied-AI
agent platform, NOT a society/economy simulator. It does not model citizens'
needs, institutions, crime, drugs, or regulations. Reusable concepts borrowed:
config-driven module behavior, waypoint-based navigation (aligns with our
transport `waypoints`), procedural city generation, and a basic traffic system.
The society/institution model below is built on Communion's existing engine
(`InstitutionState`, `EconomyState`, `SocialState`, `SecurityState`, `policy`),
not ported from SimWorld.

## 6. Slice 5 - Society, institutions, regulations, ideology (mechanical)

Builds real feedback loops on top of existing engine state. Phased: data +
levers first, then the loops that consume them.

### 6.1 New / extended metrics

Extend `SocialState` (or a new `SocietyState`) with deterministic 0..100 metrics,
tracked per nation and surfaceable per settlement:
`crimeRate`, `incarceration`, `policing`, `drugPrevalence`, `addiction`,
`publicHealth` (distinct from existing `health`), `educationAttainment`,
`scienceTech`, `employment` (vs existing `unemployment`), `socialCohesion`,
`inequality` (exists in economy), `civilUnrest`. Reuse existing fields where they
already exist rather than duplicating.

### 6.2 Regulations as policy levers

Add typed policy levers in `nation.policy` with explicit enumerations:
- `gunRegulation`: `'unrestricted' | 'licensed' | 'restricted' | 'banned'`
- `weaponRegulation` (heavy/military-grade civilian access): same scale
- `drugPolicy`: `'prohibition' | 'decriminalized' | 'legal-regulated'`
- `policingLevel`: `'minimal' | 'standard' | 'heavy'`
- plus funding sliders: `educationFunding`, `healthFunding`, `scienceFunding`,
  `welfareFunding` (each consumes treasury cash via the Slice-2 materials/money
  gate).
New agent action types: `set_regulation`, `set_funding` (validated, bounded).

### 6.3 Feedback loops (engine, deterministic)

Each tick, bounded adjustments (all clamped 0..100, no runaway), e.g.:
- higher `policing` + heavy `policingLevel` -> lower `crimeRate`, higher
  `incarceration`, possible `civilLiberties`/`civilUnrest` cost.
- `drugPolicy` shifts `drugPrevalence`/`addiction`/`crimeRate`/`publicHealth`
  along a documented curve (prohibition: higher crime, lower prevalence ceiling;
  legal-regulated: higher prevalence, lower crime, tax revenue).
- `educationFunding` -> `educationAttainment` -> `scienceTech` -> productivity.
- `healthFunding` -> `publicHealth` -> population/approval.
- `gunRegulation`/`weaponRegulation` affect `crimeRate` severity + `civilUnrest`.
- unemployment/inequality raise `crimeRate`/`civilUnrest`.
All curves live in one documented module (`server/society.ts`) so they are
auditable and testable; no silent default-on-shortage (global rule 2/56).

### 6.4 Delegate ideology variants

`DelegateState` (or `NationState`) gains `ideology` variant typing:
`'capitalist' | 'socialist' | 'communist' | 'social-democratic' |
'libertarian' | 'nationalist' | 'technocratic'` (extends existing free-text
`nation.ideology`). Ideology biases a delegate's action priors (tax rate,
funding split, regulation defaults, trade vs. state control) inside the existing
mock/provider decision path - it does not grant any new authority beyond the
fictional state machine (CLAUDE.md bounded autonomy).

### 6.5 Slice 5 tests

- Each regulation/funding lever moves its target metric in the documented
  direction and stays clamped; opposing levers cancel deterministically; revenue
  and treasury cash conserve.

## 7. Slice 6 - Citizen inspector ("civilian space")

Representative sampled citizens (per the chosen model): citizens remain aggregate
cohorts; clicking a citizen/cohort (on the globe or in the city scene) opens an
inspector panel showing a **deterministically generated representative
individual** derived from local stats + a stable seed (cohort id + index):
name, age, household, job (from local employment/industry mix), home district,
and psychographics: `wants`, `needs`, `likes`, `dislikes`, current `thought`
(also shown as the over-head bubble), and a satisfaction breakdown driven by the
Slice-5 metrics (safety, jobs, health, education, liberty, cost of living).
No persistent per-citizen state; regenerating from the same seed is identical.

### Slice 6 verification

- Deterministic: same seed -> identical generated citizen. Manual: click a
  citizen, panel shows coherent wants/needs/thoughts tied to local conditions.

## 8. Slice 7 - Polish

- More building/vehicle model variety, traffic density tied to population,
  refined panels and labels, performance pass (instancing for citizens/vehicles).

## 9. Cross-cutting constraints

- Bounded autonomy (CLAUDE.md): all new actions stay inside the fictional state
  machine; no shell/network/world authority.
- Determinism: engine stays seed-deterministic; tests via `npm test`.
- Untrusted provider JSON: new action types validate against schema before
  mutating state; missing fields default safely.
- Preserve existing frontend; new layers are additive, not rewrites of
  `WorldScene` / `App`.
- Gates before "done": `npm run check`, `npm test`, `npm run build`.

## 10. Non-goals (YAGNI)

- No real-world geography import beyond the existing Natural Earth cartography.
- No multiplayer, no networked asset streaming.
- No persistent per-citizen agent AI; citizens are aggregate cohorts, with
  representative individuals generated deterministically on inspection.
- No economic rewrite beyond the materials gate, transport build costs, and the
  Slice-5 society feedback loops.
- Not porting SimWorld's UE5 engine; only borrowing the patterns noted in 5.4.
