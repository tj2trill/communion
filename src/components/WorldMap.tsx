import { Edges, Html, Line, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ChatMessage, NationState, OverlayMode, RelationState, WorldState } from '../lib/types';

function colorByOverlay(nation: NationState, overlay: OverlayMode, world: WorldState): string {
  if (overlay === 'political') return nation.color;
  if (overlay === 'economy') {
    const score = Math.max(0, Math.min(1, (nation.economy.annualGrowth + 8) / 18));
    return new THREE.Color().setHSL(0.02 + score * 0.35, 0.62, 0.38 + score * 0.13).getStyle();
  }
  if (overlay === 'gold') {
    const maxGold = Math.max(...world.nations.map((item) => item.economy.gold.treasuryReserves));
    const score = nation.economy.gold.treasuryReserves / Math.max(1, maxGold);
    return new THREE.Color().setHSL(0.11, 0.75, 0.25 + score * 0.38).getStyle();
  }
  if (overlay === 'conflict') {
    const atWar = world.wars.some(
      (war) => war.status === 'active' && (war.attackers.includes(nation.id) || war.defenders.includes(nation.id))
    );
    return atWar ? '#d94b48' : '#4f646c';
  }
  const trust = world.relations
    .filter((relation) => relation.a === nation.id || relation.b === nation.id)
    .reduce((sum, relation) => sum + relation.trust, 0) / 3;
  return new THREE.Color().setHSL(0.5 + trust / 500, 0.5, 0.34 + trust / 500).getStyle();
}

export function Territory({
  nation,
  selected,
  overlay,
  world,
  onSelect
}: {
  nation: NationState;
  selected: boolean;
  overlay: OverlayMode;
  world: WorldState;
  onSelect: () => void;
}) {
  const shape = useMemo(() => {
    const value = new THREE.Shape();
    const [first, ...rest] = nation.territory.polygon;
    value.moveTo(first.x, -first.z);
    rest.forEach((point) => value.lineTo(point.x, -point.z));
    value.closePath();
    return value;
  }, [nation.territory.polygon]);
  const options = useMemo<THREE.ExtrudeGeometryOptions>(
    () => ({
      depth: nation.territory.elevation,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.12,
      bevelThickness: 0.09
    }),
    [nation.territory.elevation]
  );
  const color = colorByOverlay(nation, overlay, world);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shape, options]} />
        <meshStandardMaterial
          color={color}
          roughness={0.78}
          metalness={overlay === 'gold' ? 0.34 : 0.04}
          emissive={selected ? nation.color : '#000000'}
          emissiveIntensity={selected ? 0.18 : 0}
        />
        <Edges color={selected ? '#ffffff' : nation.secondaryColor} threshold={22} lineWidth={selected ? 2 : 1} />
      </mesh>
    </group>
  );
}

export function CapitalCluster({ nation }: { nation: NationState }) {
  const buildings = useMemo(
    () => [
      [-0.42, 0.22, 0.62],
      [0.25, 0.32, 0.8],
      [0.52, -0.18, 0.48],
      [-0.12, -0.46, 0.72],
      [-0.62, -0.24, 0.42]
    ],
    []
  );
  const y = nation.territory.elevation + 0.08;
  return (
    <group position={[nation.territory.capital.x, y, nation.territory.capital.z]}>
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.42, 0.18, 24]} />
        <meshStandardMaterial color={nation.secondaryColor} roughness={0.55} metalness={0.12} />
      </mesh>
      {buildings.map(([x, z, height], index) => (
        <RoundedBox key={index} args={[0.25, height, 0.25]} radius={0.045} position={[x, height / 2 + 0.15, z]} castShadow>
          <meshStandardMaterial color={index === 1 ? nation.secondaryColor : '#d5e4e7'} roughness={0.58} metalness={0.16} />
        </RoundedBox>
      ))}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.35, 8]} />
        <meshStandardMaterial color="#e8f5f5" />
      </mesh>
      <mesh position={[0.18, 1.42, 0]} rotation={[0, 0, -0.12]}>
        <planeGeometry args={[0.42, 0.22]} />
        <meshStandardMaterial color={nation.color} side={THREE.DoubleSide} />
      </mesh>
      <Html center position={[0, 1.85, 0]} distanceFactor={14} className="map-label-wrapper">
        <div className="map-label" style={{ borderColor: nation.color }}>
          <strong>{nation.name}</strong>
          <span>{nation.economy.fiat.code} · {nation.economy.gold.treasuryReserves.toFixed(0)} Au</span>
        </div>
      </Html>
    </group>
  );
}

