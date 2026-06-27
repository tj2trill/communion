import { BadgeDollarSign, Banknote, Coins, HeartPulse, ShieldAlert, Sparkles, UsersRound } from 'lucide-react';
import type { WorldState } from '../lib/types';
import { compact, decimal } from './PanelPrimitives';

export function WorldSummary({ world }: { world: WorldState }) {
  const activeIds = world.flow?.activeActorIds?.length ? world.flow.activeActorIds : [world.currentDelegateId];
  const activeNames = activeIds
    .map((id) => world.delegates.find((delegate) => delegate.id === id)?.displayName)
    .filter(Boolean) as string[];
  const flowLabel = activeNames.length > 1 ? `${activeNames[0]} +${activeNames.length - 1}` : activeNames[0];
  return (
    <div className="world-summary">
      <div><UsersRound size={15} /><span>Population</span><strong>{compact.format(world.stats.population)}</strong></div>
      <div><BadgeDollarSign size={15} /><span>GDP</span><strong>{(world.stats.gdp / 1000).toFixed(1)}T</strong></div>
      <div><Banknote size={15} /><span>Fiat supply</span><strong>{decimal.format(world.stats.moneySupply)}B</strong></div>
      <div><Coins size={15} /><span>Gold</span><strong>{decimal.format(world.stats.goldReserves)} Au</strong></div>
      <div><ShieldAlert size={15} /><span>Wars</span><strong>{world.stats.activeWars}</strong></div>
      <div><HeartPulse size={15} /><span>Food security</span><strong>{world.stats.foodSecurity.toFixed(0)}</strong></div>
      <div className="current-flow" title={activeNames.join(', ')}><Sparkles size={15} /><span>Next impulse</span><strong>{flowLabel}</strong></div>
    </div>
  );
}
