import { Building2, CandlestickChart, Coins, Globe2, ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';
import { recordMarket } from '../lib/marketHistory';
import type { WorldState } from '../lib/types';
import { ConflictPanel, EconomyPanel } from './EconomyConflictPanels';
import { MarketsPanel } from './MarketsPanel';
import { HierarchyPanel, NationsPanel } from './NationPanels';

export type LeftTab = 'nations' | 'hierarchy' | 'economy' | 'markets' | 'conflict';

export function LeftPanel({
  world,
  tab,
  onTab,
  selectedNationId,
  onSelectNation
}: {
  world: WorldState;
  tab: LeftTab;
  onTab: (tab: LeftTab) => void;
  selectedNationId: string;
  onSelectNation: (id: string) => void;
}) {
  const nation = world.nations.find((item) => item.id === selectedNationId) ?? world.nations[0];
  useEffect(() => {
    recordMarket(world);
  }, [world]);
  return (
    <aside className="side-panel left-panel">
      <nav className="panel-tabs five-tabs">
        <button className={tab === 'nations' ? 'active' : ''} onClick={() => onTab('nations')} title="Nations"><Globe2 size={17} /><span>Nations</span></button>
        <button className={tab === 'hierarchy' ? 'active' : ''} onClick={() => onTab('hierarchy')} title="Hierarchy"><Building2 size={17} /><span>Hierarchy</span></button>
        <button className={tab === 'economy' ? 'active' : ''} onClick={() => onTab('economy')} title="Money and gold"><Coins size={17} /><span>Economy</span></button>
        <button className={tab === 'markets' ? 'active' : ''} onClick={() => onTab('markets')} title="Markets and trading"><CandlestickChart size={17} /><span>Markets</span></button>
        <button className={tab === 'conflict' ? 'active' : ''} onClick={() => onTab('conflict')} title="Conflict"><ShieldAlert size={17} /><span>Conflict</span></button>
      </nav>
      {tab === 'nations' && <NationsPanel world={world} selectedNationId={selectedNationId} onSelectNation={onSelectNation} />}
      {tab === 'hierarchy' && <HierarchyPanel nation={nation} />}
      {tab === 'economy' && <EconomyPanel world={world} nation={nation} />}
      {tab === 'markets' && <MarketsPanel world={world} />}
      {tab === 'conflict' && <ConflictPanel world={world} />}
    </aside>
  );
}
