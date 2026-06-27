import type { NationState, ResourceState } from '../src/lib/types';

// Slice 2: nothing builds without sufficient money AND materials in stock.
// A "cost" is money (drawn from treasury cash) plus a bill of raw materials drawn
// from the nation's resource stockpiles. Costs scale with link length / settlement
// size via a single explicit formula so the curve is deterministic.

export interface BuildCost {
  money: number;
  trees: number;
  stone: number;
  sand: number;
  gold: number;
}

const ZERO: BuildCost = { money: 0, trees: 0, stone: 0, sand: 0, gold: 0 };

function scale(base: BuildCost, factor: number): BuildCost {
  return {
    money: Math.round(base.money * factor),
    trees: Math.round(base.trees * factor),
    stone: Math.round(base.stone * factor),
    sand: Math.round(base.sand * factor),
    gold: Math.round(base.gold * factor)
  };
}

// Base bills (see spec section 4.1). Materials are calibrated against the
// engine's resource magnitudes (stockpiles in the hundreds, gold in the tens).
const ROAD_BASE: BuildCost = { money: 30, trees: 0, stone: 14, sand: 8, gold: 0 };
const RAIL_BASE: BuildCost = { money: 80, trees: 0, stone: 24, sand: 6, gold: 8 };
const PORT_BASE: BuildCost = { money: 60, trees: 16, stone: 22, sand: 0, gold: 0 };
const AIRPORT_BASE: BuildCost = { money: 110, trees: 0, stone: 18, sand: 16, gold: 12 };
const BUILDING_BASE: BuildCost = { money: 8, trees: 3, stone: 4, sand: 1, gold: 0 };

// Link cost grows with corridor length: cost = base * (1 + lengthUnits * 0.05).
export function linkBuildCost(kind: 'road' | 'rail', lengthUnits: number): BuildCost {
  const base = kind === 'rail' ? RAIL_BASE : ROAD_BASE;
  return scale(base, 1 + Math.max(0, lengthUnits) * 0.05);
}

// Facility cost grows with settlement size: cost = base * (1 + builtArea / 120).
export function portBuildCost(builtArea: number): BuildCost {
  return scale(PORT_BASE, 1 + Math.max(0, builtArea) / 120);
}

export function airportBuildCost(builtArea: number): BuildCost {
  return scale(AIRPORT_BASE, 1 + Math.max(0, builtArea) / 140);
}

// Per-tick organic construction draws a small bill scaled by settlement size.
export function buildingTickCost(builtArea: number): BuildCost {
  return scale(BUILDING_BASE, 1 + Math.max(0, builtArea) / 100);
}

function treasury(nation: NationState): number {
  return nation.economy.fiat.treasuryCash;
}

export function canAfford(nation: NationState, cost: BuildCost): boolean {
  const res = nation.resources;
  return (
    treasury(nation) >= cost.money &&
    res.trees >= cost.trees &&
    res.stone >= cost.stone &&
    res.sand >= cost.sand &&
    res.gold >= cost.gold
  );
}

// Returns the first shortfall (for blocked messaging), or null if affordable.
export function shortfall(nation: NationState, cost: BuildCost): string | null {
  const res = nation.resources;
  if (treasury(nation) < cost.money) return 'treasury cash';
  if (res.trees < cost.trees) return 'timber';
  if (res.stone < cost.stone) return 'stone';
  if (res.sand < cost.sand) return 'sand';
  if (res.gold < cost.gold) return 'gold';
  return null;
}

// Deduct a cost from treasury + stockpiles. Caller must check canAfford first.
export function consume(nation: NationState, cost: BuildCost): void {
  nation.economy.fiat.treasuryCash = Math.max(0, nation.economy.fiat.treasuryCash - cost.money);
  const res: ResourceState = nation.resources;
  res.trees = Math.max(0, res.trees - cost.trees);
  res.stone = Math.max(0, res.stone - cost.stone);
  res.sand = Math.max(0, res.sand - cost.sand);
  res.gold = Math.max(0, res.gold - cost.gold);
}

export function describeCost(cost: BuildCost): string {
  const parts: string[] = [];
  if (cost.money) parts.push(`${cost.money} cash`);
  if (cost.stone) parts.push(`${cost.stone} stone`);
  if (cost.trees) parts.push(`${cost.trees} timber`);
  if (cost.sand) parts.push(`${cost.sand} sand`);
  if (cost.gold) parts.push(`${cost.gold} gold`);
  return parts.length ? parts.join(', ') : 'no materials';
}

export { ZERO as ZERO_COST };
