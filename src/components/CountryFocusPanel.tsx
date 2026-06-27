import { Activity, Brain, Building2, Factory, MapPin, Route, TrainFront, UsersRound } from 'lucide-react';
import type { NationState, SettlementState, WorldState } from '../lib/types';
import { Flag } from './Flag';
import { compact, decimal } from './PanelPrimitives';

function settlementScore(settlement: SettlementState) {
  return settlement.population + settlement.infrastructure * 4_000_000 + settlement.construction * 2_000_000;
}

function sourceLabel(source: string) {
  if (source === 'live') return 'LIVE';
  if (source === 'fallback') return 'FALLBACK';
  if (source === 'blocked') return 'BLOCKED';
  return 'MOCK';
}

export function CountryFocusPanel({
  world,
  nation,
  onSelectCity
}: {
  world: WorldState;
  nation: NationState;
  onSelectCity: (id: string) => void;
}) {
  const delegate = world.delegates.find((item) => item.nationId === nation.id);
  const links = world.transportLinks.filter((link) => link.ownerNationId === nation.id);
  const roads = links.filter((link) => link.kind === 'road').length;
  const rails = links.filter((link) => link.kind === 'rail').length;
  const cohorts = nation.civilianCohorts ?? [];
  const activeCohorts = cohorts.filter((cohort) => !cohort.blocked).length;
  const recentDecision = [...world.decisions].reverse().find((decision) => decision.nationId === nation.id);
  const cities = [...nation.settlements].sort((a, b) => settlementScore(b) - settlementScore(a)).slice(0, 4);

  return (
    <aside className="country-focus-panel" style={{ '--nation': nation.color } as React.CSSProperties}>
      <header>
        <Flag flag={nation.flag} className="country-focus-flag" />
        <div>
          <strong>{nation.name}</strong>
          <small>{delegate?.displayName ?? 'Autonomous delegate'} · {delegate?.status ?? 'active'}</small>
        </div>
        <span className={`country-source source-${delegate?.lastProviderSource ?? 'mock'}`}>{sourceLabel(delegate?.lastProviderSource ?? 'mock')}</span>
      </header>

      <section className="country-thought">
        <Brain size={15} />
        <p>{delegate?.currentThought ?? 'No active thought recorded yet.'}</p>
      </section>

      <div className="country-focus-metrics">
        <div><UsersRound size={14} /><span>Population</span><strong>{compact.format(nation.social.population)}</strong></div>
        <div><Building2 size={14} /><span>Cities</span><strong>{nation.settlements.length}</strong></div>
        <div><Activity size={14} /><span>Cohorts</span><strong>{activeCohorts}/{cohorts.length}</strong></div>
        <div><Route size={14} /><span>Routes</span><strong>{roads}R / {rails}L</strong></div>
      </div>

      <section className="country-city-focus">
        <h3><MapPin size={14} /> Built cities</h3>
        <div>
          {cities.map((settlement) => (
            <button key={settlement.id} onClick={() => onSelectCity(settlement.id)} title={`${settlement.name} city view`}>
              <span>{settlement.name}</span>
              <small>{settlement.kind} · {compact.format(settlement.population)}</small>
              <b>{settlement.construction.toFixed(0)}</b>
            </button>
          ))}
        </div>
      </section>

      <footer>
        <div><Factory size={14} /><span>Industry</span><strong>{nation.economy.industrialCapacity.toFixed(0)}</strong></div>
        <div><TrainFront size={14} /><span>Infrastructure</span><strong>{nation.social.infrastructure.toFixed(0)}</strong></div>
        <div><Activity size={14} /><span>GDP</span><strong>{decimal.format(nation.economy.gdp)}B</strong></div>
      </footer>

      {recentDecision && (
        <div className="country-recent-decision">
          <span>{recentDecision.type.replaceAll('_', ' ')}</span>
          <strong>{recentDecision.title}</strong>
        </div>
      )}
    </aside>
  );
}
