import { BadgeDollarSign, Banknote, Coins, Globe2, UsersRound } from 'lucide-react';
import type { NationState, WorldState } from '../lib/types';
import { Flag } from './Flag';
import { Bar, compact, decimal } from './PanelPrimitives';

function NationCard({ nation, selected, onSelect }: { nation: NationState; selected: boolean; onSelect: () => void }) {
  return (
    <button className={`nation-card ${selected ? 'selected' : ''}`} onClick={onSelect} style={{ '--nation': nation.color } as React.CSSProperties}>
      <div className="nation-card-head">
        <Flag flag={nation.flag} className="nation-flag" />
        <div>
          <strong>{nation.name}</strong>
          <small>{nation.governmentForm}</small>
        </div>
        <span className="approval">{nation.social.approval.toFixed(0)}%</span>
      </div>
      <div className="nation-grid">
        <span><UsersRound size={13} /> {compact.format(nation.social.population)}</span>
        <span><BadgeDollarSign size={13} /> {decimal.format(nation.economy.gdp)}B WSU</span>
        <span><Banknote size={13} /> {nation.economy.fiat.code}</span>
        <span><Coins size={13} /> {decimal.format(nation.economy.gold.treasuryReserves)} Au</span>
      </div>
      <div className="nation-footer">
        <span>{nation.ideology}</span>
        <b className={nation.economy.annualGrowth >= 0 ? 'positive' : 'negative'}>{nation.economy.annualGrowth >= 0 ? '+' : ''}{nation.economy.annualGrowth.toFixed(1)}%</b>
      </div>
    </button>
  );
}

export function NationsPanel({ world, selectedNationId, onSelectNation }: { world: WorldState; selectedNationId: string; onSelectNation: (id: string) => void }) {
  return (
    <div className="panel-scroll">
      <div className="panel-intro">
        <Globe2 size={17} />
        <div><strong>Four founding sovereign states</strong><small>Each model owns land, institutions, a fiat currency, and sovereign gold from genesis.</small></div>
      </div>
      <div className="nation-list">
        {world.nations.map((nation) => (
          <NationCard key={nation.id} nation={nation} selected={nation.id === selectedNationId} onSelect={() => onSelectNation(nation.id)} />
        ))}
      </div>
      <section className="detail-section">
        <h3>International order</h3>
        {world.internationalInstitutions.map((institution) => (
          <div className="institution-row compact-row" key={institution.id}>
            <div><strong>{institution.name}</strong><small>{institution.kind} · {institution.members.length} members</small></div>
            <Bar value={institution.legitimacy} />
          </div>
        ))}
      </section>
    </div>
  );
}

const tierNames: Record<number, string> = {
  6: 'International system',
  5: 'Sovereign state',
  4: 'Regions and knowledge institutions',
  3: 'Municipal, media, labor, civil society',
  2: 'Households and firms',
  1: 'Individuals'
};

export function HierarchyPanel({ nation }: { nation: NationState }) {
  const tiers = [5, 4, 3, 2] as const;
  return (
    <div className="panel-scroll">
      <div className="selected-nation-title" style={{ '--nation': nation.color } as React.CSSProperties}>
        <span style={{ background: nation.color }} />
        <div><strong>{nation.name}</strong><small>Power is multidimensional—not a single rank.</small></div>
      </div>
      <div className="hierarchy-legend">
        <span>Influence</span><span>Legitimacy</span><span>Wealth</span><span>Coercion</span><span>Information</span>
      </div>
      <div className="hierarchy-stack">
        {tiers.map((tier) => (
          <section className={`hierarchy-tier tier-${tier}`} key={tier}>
            <header><span>{tier}</span><strong>{tierNames[tier]}</strong></header>
            {nation.institutions.filter((item) => item.tier === tier).map((institution) => (
              <div className="institution-row" key={institution.id}>
                <div className="institution-name">
                  <strong>{institution.name}</strong>
                  <small>{institution.kind.replaceAll('_', ' ')} · autonomy {institution.autonomy.toFixed(0)}</small>
                </div>
                <div className="mini-metrics">
                  <i style={{ width: `${institution.influence}%` }} title={`Influence ${institution.influence}`} />
                  <i style={{ width: `${institution.legitimacy}%` }} title={`Legitimacy ${institution.legitimacy}`} />
                  <i style={{ width: `${institution.wealthShare}%` }} title={`Wealth share ${institution.wealthShare}`} />
                  <i style={{ width: `${institution.coerciveCapacity}%` }} title={`Coercive capacity ${institution.coerciveCapacity}`} />
                  <i style={{ width: `${institution.informationReach}%` }} title={`Information reach ${institution.informationReach}`} />
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
      <section className="detail-section">
        <h3>Constitutional architecture</h3>
        {nation.constitution.map((article, index) => <p className="constitution" key={article}><b>{index + 1}</b>{article}</p>)}
      </section>
    </div>
  );
}
