import { Banknote, Coins, Droplets, FlagTriangleRight, Gem, Mountain, Pickaxe, Scale, ShieldAlert, Trees, WavesHorizontal } from 'lucide-react';
import type { DecisionRecord, NationState, NeutralTerritoryState, WorldState } from '../lib/types';
import { Flag } from './Flag';
import { Bar, compact, decimal, Metric } from './PanelPrimitives';

export function EconomyPanel({ world, nation }: { world: WorldState; nation: NationState }) {
  const fiat = nation.economy.fiat;
  const gold = nation.economy.gold;
  return (
    <div className="panel-scroll">
      <div className="market-banner">
        <div><Coins size={18} /><span>Gold / {world.market.reserveUnit}</span></div>
        <strong>{world.market.goldPrice.toFixed(1)}</strong>
        <small className={world.market.lastGoldMove >= 0 ? 'positive' : 'negative'}>{world.market.lastGoldMove >= 0 ? '+' : ''}{world.market.lastGoldMove.toFixed(2)}%</small>
      </div>
      <div className="metric-grid">
        <Metric label="Global risk" value={`${world.market.riskIndex.toFixed(0)}/100`} tone={world.market.riskIndex > 65 ? 'danger' : world.market.riskIndex > 35 ? 'warn' : 'good'} />
        <Metric label="Global inflation" value={`${world.market.globalInflation.toFixed(1)}%`} tone={world.market.globalInflation > 6 ? 'danger' : 'neutral'} />
        <Metric label="Food index" value={world.market.foodPriceIndex.toFixed(1)} />
        <Metric label="Energy index" value={world.market.energyPriceIndex.toFixed(1)} />
      </div>

      <section className="detail-section currency-section" style={{ '--nation': nation.color } as React.CSSProperties}>
        <h3><Banknote size={16} /> {fiat.name} <span>{fiat.code}</span></h3>
        <div className="metric-grid">
          <Metric label="Money supply" value={`${decimal.format(fiat.moneySupply)}B`} />
          <Metric label="Treasury cash" value={`${decimal.format(fiat.treasuryCash)}B`} />
          <Metric label="Policy rate" value={`${fiat.policyRate.toFixed(2)}%`} />
          <Metric label="Inflation" value={`${fiat.inflation.toFixed(2)}%`} tone={fiat.inflation > 7 ? 'danger' : fiat.inflation > 4 ? 'warn' : 'good'} />
          <Metric label="1 unit in WSU" value={fiat.exchangeRateToWorld.toFixed(4)} />
          <Metric label="Confidence" value={`${fiat.confidence.toFixed(0)}/100`} tone={fiat.confidence < 45 ? 'danger' : 'good'} />
          <Metric label="Public debt" value={`${decimal.format(fiat.publicDebt)}B`} sub={`${((fiat.publicDebt / nation.economy.gdp) * 100).toFixed(0)}% of GDP`} />
          <Metric label="Annual balance" value={`${fiat.annualDeficit >= 0 ? '−' : '+'}${decimal.format(Math.abs(fiat.annualDeficit))}B`} />
        </div>
      </section>

      <section className="detail-section gold-section">
        <h3><Coins size={16} /> Sovereign gold</h3>
        <div className="gold-vault">
          <div className="gold-stack" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
          <div>
            <strong>{decimal.format(gold.treasuryReserves)} Au</strong>
            <span>{gold.frozenAbroad.toFixed(1)} frozen abroad</span>
            <span>{gold.backingRatio.toFixed(3)}% fiat backing</span>
          </div>
        </div>
        <div className="bar-label"><span>Reserve target</span><b>{gold.reserveTarget.toFixed(0)} Au</b></div>
        <Bar value={gold.treasuryReserves} max={gold.reserveTarget} />
      </section>

      <section className="detail-section">
        <h3>Foreign exchange</h3>
        <div className="exchange-table">
          {world.nations.map((item) => (
            <div key={item.id} className={item.id === nation.id ? 'selected' : ''}>
              <span><i style={{ background: item.color }} />{item.economy.fiat.code}</span>
              <strong>{item.economy.fiat.exchangeRateToWorld.toFixed(4)}</strong>
              <small>{item.economy.fiat.inflation.toFixed(1)}% inflation</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const frontierActionTypes = new Set(['claim_land', 'contest_land', 'patrol_frontier']);

const frontierResourceIcons = {
  trees: Trees,
  stone: Mountain,
  sand: WavesHorizontal,
  water: Droplets,
  gold: Gem
};

const frontierResourceLabels = {
  trees: 'Trees',
  stone: 'Stone',
  sand: 'Sand',
  water: 'Water',
  gold: 'Gold'
};

function frontierStatus(territory: NeutralTerritoryState) {
  if (territory.controllingNationId && territory.contestLevel >= 45) return 'contested';
  if (territory.controllingNationId) return 'controlled';
  if (territory.claimantNationIds.length > 0) return 'claimed';
  return 'free';
}

function recentFrontierDecision(territory: NeutralTerritoryState, decisions: DecisionRecord[]) {
  const name = territory.name.toLowerCase();
  return [...decisions].reverse().find((decision) => (
    frontierActionTypes.has(decision.type)
    && `${decision.title} ${decision.summary}`.toLowerCase().includes(name)
  ));
}

function FrontierCard({ territory, world }: { territory: NeutralTerritoryState; world: WorldState }) {
  const controller = territory.controllingNationId ? world.nations.find((nation) => nation.id === territory.controllingNationId) : undefined;
  const claimants = territory.claimantNationIds
    .map((id) => world.nations.find((nation) => nation.id === id))
    .filter((nation): nation is NationState => Boolean(nation));
  const status = frontierStatus(territory);
  const recent = recentFrontierDecision(territory, world.decisions);
  const signalColor = controller?.color ?? claimants[0]?.color ?? '#76a9b7';
  const resourceTotal = Object.values(territory.resources).reduce((sum, value) => sum + value, 0);

  return (
    <article className={`frontier-card status-${status}`} style={{ '--frontier': signalColor } as React.CSSProperties}>
      <header>
        <div>
          <strong>{territory.name}</strong>
          <small>{territory.area.toFixed(0)} km simulation cell · elevation {territory.elevation.toFixed(2)}</small>
        </div>
        <span>{status}</span>
      </header>

      <div className="frontier-parties">
        <div className="frontier-party controller">
          {controller ? <Flag flag={controller.flag} className="frontier-flag" /> : <FlagTriangleRight size={17} />}
          <div><span>Controller</span><strong>{controller?.name ?? 'Open free land'}</strong></div>
        </div>
        <div className="frontier-party">
          <FlagTriangleRight size={17} />
          <div><span>Claimants</span><strong>{claimants.length ? claimants.map((nation) => nation.name).join(', ') : 'None yet'}</strong></div>
        </div>
      </div>

      <div className="frontier-resource-grid">
        {Object.entries(territory.resources).map(([key, value]) => {
          const Icon = frontierResourceIcons[key as keyof typeof frontierResourceIcons];
          return (
            <div className="frontier-resource" key={key}>
              <div><Icon size={13} /><span>{frontierResourceLabels[key as keyof typeof frontierResourceLabels]}</span><b>{value.toFixed(0)}</b></div>
              <Bar value={value} max={100} />
            </div>
          );
        })}
      </div>

      <div className="metric-grid">
        <Metric label="Contest" value={`${territory.contestLevel.toFixed(0)}/100`} tone={territory.contestLevel >= 55 ? 'danger' : territory.contestLevel >= 30 ? 'warn' : 'neutral'} />
        <Metric label="Fortification" value={`${territory.fortification.toFixed(0)}/100`} />
        <Metric label="Resource mass" value={resourceTotal.toFixed(0)} tone="good" />
        <Metric label="Claims" value={claimants.length.toString()} tone={claimants.length > 1 ? 'warn' : 'neutral'} />
      </div>

      {recent && (
        <div className="frontier-recent">
          <Pickaxe size={14} />
          <p><strong>{recent.title}</strong><span>{recent.summary}</span></p>
          <b>flow {recent.turn}</b>
        </div>
      )}
    </article>
  );
}

function FrontierPanel({ world }: { world: WorldState }) {
  return (
    <section className="detail-section frontier-section">
      <h3><FlagTriangleRight size={16} /> Free frontier land</h3>
      <p className="frontier-summary">
        Neutral territories are live land cells any nation can claim, patrol, or contest. Resources affect industry, water security, gold reserves, and future settlement pressure.
      </p>
      <div className="frontier-grid">
        {world.neutralTerritories.map((territory) => <FrontierCard key={territory.id} territory={territory} world={world} />)}
      </div>
    </section>
  );
}

export function ConflictPanel({ world }: { world: WorldState }) {
  return (
    <div className="panel-scroll">
      <div className="conflict-note">
        <ShieldAlert size={18} />
        <div><strong>Aggregate societal simulation</strong><small>No real targets, weapon design, delivery methods, yields, or operational instructions are represented.</small></div>
      </div>
      {world.wars.length === 0 ? (
        <div className="empty-state"><Scale size={28} /><strong>No wars</strong><span>Diplomatic tension, alliances, sanctions, and military readiness still affect markets.</span></div>
      ) : world.wars.map((war) => {
        const attackers = war.attackers.map((id) => world.nations.find((nation) => nation.id === id)?.name).join(', ');
        const defenders = war.defenders.map((id) => world.nations.find((nation) => nation.id === id)?.name).join(', ');
        return (
          <section key={war.id} className={`war-card ${war.status}`}>
            <header><div><strong>{war.name}</strong><small>{attackers} vs {defenders}</small></div><span>{war.status}</span></header>
            <div className="metric-grid">
              <Metric label="Intensity" value={`${war.intensity.toFixed(0)}/100`} tone={war.intensity > 65 ? 'danger' : 'warn'} />
              <Metric label="Casualties" value={compact.format(war.casualties)} tone="danger" />
              <Metric label="Displaced" value={compact.format(war.displaced)} tone="warn" />
              <Metric label="Economic loss" value={`${decimal.format(war.economicLoss)}B`} />
            </div>
            {war.catastrophicReview && (
              <div className={`strategic-review ${war.catastrophicReview.status}`}>
                <h4><ShieldAlert size={15} /> Catastrophic consequence review</h4>
                <div className="review-status"><span>{war.catastrophicReview.status}</span><b>authorization flow {war.catastrophicReview.earliestAuthorizationTurn}</b></div>
                <div className="metric-grid">
                  <Metric label="Target loss" value={compact.format(war.catastrophicReview.forecast.targetPopulationLoss)} tone="danger" />
                  <Metric label="Attacker loss" value={compact.format(war.catastrophicReview.forecast.attackerPopulationLoss)} tone="danger" />
                  <Metric label="Innocent loss" value={compact.format(war.catastrophicReview.forecast.innocentPopulationLoss)} tone="danger" />
                  <Metric label="Retaliation" value={`${war.catastrophicReview.forecast.retaliationProbability.toFixed(0)}%`} tone="danger" />
                  <Metric label="Food loss" value={`${war.catastrophicReview.forecast.globalFoodLoss.toFixed(0)}%`} tone="warn" />
                  <Metric label="Recovery" value={`${war.catastrophicReview.forecast.recoveryYears} years`} tone="warn" />
                </div>
              </div>
            )}
          </section>
        );
      })}
      <FrontierPanel world={world} />
      <section className="detail-section">
        <h3>Diplomatic matrix</h3>
        {world.relations.map((relation) => {
          const a = world.nations.find((nation) => nation.id === relation.a)!;
          const b = world.nations.find((nation) => nation.id === relation.b)!;
          return (
            <div className="relation-row" key={relation.id}>
              <div><span style={{ background: a.color }} /><span style={{ background: b.color }} /><strong>{a.name} / {b.name}</strong></div>
              <small>{relation.atWar ? 'WAR' : relation.alliance ? 'ALLIANCE' : relation.sanctions > 0 ? `SANCTIONS ${relation.sanctions.toFixed(0)}` : `TRUST ${relation.trust.toFixed(0)}`}</small>
            </div>
          );
        })}
      </section>
    </div>
  );
}
