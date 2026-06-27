import { Activity, Coins, Flame, TrendingUp, Wheat } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MarketSample } from '../lib/marketHistory';
import { marketSeries } from '../lib/marketHistory';
import type { NationState, WorldState } from '../lib/types';
import { compact, decimal } from './PanelPrimitives';

// Inline sparkline drawn from the rolling client-side history.
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <div className="spark spark-empty">collecting...</div>;
  }
  const width = 132;
  const height = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => `${(index * step).toFixed(1)},${(height - ((value - min) / span) * height).toFixed(1)}`)
    .join(' ');
  const lastX = (values.length - 1) * step;
  const lastY = height - ((values[values.length - 1] - min) / span) * height;
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={1.8} fill={color} />
    </svg>
  );
}

function delta(values: number[]): { pct: number; dir: 'up' | 'down' | 'flat' } {
  if (values.length < 2) return { pct: 0, dir: 'flat' };
  const current = values[values.length - 1];
  const previous = values[values.length - 2];
  if (!previous) return { pct: 0, dir: 'flat' };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct, dir: pct > 0.01 ? 'up' : pct < -0.01 ? 'down' : 'flat' };
}

function Instrument({
  label,
  icon,
  value,
  values,
  color,
  invertTone = false
}: {
  label: string;
  icon: ReactNode;
  value: string;
  values: number[];
  color: string;
  invertTone?: boolean;
}) {
  const move = delta(values);
  // For risk-style series, a rise is "bad" (negative tone).
  const positive = invertTone ? move.dir === 'down' : move.dir === 'up';
  const toneClass = move.dir === 'flat' ? 'flat' : positive ? 'positive' : 'negative';
  return (
    <article className="instrument-card">
      <header>
        <span className="instrument-name">{icon}{label}</span>
        <span className={`instrument-delta ${toneClass}`}>
          {move.dir === 'up' ? 'UP' : move.dir === 'down' ? 'DOWN' : 'FLAT'} {Math.abs(move.pct).toFixed(2)}%
        </span>
      </header>
      <strong className="instrument-value">{value}</strong>
      <Sparkline values={values} color={color} />
    </article>
  );
}

export function MarketsPanel({ world }: { world: WorldState }) {
  const history: MarketSample[] = marketSeries();
  const market = world.market;
  const gold = history.map((sample) => sample.gold);
  const commodity = history.map((sample) => sample.commodity);
  const food = history.map((sample) => sample.food);
  const energy = history.map((sample) => sample.energy);
  const risk = history.map((sample) => sample.risk);

  const fx = [...world.nations].sort((a, b) => b.economy.fiat.exchangeRateToWorld - a.economy.fiat.exchangeRateToWorld);
  const strongest = fx[0]?.economy.fiat.exchangeRateToWorld || 1;

  return (
    <div className="panel-scroll markets-panel">
      <div className="market-banner">
        <div><Coins size={18} /><span>Gold / {market.reserveUnit}</span></div>
        <strong>{market.goldPrice.toFixed(1)}</strong>
        <small className={market.lastGoldMove >= 0 ? 'positive' : 'negative'}>{market.lastGoldMove >= 0 ? '+' : ''}{market.lastGoldMove.toFixed(2)}%</small>
      </div>

      <div className="instrument-grid">
        <Instrument label="Gold" icon={<Coins size={13} />} value={market.goldPrice.toFixed(1)} values={gold} color="#f2c14e" />
        <Instrument label="Commodities" icon={<TrendingUp size={13} />} value={market.commodityIndex.toFixed(1)} values={commodity} color="#66d3d0" />
        <Instrument label="Food" icon={<Wheat size={13} />} value={market.foodPriceIndex.toFixed(1)} values={food} color="#9bd97a" />
        <Instrument label="Energy" icon={<Flame size={13} />} value={market.energyPriceIndex.toFixed(1)} values={energy} color="#ff9f5c" />
        <Instrument label="Risk" icon={<Activity size={13} />} value={`${market.riskIndex.toFixed(0)}/100`} values={risk} color="#ff6f8b" invertTone />
      </div>

      <section className="detail-section">
        <h3><TrendingUp size={16} /> Trade desk</h3>
        <div className="metric-grid">
          <div className="market-stat"><span>Trade volume</span><strong>{decimal.format(market.tradeVolume)}B</strong></div>
          <div className="market-stat"><span>Global inflation</span><strong>{market.globalInflation.toFixed(1)}%</strong></div>
          <div className="market-stat"><span>Gold available</span><strong>{compact.format(market.goldAvailable)} Au</strong></div>
          <div className="market-stat"><span>Samples</span><strong>{history.length}</strong></div>
        </div>
      </section>

      <section className="detail-section">
        <h3>Currency board (WSU)</h3>
        <div className="fx-board">
          {fx.map((nation: NationState) => {
            const rate = nation.economy.fiat.exchangeRateToWorld;
            return (
              <div key={nation.id} className="fx-row">
                <span className="fx-code"><i style={{ background: nation.color }} />{nation.economy.fiat.code}</span>
                <div className="fx-bar"><i style={{ width: `${Math.max(3, (rate / strongest) * 100)}%`, background: nation.color }} /></div>
                <strong>{rate.toFixed(4)}</strong>
                <small className={nation.economy.fiat.inflation > 5 ? 'negative' : 'positive'}>{nation.economy.fiat.inflation.toFixed(1)}%</small>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
