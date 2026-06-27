import type { WorldState } from './types';

// Client-side rolling price history. The server streams snapshots (no time
// series), so the trading board accumulates samples here, deduped by flow turn.
export interface MarketSample {
  turn: number;
  gold: number;
  commodity: number;
  food: number;
  energy: number;
  risk: number;
  tradeVolume: number;
}

const MAX_SAMPLES = 80;
const samples: MarketSample[] = [];

export function recordMarket(world: WorldState): void {
  const last = samples[samples.length - 1];
  if (last && last.turn === world.turn) return;
  const market = world.market;
  samples.push({
    turn: world.turn,
    gold: market.goldPrice,
    commodity: market.commodityIndex,
    food: market.foodPriceIndex,
    energy: market.energyPriceIndex,
    risk: market.riskIndex,
    tradeVolume: market.tradeVolume
  });
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
}

export function marketSeries(): MarketSample[] {
  return samples;
}

export function seriesOf(key: keyof Omit<MarketSample, 'turn'>): number[] {
  return samples.map((sample) => sample[key]);
}
