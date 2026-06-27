import { Html, Line, MapControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import countries50mData from '../data/ne_50m_countries.json';
import land50mData from '../data/ne_50m_land.json';
import populatedPlacesData from '../data/ne_110m_populated_places.json';
import { Flag } from './Flag';
import { GltfHuman } from './GltfHuman';
import { Humanoid } from './Humanoid';
import { RealisticGlobe } from './RealisticGlobe';
import { GLOBE_RADIUS, lonLatToVector, simulationPointToLonLat, simulationPointToVector, surfaceQuaternion } from '../lib/globe';
import type { AnatomyMode, NationState, NeutralTerritoryState, OverlayMode, SettlementState, Vec2, WorldState } from '../lib/types';

type LonLat = [number, number];
type PolygonCoordinates = LonLat[][];
type MultiPolygonCoordinates = PolygonCoordinates[];
type NaturalEarthGeometry =
  | { type: 'Polygon'; coordinates: PolygonCoordinates }
  | { type: 'MultiPolygon'; coordinates: MultiPolygonCoordinates };
type NaturalEarthFeature = { geometry?: NaturalEarthGeometry };
type NaturalEarthCollection = { features: NaturalEarthFeature[] };

type PopulatedPlaceFeature = {
  geometry?: { type: string; coordinates: [number, number] };
  properties?: { name?: string; nameascii?: string; pop_max?: number; adm0name?: string };
};
type PopulatedPlacesCollection = { features: PopulatedPlaceFeature[] };

export interface WorldSceneProps {
  world: WorldState;
  anatomyMode: AnatomyMode;
  overlay: OverlayMode;
  selectedNationId: string;
  onSelectNation: (nationId: string) => void;
}

function CameraRig({ world, selectedNationId }: Pick<WorldSceneProps, 'world' | 'selectedNationId'>) {
  const { camera, controls } = useThree();
  const selected = world.nations.find((nation) => nation.id === selectedNationId) ?? world.nations[0];
  const focus = useMemo(() => simulationPointToVector(selected.territory.capital, 0.3), [selected.territory.capital]);
  // Smoothly fly the camera in close to the selected nation so its cities and
  // delegates become visible (zoom-to-country drilldown).
  const desired = useMemo(() => focus.clone().normalize().multiplyScalar(GLOBE_RADIUS + 3.2), [focus]);
  useFrame((_, delta) => {
    const k = Math.min(1, delta * 1.8);
    camera.position.lerp(desired, k);
    const mapControls = controls as { target?: THREE.Vector3; update?: () => void } | undefined;
    if (mapControls?.target) {
      mapControls.target.lerp(focus, k);
      mapControls.update?.();
    }
  });
  return null;
}

function surfaceLine(points: Vec2[], altitude = 0.08) {
  return [...points, points[0]].map((point) => simulationPointToVector(point, altitude));
}

function geometryPolygons(geometry?: NaturalEarthGeometry): PolygonCoordinates[] {
  if (!geometry) return [];
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

function geoJsonLineSegments(collection: NaturalEarthCollection, altitude: number, maxRingPoints: number) {
  const vertices: number[] = [];
  for (const feature of collection.features) {
    for (const polygon of geometryPolygons(feature.geometry)) {
      for (const ring of polygon) {
        if (ring.length < 2) continue;
        const step = Math.max(1, Math.ceil(ring.length / maxRingPoints));
        for (let index = 0; index < ring.length - 1; index += step) {
          const nextIndex = Math.min(index + step, ring.length - 1);
          const [lonA, latA] = ring[index];
          const [lonB, latB] = ring[nextIndex];
          const a = lonLatToVector(lonA, latA, GLOBE_RADIUS + altitude);
          const b = lonLatToVector(lonB, latB, GLOBE_RADIUS + altitude);
          vertices.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }
  }
  return new Float32Array(vertices);
}

function CartographySegments({ positions, color, opacity }: { positions: Float32Array; color: string; opacity: number }) {
  const geometry = useMemo(() => {
    const output = new THREE.BufferGeometry();
    output.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    output.computeBoundingSphere();
    return output;
  }, [positions]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} frustumCulled={false} renderOrder={2}>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </lineSegments>
  );
}

function EarthCartographyLayer({ overlay }: { overlay: OverlayMode }) {
  const coastPositions = useMemo(() => geoJsonLineSegments(land50mData as unknown as NaturalEarthCollection, 0.035, 180), []);
  const countryPositions = useMemo(() => geoJsonLineSegments(countries50mData as unknown as NaturalEarthCollection, 0.055, 160), []);
  const political = overlay === 'political';
  const conflict = overlay === 'conflict';

  return (
    <>
      <CartographySegments positions={coastPositions} color={conflict ? '#ffb187' : '#98c9b1'} opacity={political ? 0.48 : 0.3} />
      <CartographySegments positions={countryPositions} color={conflict ? '#ffd1b7' : '#d4f4ff'} opacity={political ? 0.35 : 0.18} />
    </>
  );
}

function NationSurface({ world, selectedNationId, onSelectNation }: Pick<WorldSceneProps, 'world' | 'selectedNationId' | 'onSelectNation'>) {
  return (
    <>
      {world.nations.map((nation) => {
        const selected = nation.id === selectedNationId;
        const points = surfaceLine(nation.territory.polygon, selected ? 0.18 : 0.14);
        const capital = simulationPointToVector(nation.territory.capital, 0.34);
        const label = simulationPointToVector(nation.territory.labelPosition, 0.7);
        return (
          <group key={nation.id}>
            <Line points={points} color={selected ? '#ffffff' : nation.color} lineWidth={selected ? 3 : 2} transparent opacity={selected ? 0.95 : 0.72} />
            <mesh position={capital} quaternion={surfaceQuaternion(capital)} onClick={(event) => { event.stopPropagation(); onSelectNation(nation.id); }}>
              <sphereGeometry args={[selected ? 0.11 : 0.075, 14, 14]} />
              <meshStandardMaterial color={nation.color} emissive={nation.color} emissiveIntensity={0.75} roughness={0.35} />
            </mesh>
            <Html center position={label.toArray()} distanceFactor={11} className="map-label-wrapper">
              <div className="map-label globe-label" style={{ borderColor: nation.color }}>
                <Flag flag={nation.flag} className="map-label-flag" />
                <strong>{nation.name}</strong>
                <span>{nation.economy.fiat.code} · {(nation.social.population / 1_000_000_000).toFixed(2)}B people</span>
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function NeutralSurface({ world }: { world: WorldState }) {
  return (
    <>
      {world.neutralTerritories.map((territory) => {
        const controller = territory.controllingNationId ? world.nations.find((nation) => nation.id === territory.controllingNationId) : undefined;
        const color = controller?.color ?? '#e7d28a';
        const label = simulationPointToVector(territory.labelPosition, 0.58);
        return (
          <group key={territory.id}>
            <Line points={surfaceLine(territory.polygon, 0.22)} color={color} lineWidth={2.2} dashed={!controller} dashSize={0.18} gapSize={0.1} transparent opacity={0.9} />
            <Html center position={label.toArray()} distanceFactor={12} className="map-label-wrapper">
              <div className="frontier-label" style={{ borderColor: color }}>
                <strong>{territory.name}</strong>
                <span>{controller ? `Controlled by ${controller.name}` : 'Free land'} · contest {territory.contestLevel.toFixed(0)}</span>
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function deterministicPoints(polygon: Vec2[], count: number, salt: number) {
  const xs = polygon.map((point) => point.x);
  const zs = polygon.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return Array.from({ length: count }, (_, index) => {
    const seed = (index + 1) * (salt + 13);
    return {
      x: minX + (((Math.sin(seed) + 1) / 2) * 0.78 + 0.11) * (maxX - minX),
      z: minZ + (((Math.cos(seed * 1.31) + 1) / 2) * 0.76 + 0.12) * (maxZ - minZ)
    };
  });
}

function PopulationLayer({ world }: { world: WorldState }) {
  return (
    <>
      {world.nations.flatMap((nation, nationIndex) => {
        const count = Math.max(16, Math.round(nation.social.population / 95_000_000));
        return deterministicPoints(nation.territory.polygon, count, nationIndex + 5).map((point, index) => {
          const position = simulationPointToVector(point, 0.2);
          return (
            <mesh key={`${nation.id}-pop-${index}`} position={position} quaternion={surfaceQuaternion(position)}>
              <sphereGeometry args={[0.018 + (index % 4) * 0.004, 6, 6]} />
              <meshBasicMaterial color={nation.secondaryColor} transparent opacity={0.82} toneMapped={false} />
            </mesh>
          );
        });
      })}
    </>
  );
}

function RealWorldCityLayer({ selectedNationId }: { selectedNationId: string }) {
  const places = useMemo(() => {
    return (populatedPlacesData as unknown as PopulatedPlacesCollection).features
      .filter((feature) => feature.geometry?.type === 'Point')
      .map((feature) => {
        const [lon, lat] = feature.geometry!.coordinates;
        const population = feature.properties?.pop_max ?? 0;
        return {
          lon,
          lat,
          population,
          name: feature.properties?.nameascii ?? feature.properties?.name ?? 'City'
        };
      })
      .sort((a, b) => b.population - a.population)
      .slice(0, 170);
  }, []);
  const selectedTint = selectedNationId.length % 2 === 0 ? '#9fe8ff' : '#ffe08a';
  return (
    <>
      {places.map((place, index) => {
        const height = 0.045 + Math.min(0.22, Math.sqrt(Math.max(1, place.population)) / 32000);
        const radius = 0.012 + Math.min(0.026, Math.sqrt(Math.max(1, place.population)) / 150000);
        const position = lonLatToVector(place.lon, place.lat, GLOBE_RADIUS + 0.08);
        return (
          <group key={`${place.name}-${index}`} position={position} quaternion={surfaceQuaternion(position)}>
            <mesh position={[0, height / 2, 0]}>
              <cylinderGeometry args={[radius, radius * 0.72, height, 8]} />
              <meshStandardMaterial color="#dbe7e9" emissive={selectedTint} emissiveIntensity={0.32} roughness={0.42} metalness={0.18} />
            </mesh>
            {index < 34 && (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[radius * 1.6, radius * 2.2, 14]} />
                <meshBasicMaterial color={selectedTint} transparent opacity={0.32} side={THREE.DoubleSide} toneMapped={false} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

function GlobeTree({ point, scale = 1 }: { point: Vec2; scale?: number }) {
  const position = simulationPointToVector(point, 0.22);
  return (
    <group position={position} quaternion={surfaceQuaternion(position)} scale={scale}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.024, 0.12, 6]} />
        <meshStandardMaterial color="#7a4d29" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.15, 0]} castShadow>
        <coneGeometry args={[0.08, 0.18, 8]} />
        <meshStandardMaterial color="#2f8c58" roughness={0.78} />
      </mesh>
    </group>
  );
}

function GlobeStone({ point, scale = 1 }: { point: Vec2; scale?: number }) {
  const position = simulationPointToVector(point, 0.2);
  return (
    <mesh position={position} quaternion={surfaceQuaternion(position)} scale={scale} castShadow>
      <dodecahedronGeometry args={[0.055, 0]} />
      <meshStandardMaterial color="#b4bdc1" roughness={0.95} metalness={0.02} />
    </mesh>
  );
}

function GlobeWaterSand({ point, kind }: { point: Vec2; kind: 'water' | 'sand' }) {
  const position = simulationPointToVector(point, 0.16);
  return (
    <mesh position={position} quaternion={surfaceQuaternion(position)} rotation={[Math.PI / 2, 0, 0]}>
      <circleGeometry args={[kind === 'water' ? 0.16 : 0.12, 16]} />
      <meshBasicMaterial color={kind === 'water' ? '#55c9e0' : '#d6bf7c'} transparent opacity={kind === 'water' ? 0.82 : 0.7} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ResourceLayer({ world }: { world: WorldState }) {
  const nationItems = world.nations.flatMap((nation, index) => {
    const points = deterministicPoints(nation.territory.polygon, 36, index + 17);
    return points.map((point, pointIndex) => ({ point, key: `${nation.id}-${pointIndex}`, type: pointIndex % 6 === 0 ? 'stone' : pointIndex % 7 === 0 ? 'sand' : pointIndex % 11 === 0 ? 'water' : 'tree' }));
  });
  const frontierItems = world.neutralTerritories.flatMap((territory: NeutralTerritoryState, index) => {
    const points = deterministicPoints(territory.polygon, 18, index + 47);
    return points.map((point, pointIndex) => ({ point, key: `${territory.id}-${pointIndex}`, type: pointIndex % 4 === 0 ? 'stone' : pointIndex % 5 === 0 ? 'water' : territory.resources.sand > territory.resources.trees ? 'sand' : 'tree' }));
  });
  return (
    <>
      {[...nationItems, ...frontierItems].map((item) => {
        if (item.type === 'stone') return <GlobeStone key={item.key} point={item.point} scale={1 + (item.key.length % 4) * 0.12} />;
        if (item.type === 'sand' || item.type === 'water') return <GlobeWaterSand key={item.key} point={item.point} kind={item.type} />;
        return <GlobeTree key={item.key} point={item.point} scale={0.9 + (item.key.length % 5) * 0.08} />;
      })}
    </>
  );
}

function fallbackSettlement(nation: NationState): SettlementState {
  const empty = { trees: 0, stone: 0, sand: 0, water: 0, gold: 0 };
  return {
    id: `${nation.id}-capital-fallback`,
    nationId: nation.id,
    name: `${nation.name} Capital`,
    kind: 'capital',
    position: nation.territory.capital,
    population: Math.round(nation.social.population * 0.34),
    builtArea: 70,
    infrastructure: nation.social.infrastructure,
    housing: 72,
    industry: nation.economy.industrialCapacity,
    services: nation.social.education,
    construction: 50,
    resourceDemand: empty,
    resourceStockpiles: empty,
    foundedTurn: nation.foundedTurn,
    growthRate: 0
  };
}

function CityLayer({ world, selectedNationId }: { world: WorldState; selectedNationId: string }) {
  return (
    <>
      {world.nations.map((nation) => {
        const selected = nation.id === selectedNationId;
        const settlements = nation.settlements?.length ? nation.settlements : [fallbackSettlement(nation)];
        return settlements.slice(0, selected ? 5 : 2).map((settlement) => {
          const position = simulationPointToVector(settlement.position, 0.22);
          const populationScale = 0.45 + Math.sqrt(Math.max(1, settlement.population) / 520_000_000);
          const buildingCount = Math.min(selected ? 28 : 12, Math.max(6, Math.round(settlement.builtArea / (selected ? 4 : 7))));
          return (
            <group key={`city-${settlement.id}`} position={position} quaternion={surfaceQuaternion(position)} scale={populationScale * (selected ? 1.05 : 0.78)}>
              {Array.from({ length: buildingCount }, (_, index) => {
                const angle = (Math.PI * 2 * index) / Math.max(1, buildingCount);
                const ring = selected ? Math.floor(index / 9) : 0;
                const radius = 0.06 + (index % 3) * 0.035 + ring * 0.08;
                const height = 0.08 + (settlement.infrastructure / 100) * 0.08 + (index % 4) * 0.04 + (settlement.kind === 'capital' ? 0.04 : 0);
                return (
                  <mesh key={index} position={[Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius]} castShadow>
                    <boxGeometry args={[0.032, height, 0.032]} />
                    <meshStandardMaterial color="#dbe8ea" emissive={nation.color} emissiveIntensity={0.12 + settlement.construction / 1200} roughness={0.48} metalness={0.1} />
                  </mesh>
                );
              })}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.13, 0.2 + settlement.builtArea / 420, 28]} />
                <meshBasicMaterial color={nation.color} transparent opacity={selected ? 0.34 : 0.22} side={THREE.DoubleSide} />
              </mesh>
            </group>
          );
        });
      })}
    </>
  );
}

function CivilizationLayer({ world, selectedNationId }: { world: WorldState; selectedNationId: string }) {
  const nation = world.nations.find((item) => item.id === selectedNationId) ?? world.nations[0];
  const settlements = nation.settlements?.length ? nation.settlements : [fallbackSettlement(nation)];
  return (
    <>
      {settlements.map((settlement, index) => {
        const position = simulationPointToVector(settlement.position, 0.24);
        const districtScale = 0.72 + settlement.builtArea / 170 + index * 0.025;
        const buildingCount = Math.min(10, Math.max(4, Math.round(settlement.builtArea / 11)));
        return (
          <group key={`settlement-${settlement.id}`} position={position} quaternion={surfaceQuaternion(position)} scale={districtScale}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.075 + settlement.housing / 1300, 18]} />
              <meshBasicMaterial color={nation.color} transparent opacity={0.2 + settlement.construction / 500} side={THREE.DoubleSide} />
            </mesh>
            {Array.from({ length: buildingCount }, (_, building) => {
              const angle = (building / buildingCount) * Math.PI * 2;
              const height = 0.055 + (settlement.services / 100) * 0.04 + (building % 3) * 0.025;
              return (
                <mesh key={building} position={[Math.cos(angle) * 0.075, height / 2, Math.sin(angle) * 0.075]} castShadow>
                  <boxGeometry args={[0.024, height, 0.024]} />
                  <meshStandardMaterial color={building % 2 ? '#f0f5f4' : nation.secondaryColor} emissive={nation.color} emissiveIntensity={0.08} roughness={0.52} />
                </mesh>
              );
            })}
          </group>
        );
      })}
      {settlements.flatMap((settlement, settlementIndex) => deterministicPoints([settlement.position], Math.min(18, Math.max(6, Math.round(settlement.population / 70_000_000))), 257 + settlementIndex).map((point, index) => {
        const position = simulationPointToVector({ x: point.x + Math.sin(index * 1.7) * 0.42, z: point.z + Math.cos(index * 1.3) * 0.42 }, 0.29);
        return (
          <mesh key={`selected-civilian-${settlement.id}-${index}`} position={position} quaternion={surfaceQuaternion(position)}>
            <capsuleGeometry args={[0.014, 0.045, 4, 6]} />
            <meshStandardMaterial color={index % 3 === 0 ? nation.secondaryColor : '#f5e4c9'} emissive={nation.color} emissiveIntensity={0.08} roughness={0.68} />
          </mesh>
        );
      }))}
    </>
  );
}

function SceneContent({ world, anatomyMode, overlay, selectedNationId, onSelectNation }: WorldSceneProps) {
  const recentMessages = world.messages.slice(-4);
  return (
    <>
      <CameraRig world={world} selectedNationId={selectedNationId} />
      <color attach="background" args={['#02070c']} />
      <fog attach="fog" args={['#02070c', 20, 44]} />
      <ambientLight intensity={0.64} />
      <hemisphereLight args={['#dff7ff', '#061019', 1.0]} />
      <directionalLight position={[-10, 8, 9]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[8, 6, -8]} intensity={18} distance={34} color="#6bd8ff" />

      <RealisticGlobe overlay={overlay} />
      <EarthCartographyLayer overlay={overlay} />
      <NationSurface world={world} selectedNationId={selectedNationId} onSelectNation={onSelectNation} />
      <NeutralSurface world={world} />
      <CityLayer world={world} selectedNationId={selectedNationId} />
      <CivilizationLayer world={world} selectedNationId={selectedNationId} />
      <PopulationLayer world={world} />
      <RealWorldCityLayer selectedNationId={selectedNationId} />
      <ResourceLayer world={world} />
      {recentMessages.map((message, index) => {
        const fromDelegate = world.delegates.find((delegate) => delegate.id === message.fromDelegateId);
        const fromNation = world.nations.find((nation) => nation.id === fromDelegate?.nationId);
        const toDelegate = world.delegates.find((delegate) => delegate.id === message.toDelegateId);
        const toNation = world.nations.find((nation) => nation.id === toDelegate?.nationId);
        if (!fromNation) return null;
        const start = simulationPointToVector(fromNation.territory.capital, 0.45);
        const end = toNation ? simulationPointToVector(toNation.territory.capital, 0.45) : lonLatToVector(-20 + index * 14, 20 - index * 8, GLOBE_RADIUS + 0.45);
        const mid = start.clone().lerp(end, 0.5).normalize().multiplyScalar(GLOBE_RADIUS + 2.1);
        return <Line key={message.id} points={[start, mid, end]} color={fromNation.color} lineWidth={1} transparent opacity={0.45} />;
      })}

      {world.delegates.map((delegate) => {
        const nation = world.nations.find((item) => item.id === delegate.nationId)!;
        const message = [...world.messages].reverse().find((item) => item.fromDelegateId === delegate.id && item.turn >= world.turn - 2);
        // Realistic rigged human for the exterior view; procedural model for anatomy modes.
        if (anatomyMode === 'exterior') {
          return (
            <GltfHuman
              key={delegate.id}
              delegate={delegate}
              nation={nation}
              active={delegate.id === world.currentDelegateId}
              onSelect={() => onSelectNation(nation.id)}
            />
          );
        }
        return (
          <Humanoid
            key={delegate.id}
            delegate={delegate}
            nation={nation}
            anatomyMode={anatomyMode}
            message={message}
            active={delegate.id === world.currentDelegateId}
            onSelect={() => onSelectNation(nation.id)}
            surfaceMode="globe"
          />
        );
      })}

      <MapControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={8.7}
        maxDistance={28}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI - 0.18}
        target={simulationPointToVector((world.nations.find((nation) => nation.id === selectedNationId) ?? world.nations[0]).territory.capital, 0.3).toArray()}
      />
    </>
  );
}

export function WorldScene(props: WorldSceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.7]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}>
      <Suspense fallback={null}>
        <SceneContent {...props} />
      </Suspense>
    </Canvas>
  );
}
