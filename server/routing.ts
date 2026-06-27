import type { TransportLink, Vec2 } from '../src/lib/types';

export interface RouteResult {
  legs: TransportLink[];
}

function otherEnd(link: TransportLink, settlementId: string): string | undefined {
  if (link.fromSettlementId === settlementId) return link.toSettlementId;
  if (link.toSettlementId === settlementId) return link.fromSettlementId;
  return undefined;
}

export function findRoute(fromSettlementId: string, toSettlementId: string, links: TransportLink[]): RouteResult | null {
  if (fromSettlementId === toSettlementId) return { legs: [] };
  const builtLinks = links.filter((link) => link.built).sort((a, b) => a.id.localeCompare(b.id));
  const queue: Array<{ node: string; legs: TransportLink[] }> = [{ node: fromSettlementId, legs: [] }];
  const visited = new Set<string>([fromSettlementId]);

  while (queue.length) {
    const current = queue.shift()!;
    for (const link of builtLinks) {
      const next = otherEnd(link, current.node);
      if (!next || visited.has(next)) continue;
      const legs = [...current.legs, link];
      if (next === toSettlementId) return { legs };
      visited.add(next);
      queue.push({ node: next, legs });
    }
  }

  return null;
}

export function polylineLength(points: Vec2[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].z - points[index - 1].z);
  }
  return total;
}

export function pointAlongPolyline(points: Vec2[], progress: number): Vec2 {
  if (points.length === 0) return { x: 0, z: 0 };
  if (points.length === 1) return points[0];
  const target = Math.max(0, Math.min(1, progress)) * polylineLength(points);
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    if (travelled + length >= target) {
      const local = length === 0 ? 0 : (target - travelled) / length;
      return {
        x: start.x + (end.x - start.x) * local,
        z: start.z + (end.z - start.z) * local
      };
    }
    travelled += length;
  }
  return points[points.length - 1];
}
