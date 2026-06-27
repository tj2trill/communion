import { Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { generateCitizen, MOOD_COLOR } from '../lib/citizen';
import { PostProcessing } from './PostProcessing';
import type { NationState, ResourceState, SettlementState } from '../lib/types';

// SimCity-style city dive-in. Procedurally and deterministically builds a gridded
// city from a settlement's stats: zoned blocks, institutional buildings, a road
// grid, traffic, and citizens that walk ONLY along the grid in cardinal
// directions (no diagonals), tinted by nation color, with thought bubbles and a
// clickable "civilian space" inspector.

interface CitySceneProps {
  settlement: SettlementState;
  nation: NationState;
  onClose: () => void;
}

type Zone = 'residential' | 'commercial' | 'industrial' | 'civic';

interface BuildingSpec {
  cx: number;
  cz: number;
  height: number;
  width: number;
  depth: number;
  color: string;
  emissive: string;
  label?: string;
  zone: Zone;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One civic/service building per institution type, scaled by the relevant stat.
const INSTITUTIONS: Array<{ label: string; color: string; stat: (s: SettlementState, n: NationState) => number }> = [
  { label: 'City Hall', color: '#e6d9a8', stat: (s) => s.infrastructure },
  { label: 'Parliament', color: '#dcc98f', stat: (_s, n) => n.social.stability },
  { label: 'Central Bank', color: '#f2e2b0', stat: (_s, n) => n.economy.bankingStability },
  { label: 'Hospital', color: '#ffd7d7', stat: (_s, n) => n.social.health },
  { label: 'Clinic', color: '#ffe3e3', stat: (_s, n) => n.social.health },
  { label: 'School', color: '#cfe9ff', stat: (_s, n) => n.social.education },
  { label: 'University', color: '#bfe0ff', stat: (_s, n) => n.social.education },
  { label: 'Research Lab', color: '#c9c2ff', stat: (_s, n) => n.economy.productivity },
  { label: 'Police HQ', color: '#9fb6e8', stat: (_s, n) => n.security.readiness },
  { label: 'Courthouse', color: '#d9d2e8', stat: (_s, n) => n.social.civilLiberties },
  { label: 'Jail', color: '#9aa0a6', stat: (_s, n) => n.security.conventionalCapacity },
  { label: 'Military Base', color: '#8d9a7e', stat: (_s, n) => n.security.conventionalCapacity },
  { label: 'Market', color: '#ffe1a8', stat: (s) => s.services },
  { label: 'Factory', color: '#b8c0c4', stat: (s) => s.industry },
  { label: 'Power Plant', color: '#c4d2c4', stat: (_s, n) => n.economy.energySecurity },
  { label: 'Temple', color: '#efe0ef', stat: (_s, n) => n.social.stability }
];

function zoneColor(zone: Zone): { color: string; emissive: string } {
  if (zone === 'residential') return { color: '#cfe4d6', emissive: '#3f7d57' };
  if (zone === 'commercial') return { color: '#cfe0ff', emissive: '#2f6bd0' };
  if (zone === 'industrial') return { color: '#c7ccce', emissive: '#7a6a3a' };
  return { color: '#e6d9a8', emissive: '#8a7a30' };
}

function buildCity(settlement: SettlementState, nation: NationState) {
  const rng = mulberry32(hashString(settlement.id));
  const grid = Math.max(5, Math.min(9, Math.round(4 + settlement.builtArea / 22)));
  const cell = 4; // world units between road centerlines
  const span = grid * cell;
  const half = span / 2;
  const center = (grid * cell) / 2 - half; // ~0

  // Candidate building cells: the interior of each grid block.
  const cells: Array<{ i: number; j: number; cx: number; cz: number; dist: number }> = [];
  for (let i = 0; i < grid; i += 1) {
    for (let j = 0; j < grid; j += 1) {
      const cx = -half + cell / 2 + i * cell;
      const cz = -half + cell / 2 + j * cell;
      const dist = Math.hypot(cx - center, cz - center);
      cells.push({ i, j, cx, cz, dist });
    }
  }
  // Shuffle deterministically for institution placement, but keep civic near center.
  const byCenter = [...cells].sort((a, b) => a.dist - b.dist);

  const buildings: BuildingSpec[] = [];
  const used = new Set<string>();
  const maxDist = Math.max(...cells.map((c) => c.dist)) || 1;

  // Place institutions in the most central free cells.
  const institutionCount = Math.min(INSTITUTIONS.length, Math.max(6, Math.round(settlement.population / 60_000_000) + 8));
  let placed = 0;
  for (const cellPos of byCenter) {
    if (placed >= institutionCount) break;
    const inst = INSTITUTIONS[placed];
    const key = `${cellPos.i}-${cellPos.j}`;
    used.add(key);
    const stat = Math.max(8, inst.stat(settlement, nation));
    buildings.push({
      cx: cellPos.cx,
      cz: cellPos.cz,
      width: 2.4,
      depth: 2.4,
      height: 1.2 + (stat / 100) * 3.4,
      color: inst.color,
      emissive: nation.color,
      label: inst.label,
      zone: 'civic'
    });
    placed += 1;
  }

  // Fill remaining cells with zoned buildings: commercial near center,
  // residential in the mid ring, industrial on the outskirts.
  for (const cellPos of cells) {
    const key = `${cellPos.i}-${cellPos.j}`;
    if (used.has(key)) continue;
    const ring = cellPos.dist / maxDist;
    const zone: Zone = ring < 0.38 ? 'commercial' : ring < 0.72 ? 'residential' : 'industrial';
    const density = zone === 'commercial' ? settlement.services : zone === 'residential' ? settlement.housing : settlement.industry;
    const palette = zoneColor(zone);
    // Up to a few small structures per block for visual density.
    const perBlock = zone === 'residential' ? 2 : 1;
    for (let b = 0; b < perBlock; b += 1) {
      const ox = (rng() - 0.5) * (cell * 0.4);
      const oz = (rng() - 0.5) * (cell * 0.4);
      buildings.push({
        cx: cellPos.cx + (perBlock > 1 ? ox : 0),
        cz: cellPos.cz + (perBlock > 1 ? oz : 0),
        width: 1.1 + rng() * 0.7,
        depth: 1.1 + rng() * 0.7,
        height: 0.6 + (density / 100) * (zone === 'commercial' ? 4.2 : zone === 'industrial' ? 1.6 : 2.4) + rng() * 0.6,
        color: palette.color,
        emissive: palette.emissive,
        zone
      });
    }
  }

  return { grid, cell, half, buildings };
}

function Buildings({ buildings, onSelectBuilding }: { buildings: BuildingSpec[]; onSelectBuilding: (label: string) => void }) {
  return (
    <>
      {buildings.map((building, index) => (
        <group key={index} position={[building.cx, 0, building.cz]}>
          <mesh position={[0, building.height / 2, 0]} castShadow receiveShadow onClick={(event) => { event.stopPropagation(); if (building.label) onSelectBuilding(building.label); }}>
            <boxGeometry args={[building.width, building.height, building.depth]} />
            <meshStandardMaterial color={building.color} emissive={building.emissive} emissiveIntensity={building.label ? 0.22 : 0.08} roughness={0.62} metalness={0.08} />
          </mesh>
          {building.label && (
            <Html center position={[0, building.height + 0.7, 0]} distanceFactor={26} className="city-html">
              <div className="city-building-tag">{building.label}</div>
            </Html>
          )}
        </group>
      ))}
    </>
  );
}

function RoadGrid({ grid, cell, half }: { grid: number; cell: number; half: number }) {
  const lines = [];
  for (let i = 0; i <= grid; i += 1) {
    const p = -half + i * cell;
    lines.push(
      <mesh key={`h-${i}`} position={[0, 0.02, p]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[grid * cell, 0.9]} />
        <meshStandardMaterial color="#2a2f36" roughness={0.95} />
      </mesh>,
      <mesh key={`v-${i}`} position={[p, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[0.9, grid * cell]} />
        <meshStandardMaterial color="#2a2f36" roughness={0.95} />
      </mesh>
    );
  }
  return <>{lines}</>;
}

interface Walker {
  i: number;
  j: number;
  ti: number;
  tj: number;
  t: number;
  speed: number;
  rng: () => number;
  index: number;
}

function makeWalkers(grid: number, count: number, salt: number, speedBase: number): Walker[] {
  const rng = mulberry32(0xabcdef ^ (grid * 131) ^ (salt * 977));
  return Array.from({ length: count }, (_, index) => {
    const i = Math.floor(rng() * (grid + 1));
    const j = Math.floor(rng() * (grid + 1));
    const horizontal = rng() > 0.5;
    return {
      i,
      j,
      ti: horizontal ? Math.min(grid, i + 1) : i,
      tj: horizontal ? j : Math.min(grid, j + 1),
      t: rng(),
      speed: speedBase * (0.7 + rng() * 0.6),
      rng: mulberry32(0x1234 ^ (index * 7919) ^ salt),
      index
    };
  });
}

function stepWalker(walker: Walker, grid: number, delta: number) {
  walker.t += walker.speed * delta;
  while (walker.t >= 1) {
    walker.t -= 1;
    // Arrived at target node; choose next neighbor (cardinal only, prefer forward).
    const fromI = walker.ti;
    const fromJ = walker.tj;
    const di = walker.ti - walker.i;
    const dj = walker.tj - walker.j;
    const options: Array<[number, number]> = [];
    if (fromI + 1 <= grid) options.push([fromI + 1, fromJ]);
    if (fromI - 1 >= 0) options.push([fromI - 1, fromJ]);
    if (fromJ + 1 <= grid) options.push([fromI, fromJ + 1]);
    if (fromJ - 1 >= 0) options.push([fromI, fromJ - 1]);
    const back: [number, number] = [fromI - di, fromJ - dj];
    const forward = options.filter(([oi, oj]) => !(oi === back[0] && oj === back[1]));
    const pool = forward.length ? forward : options;
    const next = pool[Math.floor(walker.rng() * pool.length)];
    walker.i = fromI;
    walker.j = fromJ;
    walker.ti = next[0];
    walker.tj = next[1];
  }
}

function nodePos(i: number, j: number, cell: number, half: number): [number, number] {
  return [-half + i * cell, -half + j * cell];
}

function Citizens({
  grid,
  cell,
  half,
  count,
  color,
  settlement,
  nation,
  onInspect
}: {
  grid: number;
  cell: number;
  half: number;
  count: number;
  color: string;
  settlement: SettlementState;
  nation: NationState;
  onInspect: (index: number) => void;
}) {
  const walkers = useMemo(() => makeWalkers(grid, count, 11, 0.5), [grid, count]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const bubbleEvery = Math.max(5, Math.floor(count / 5));

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    walkers.forEach((walker, index) => {
      stepWalker(walker, grid, dt);
      const [ax, az] = nodePos(walker.i, walker.j, cell, half);
      const [bx, bz] = nodePos(walker.ti, walker.tj, cell, half);
      const offset = 0.45; // walk on the sidewalk, not the centerline
      const perpX = walker.tj !== walker.j ? offset : 0;
      const perpZ = walker.ti !== walker.i ? offset : 0;
      const group = refs.current[index];
      if (group) {
        // Gentle walk bob keyed to stride progress so the crowd reads as alive.
        const bob = Math.abs(Math.sin(walker.t * Math.PI * 2 + index)) * 0.05;
        group.position.set(ax + (bx - ax) * walker.t + perpX, 0.18 + bob, az + (bz - az) * walker.t + perpZ);
        group.rotation.y = Math.atan2(bx - ax, bz - az);
      }
    });
  });

  return (
    <>
      {walkers.map((walker, index) => {
        const featured = index % bubbleEvery === 0;
        const citizen = featured ? generateCitizen(settlement, nation, index) : null;
        // Slight per-citizen shirt-tone variation so the crowd is not uniform.
        const shirt = index % 3 === 0 ? color : index % 3 === 1 ? nation.color : '#e7eef0';
        const moodEmissive = citizen ? MOOD_COLOR[citizen.mood] : color;
        return (
          <group key={index} ref={(node) => (refs.current[index] = node)} onClick={(event) => { event.stopPropagation(); onInspect(index); }}>
            {/* Legs */}
            <mesh position={[-0.06, 0.1, 0]} castShadow>
              <capsuleGeometry args={[0.05, 0.16, 3, 6]} />
              <meshStandardMaterial color="#2c3a42" roughness={0.8} />
            </mesh>
            <mesh position={[0.06, 0.1, 0]} castShadow>
              <capsuleGeometry args={[0.05, 0.16, 3, 6]} />
              <meshStandardMaterial color="#2c3a42" roughness={0.8} />
            </mesh>
            {/* Torso */}
            <mesh position={[0, 0.34, 0]} castShadow>
              <capsuleGeometry args={[0.1, 0.2, 4, 8]} />
              <meshStandardMaterial color={shirt} emissive={moodEmissive} emissiveIntensity={citizen ? 0.42 : 0.12} roughness={0.62} />
            </mesh>
            {/* Head */}
            <mesh position={[0, 0.56, 0]} castShadow>
              <sphereGeometry args={[0.082, 10, 8]} />
              <meshStandardMaterial color="#c99b7b" roughness={0.7} />
            </mesh>
            {citizen && (
              <Html center position={[0, 0.95, 0]} distanceFactor={20} className="city-html">
                <div className="city-thought">{citizen.thought}</div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

function Cars({ grid, cell, half, count, color }: { grid: number; cell: number; half: number; count: number; color: string }) {
  const walkers = useMemo(() => makeWalkers(grid, count, 29, 1.1), [grid, count]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    walkers.forEach((walker, index) => {
      stepWalker(walker, grid, dt);
      const [ax, az] = nodePos(walker.i, walker.j, cell, half);
      const [bx, bz] = nodePos(walker.ti, walker.tj, cell, half);
      const group = refs.current[index];
      if (group) {
        group.position.set(ax + (bx - ax) * walker.t, 0.12, az + (bz - az) * walker.t);
        group.rotation.y = Math.atan2(bx - ax, bz - az);
      }
    });
  });
  return (
    <>
      {walkers.map((_, index) => (
        <group key={index} ref={(node) => (refs.current[index] = node)}>
          <mesh castShadow>
            <boxGeometry args={[0.28, 0.16, 0.5]} />
            <meshStandardMaterial color={index % 3 === 0 ? color : '#e8eef0'} emissive={color} emissiveIntensity={0.18} roughness={0.5} metalness={0.2} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function resourceRow(label: string, value: number) {
  return (
    <div className="city-res-row" key={label}>
      <span>{label}</span>
      <div className="city-res-bar"><i style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>
      <b>{Math.round(value)}</b>
    </div>
  );
}

export function CityScene({ settlement, nation, onClose }: CitySceneProps) {
  const { grid, cell, half, buildings } = useMemo(() => buildCity(settlement, nation), [settlement, nation]);
  const [inspect, setInspect] = useState<number | null>(null);
  const [building, setBuilding] = useState<string | null>(null);
  const citizenCount = Math.max(18, Math.min(48, Math.round(12 + settlement.population / 40_000_000)));
  const carCount = Math.max(8, Math.min(20, Math.round(grid * 1.6)));
  const stock: ResourceState = settlement.resourceStockpiles ?? { trees: 0, stone: 0, sand: 0, water: 0, gold: 0 };
  const citizen = inspect != null ? generateCitizen(settlement, nation, inspect) : null;

  const blockedForMaterials = settlement.constructionHalted ?? (settlement.construction < 100 && (stock.stone < 5 || stock.trees < 5));
  const society = nation.society;
  const policy = nation.policy as Record<string, string | number | boolean>;
  const reg = (key: string) => String(policy[key] ?? 'n/a');
  const metric = (label: string, value?: number) => (value == null ? null : (
    <div className="city-res-row" key={label}>
      <span>{label}</span>
      <div className="city-res-bar"><i style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>
      <b>{Math.round(value)}</b>
    </div>
  ));

  return (
    <div className="city-overlay">
      <Canvas shadows dpr={[1, 1.7]} camera={{ position: [half * 1.4, half * 1.3, half * 1.4], fov: 42 }} gl={{ antialias: true }}>
        <color attach="background" args={['#0a1119']} />
        <fog attach="fog" args={['#0a1119', half * 2.2, half * 5]} />
        <ambientLight intensity={0.7} />
        <hemisphereLight args={['#eaf6ff', '#0a1119', 0.9]} />
        <directionalLight position={[half, half * 2, half]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[grid * cell + 6, grid * cell + 6]} />
          <meshStandardMaterial color="#16241b" roughness={1} />
        </mesh>
        <RoadGrid grid={grid} cell={cell} half={half} />
        <Buildings buildings={buildings} onSelectBuilding={setBuilding} />
        <Citizens grid={grid} cell={cell} half={half} count={citizenCount} color={nation.secondaryColor} settlement={settlement} nation={nation} onInspect={setInspect} />
        <Cars grid={grid} cell={cell} half={half} count={carCount} color={nation.color} />
        {settlement.hasPort && (
          <mesh position={[-half - 1.2, 0.2, 0]} castShadow>
            <boxGeometry args={[2.2, 0.4, grid * cell * 0.5]} />
            <meshStandardMaterial color="#3a5566" roughness={0.7} />
          </mesh>
        )}
        {settlement.hasAirport && (
          <mesh position={[half + 1.4, 0.05, half * 0.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[3, grid * cell * 0.5]} />
            <meshStandardMaterial color="#23282d" roughness={0.9} />
          </mesh>
        )}
        <PostProcessing strength={0.62} radius={0.5} threshold={0.8} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={half * 0.8} maxDistance={half * 4} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>

      <div className="city-topbar">
        <button className="city-back" onClick={onClose}>&larr; Back to globe</button>
        <div className="city-title">
          <span className="nation-swatch" style={{ background: nation.color }} />
          <div>
            <strong>{settlement.name}</strong>
            <small>{nation.name} &middot; {(settlement.population / 1_000_000).toFixed(1)}M people &middot; {settlement.kind}</small>
          </div>
        </div>
        <div className="city-flags">
          {settlement.hasPort && <span>Port</span>}
          {settlement.hasAirport && <span>Airport</span>}
          {settlement.hasRailHub && <span>Rail</span>}
        </div>
      </div>

      <div className="city-panel">
        <h3>City systems</h3>
        <div className="city-stat-grid">
          <div><b>{Math.round(settlement.housing)}</b><span>Housing</span></div>
          <div><b>{Math.round(settlement.industry)}</b><span>Industry</span></div>
          <div><b>{Math.round(settlement.services)}</b><span>Services</span></div>
          <div><b>{Math.round(settlement.infrastructure)}</b><span>Infra</span></div>
          <div><b>{Math.round(nation.social.education)}</b><span>Education</span></div>
          <div><b>{Math.round(nation.social.health)}</b><span>Health</span></div>
        </div>
        <h4>Resource stockpiles</h4>
        {resourceRow('Trees', stock.trees)}
        {resourceRow('Stone', stock.stone)}
        {resourceRow('Sand', stock.sand)}
        {resourceRow('Water', stock.water)}
        {resourceRow('Gold', stock.gold)}
        <div className={`city-build-status ${blockedForMaterials ? 'blocked' : ''}`}>
          {blockedForMaterials ? 'Construction halted: insufficient materials' : `Construction ${Math.round(settlement.construction)}%`}
        </div>
        {building && <div className="city-building-note">Selected: <b>{building}</b></div>}

        <h4>Government &amp; regulations</h4>
        <div className="city-reg-grid">
          <div><span>Ideology</span><b>{nation.ideologyVariant ?? 'n/a'}</b></div>
          <div><span>Guns</span><b>{reg('gunRegulation')}</b></div>
          <div><span>Weapons</span><b>{reg('weaponRegulation')}</b></div>
          <div><span>Drugs</span><b>{reg('drugPolicy')}</b></div>
          <div><span>Policing</span><b>{reg('policingLevel')}</b></div>
          <div><span>Edu fund</span><b>{reg('educationFunding')}</b></div>
        </div>

        {society && (
          <>
            <h4>Society</h4>
            {metric('Crime', society.crimeRate)}
            {metric('Policing', society.policing)}
            {metric('Incarceration', society.incarceration)}
            {metric('Drug prevalence', society.drugPrevalence)}
            {metric('Public health', society.publicHealth)}
            {metric('Education', society.educationAttainment)}
            {metric('Science/tech', society.scienceTech)}
            {metric('Employment', society.employment)}
            {metric('Cohesion', society.socialCohesion)}
            {metric('Civil unrest', society.civilUnrest)}
          </>
        )}

        <p className="city-hint">Click a citizen to open their civilian space.</p>
      </div>

      {citizen && (
        <div className="citizen-card">
          <header>
            <div>
              <strong>{citizen.name}</strong>
              <small>{citizen.age} &middot; {citizen.job} &middot; {citizen.district} &middot; {citizen.income} income</small>
            </div>
            <button onClick={() => setInspect(null)}>&times;</button>
          </header>
          <div className="citizen-mood" style={{ color: MOOD_COLOR[citizen.mood] }}>{citizen.mood.toUpperCase()} &middot; {citizen.overall}% satisfied</div>
          <blockquote>&ldquo;{citizen.thought}&rdquo;</blockquote>
          <div className="citizen-cols">
            <div><h5>Wants</h5><ul>{citizen.wants.map((w) => <li key={w}>{w}</li>)}</ul></div>
            <div><h5>Needs</h5><ul>{citizen.needs.map((n) => <li key={n}>{n}</li>)}</ul></div>
            <div><h5>Likes</h5><ul>{citizen.likes.map((l) => <li key={l}>{l}</li>)}</ul></div>
            <div><h5>Dislikes</h5><ul>{citizen.dislikes.map((d) => <li key={d}>{d}</li>)}</ul></div>
          </div>
          <h5>Satisfaction</h5>
          {citizen.satisfaction.map((item) => (
            <div className="city-res-row" key={item.label}>
              <span>{item.label}</span>
              <div className="city-res-bar"><i style={{ width: `${item.value}%` }} /></div>
              <b>{item.value}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
