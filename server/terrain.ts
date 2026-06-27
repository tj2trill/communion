import type { NeutralTerritoryState, NationState, Vec2, WorldState } from '../src/lib/types';

export function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects = pi.z > point.z !== pj.z > point.z && point.x < ((pj.x - pi.x) * (point.z - pi.z)) / (pj.z - pi.z) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function landPolygons(world: Pick<WorldState, 'nations' | 'neutralTerritories'>): Vec2[][] {
  return [
    ...world.nations.map((nation: NationState) => nation.territory.polygon),
    ...world.neutralTerritories.map((territory: NeutralTerritoryState) => territory.polygon)
  ];
}

export function isLand(point: Vec2, polygons: Vec2[][]): boolean {
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

export function segmentOnLand(a: Vec2, b: Vec2, polygons: Vec2[][], samples = 24): boolean {
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const point = {
      x: a.x + (b.x - a.x) * progress,
      z: a.z + (b.z - a.z) * progress
    };
    if (!isLand(point, polygons)) return false;
  }
  return true;
}

export function isCoastal(point: Vec2, polygons: Vec2[][], probe = 1.4): boolean {
  if (!isLand(point, polygons)) return false;
  const samples = 12;
  for (let index = 0; index < samples; index += 1) {
    const angle = (Math.PI * 2 * index) / samples;
    const sample = {
      x: point.x + Math.cos(angle) * probe,
      z: point.z + Math.sin(angle) * probe
    };
    if (!isLand(sample, polygons)) return true;
  }
  return false;
}