function relationColor(relation: RelationState) {
  if (relation.atWar) return '#ff554f';
  if (relation.alliance) return '#64d7ff';
  if (relation.sanctions > 35) return '#f0a64b';
  return relation.trust > 65 ? '#55d49a' : '#7a8e96';
}

export function RelationArc({ relation, world, overlay }: { relation: RelationState; world: WorldState; overlay: OverlayMode }) {
  const a = world.nations.find((nation) => nation.id === relation.a);
  const b = world.nations.find((nation) => nation.id === relation.b);
  if (!a || !b || !['diplomacy', 'conflict'].includes(overlay)) return null;
  const midpoint: [number, number, number] = [
    (a.territory.capital.x + b.territory.capital.x) / 2,
    2.1 + Math.abs(a.territory.capital.x - b.territory.capital.x) * 0.08,
    (a.territory.capital.z + b.territory.capital.z) / 2
  ];
  const points: [number, number, number][] = [
    [a.territory.capital.x, a.territory.elevation + 0.55, a.territory.capital.z],
    midpoint,
    [b.territory.capital.x, b.territory.elevation + 0.55, b.territory.capital.z]
  ];
  return (
    <Line
      points={points}
      color={relationColor(relation)}
      lineWidth={relation.atWar ? 2.3 : relation.alliance ? 1.8 : 1}
      dashed={!relation.atWar && !relation.alliance}
      dashSize={0.18}
      gapSize={0.12}
      opacity={0.72}
      transparent
    />
  );
}

export function CommunicationPulse({ message, world, index }: { message: ChatMessage; world: WorldState; index: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const fromDelegate = world.delegates.find((delegate) => delegate.id === message.fromDelegateId);
  const fromNation = world.nations.find((nation) => nation.id === fromDelegate?.nationId);
  const toDelegate = world.delegates.find((delegate) => delegate.id === message.toDelegateId);
  const toNation = world.nations.find((nation) => nation.id === toDelegate?.nationId);
  const start = fromNation?.territory.capital;
  const end = toNation?.territory.capital ?? { x: 0, z: 0 };
  const curve = useMemo(() => {
    if (!start) return null;
    const a = new THREE.Vector3(start.x, (fromNation?.territory.elevation ?? 0.5) + 0.9, start.z);
    const b = new THREE.Vector3(end.x, toNation ? toNation.territory.elevation + 0.9 : 1.15, end.z);
    const mid = a.clone().lerp(b, 0.5);
    mid.y += 2.4 + a.distanceTo(b) * 0.06;
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }, [end.x, end.z, fromNation?.territory.elevation, start, toNation]);

  useFrame(({ clock }) => {
    if (!mesh.current || !curve) return;
    const t = (clock.elapsedTime * 0.23 + index * 0.17) % 1;
    mesh.current.position.copy(curve.getPoint(t));
  });

  if (!curve || !start) return null;
  return (
    <>
      <Line points={curve.getPoints(28)} color={fromNation?.color ?? '#ffffff'} lineWidth={0.7} transparent opacity={0.24} />
      <mesh ref={mesh}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshBasicMaterial color={fromNation?.secondaryColor ?? '#ffffff'} toneMapped={false} />
      </mesh>
    </>
  );
}
