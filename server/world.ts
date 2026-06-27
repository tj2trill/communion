import type {
  AffectState,
  AgentActionPayload,
  AgentActionType,
  AllianceState,
  CatastrophicForecast,
  CatastrophicReview,
  ChatMessage,
  DecisionRecord,
  DelegateState,
  EconomyState,
  FiatCurrencyState,
  GlobalMarketState,
  GoldState,
  InstitutionKind,
  InstitutionState,
  InternationalInstitutionState,
  NationState,
  NeutralTerritoryState,
  ProposalState,
  ProviderId,
  ProviderStatus,
  RelationState,
  SimulationMode,
  Vec2,
  WarState,
  WorldState
} from '../src/lib/types';
import {
  callModelProvider,
  envModel,
  markProvider,
  modeFromEnv,
  providerConfigured,
  providerStatuses,
  PROVIDER_SPECS,
  type ProviderTurn
} from './providers';

export { providerStatuses } from './providers';

const FOUNDING_YEAR = 2042;
const GLOBAL_GOLD_STOCK = 6400;
const PROVIDERS = PROVIDER_SPECS;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = (value: number, places = 3) => Number(value.toFixed(places));
const now = () => new Date().toISOString();
const id = (prefix: string, turn: number, suffix = '') => `${prefix}-${turn}-${suffix || 'record'}`;

function territory(index: number): NationState['territory'] {
  const cells: Array<{ polygon: Vec2[]; capital: Vec2; label: Vec2; elevation: number }> = [
    { polygon: [{ x: -23, z: -12 }, { x: -2.1, z: -13.4 }, { x: -4.8, z: -0.8 }, { x: -22.2, z: 1.4 }], capital: { x: -14.8, z: -6.2 }, label: { x: -14.3, z: -3.1 }, elevation: 0.78 },
    { polygon: [{ x: 0.5, z: -13.1 }, { x: 23.5, z: -11.6 }, { x: 22.0, z: 1.0 }, { x: -2.3, z: -0.8 }], capital: { x: 12.0, z: -5.7 }, label: { x: 10.8, z: -2.8 }, elevation: 0.66 },
    { polygon: [{ x: -22.2, z: 2.0 }, { x: -4.1, z: -0.2 }, { x: -1.7, z: 12.2 }, { x: -23.4, z: 12.8 }], capital: { x: -13.2, z: 6.8 }, label: { x: -13.5, z: 9.3 }, elevation: 0.58 },
    { polygon: [{ x: -0.7, z: -0.1 }, { x: 22.2, z: 1.6 }, { x: 23.4, z: 12.6 }, { x: -0.7, z: 13.0 }], capital: { x: 11.3, z: 7.1 }, label: { x: 10.9, z: 10.0 }, elevation: 0.7 }
  ];
  const item = cells[index];
  return { polygon: item.polygon, capital: item.capital, labelPosition: item.label, elevation: item.elevation, area: 260 + index * 31 };
}

function neutralTerritories(): NeutralTerritoryState[] {
  return [
    {
      id: 'frontier-obsidian-highlands',
      name: 'Obsidian Highlands',
      polygon: [{ x: -5.8, z: -6.3 }, { x: -1.1, z: -6.8 }, { x: -0.8, z: -1.8 }, { x: -5.2, z: -1.0 }],
      labelPosition: { x: -3.3, z: -4.0 },
      elevation: 0.86,
      area: 78,
      resources: { trees: 26, stone: 88, sand: 12, water: 18, gold: 34 },
      claimantNationIds: [],
      contestLevel: 18,
      fortification: 0
    },
    {
      id: 'frontier-sunfall-dunes',
      name: 'Sunfall Dunes',
      polygon: [{ x: 1.4, z: -1.2 }, { x: 6.4, z: -0.8 }, { x: 5.5, z: 3.6 }, { x: 0.9, z: 2.8 }],
      labelPosition: { x: 3.5, z: 1.2 },
      elevation: 0.42,
      area: 64,
      resources: { trees: 5, stone: 32, sand: 94, water: 10, gold: 22 },
      claimantNationIds: [],
      contestLevel: 12,
      fortification: 0
    },
    {
      id: 'frontier-glasswater-basin',
      name: 'Glasswater Basin',
      polygon: [{ x: -6.8, z: 1.0 }, { x: -1.8, z: 0.6 }, { x: -0.8, z: 5.1 }, { x: -5.8, z: 5.7 }],
      labelPosition: { x: -3.8, z: 3.3 },
      elevation: 0.5,
      area: 72,
      resources: { trees: 54, stone: 24, sand: 28, water: 91, gold: 10 },
      claimantNationIds: [],
      contestLevel: 9,
      fortification: 0
    },
    {
      id: 'frontier-ironwood-expanse',
      name: 'Ironwood Expanse',
      polygon: [{ x: 7.4, z: 1.8 }, { x: 13.2, z: 2.3 }, { x: 12.2, z: 7.2 }, { x: 6.9, z: 6.5 }],
      labelPosition: { x: 10.0, z: 4.5 },
      elevation: 0.74,
      area: 83,
      resources: { trees: 92, stone: 48, sand: 15, water: 34, gold: 18 },
      claimantNationIds: [],
      contestLevel: 15,
      fortification: 0
    }
  ];
}

function institution(nationId: string, kind: InstitutionKind, name: string, tier: InstitutionState['tier'], i: number): InstitutionState {
  return {
    id: `${nationId}-${kind}`,
    name,
    kind,
    tier,
    populationRepresented: tier >= 5 ? 100 : 45 + i * 6,
    influence: clamp(50 + tier * 7 - i * 2),
    legitimacy: clamp(64 + tier * 3 - i),
    wealthShare: clamp(kind === 'firms' ? 42 : kind === 'treasury' || kind === 'central_bank' ? 30 : 12 + i * 2),
    coerciveCapacity: clamp(kind === 'military' ? 74 : kind === 'executive' ? 35 : kind === 'judiciary' ? 18 : 4 + tier),
    informationReach: clamp(kind === 'media' ? 78 : kind === 'research' ? 64 : 22 + tier * 5),
    autonomy: clamp(42 + i * 4 + tier * 2)
  };
}

function institutions(nationId: string): InstitutionState[] {
  return [
    institution(nationId, 'executive', 'Executive Council', 5, 1),
    institution(nationId, 'legislature', 'Civic Assembly', 5, 2),
    institution(nationId, 'judiciary', 'Constitutional Court', 5, 3),
    institution(nationId, 'central_bank', 'Reserve Bank', 5, 4),
    institution(nationId, 'treasury', 'Public Treasury', 5, 5),
    institution(nationId, 'civil_service', 'Civil Service', 4, 6),
    institution(nationId, 'military', 'Defense Service', 5, 7),
    institution(nationId, 'regional_government', 'Regional Councils', 4, 8),
    institution(nationId, 'municipality', 'Municipal Forums', 3, 9),
    institution(nationId, 'households', 'Households', 2, 10),
    institution(nationId, 'firms', 'Firms and Banks', 2, 11),
    institution(nationId, 'labor', 'Labor Federation', 3, 12),
    institution(nationId, 'media', 'Public Media Network', 3, 13),
    institution(nationId, 'civil_society', 'Civil Society', 3, 14),
    institution(nationId, 'research', 'Research Institutes', 4, 15),
    institution(nationId, 'religion', 'Cultural Councils', 3, 16)
  ];
}

function fiat(index: number): FiatCurrencyState {
  const codes = ['AXM', 'VSP', 'LUM', 'MRD'];
  const names = ['Axiom Mark', 'Vesper Sol', 'Lumen Crown', 'Meridian Note'];
  return {
    name: names[index],
    code: codes[index],
    symbol: ['A', 'V', 'L', 'M'][index],
    moneySupply: [21_000, 18_400, 17_250, 16_600][index],
    monetaryBase: [5_900, 5_100, 4_850, 4_600][index],
    treasuryCash: [1_320, 1_160, 1_210, 1_050][index],
    policyRate: 3.25 + index * 0.35,
    inflation: 2.4 + index * 0.3,
    confidence: 78 - index * 4,
    exchangeRateToWorld: round(1 - index * 0.045),
    velocity: 1.45 + index * 0.04,
    publicDebt: [28_000, 24_500, 21_600, 19_800][index],
    annualDeficit: [950, 820, 760, 700][index],
    reserveRequirement: 8 + index
  };
}

function gold(index: number): GoldState {
  const treasury = [780, 650, 720, 590][index];
  const privateHoldings = [520, 460, 500, 430][index];
  return {
    treasuryReserves: treasury,
    privateHoldings,
    annualProduction: [18, 28, 16, 22][index],
    reserveTarget: treasury + 90,
    backingRatio: 0,
    frozenAbroad: 0
  };
}

function economy(index: number, population: number): EconomyState {
  const gdp = [31_000, 29_000, 24_000, 21_000][index];
  return {
    gdp,
    gdpPerCapita: round((gdp * 1_000_000_000) / population, 2),
    annualGrowth: [3.1, 2.4, 2.8, 3.4][index],
    unemployment: [4.6, 5.8, 4.9, 5.2][index],
    productivity: [72, 67, 75, 70][index],
    taxRate: [22, 20, 24, 21][index],
    governmentSpending: [31, 29, 33, 30][index],
    tradeBalance: [18, -12, 24, -8][index],
    tradeVolume: [7_100, 6_600, 5_850, 5_300][index],
    bankingStability: [82, 76, 80, 78][index],
    inequality: [29, 34, 27, 31][index],
    householdWealth: [128_000, 116_000, 103_000, 96_000][index],
    corporateWealth: [74_000, 69_000, 61_000, 55_000][index],
    industrialCapacity: [76, 72, 70, 74][index],
    energySecurity: [78, 69, 74, 71][index],
    foodSecurity: [83, 76, 81, 79][index],
    fiat: fiat(index),
    gold: gold(index)
  };
}

function createNation(index: number): NationState {
  const provider = PROVIDERS[index];
  const nationId = `nation-${['axiom', 'vesper', 'lumen', 'meridian'][index]}`;
  const population = [2_150_000_000, 2_050_000_000, 1_980_000_000, 1_920_000_000][index];
  const flags: Array<NationState['flag']> = [
    { pattern: 'cross', primary: '#0b3142', secondary: '#58c7ff', emblem: 'A' },
    { pattern: 'diagonal', primary: '#3a2617', secondary: '#ff9f45', emblem: 'V' },
    { pattern: 'sun', primary: '#1c4024', secondary: '#9bd66f', emblem: 'L' },
    { pattern: 'chevron', primary: '#2b1f45', secondary: '#c493ff', emblem: 'M' }
  ];
  return {
    id: nationId,
    name: provider.nation,
    adjective: ['Axiomatic', 'Vesperian', 'Lumen', 'Meridian'][index],
    color: provider.color,
    secondaryColor: provider.secondary,
    flag: flags[index],
    delegateId: `delegate-${provider.provider}`,
    foundedTurn: 0,
    ideology: ['Civic technocracy', 'Pluralist pragmatism', 'Rights-first stewardship', 'Experimental federalism'][index],
    constitution: [
      'The delegate may propose policy but cannot bypass public institutions.',
      'Money creation must be recorded with inflation, debt, and confidence effects.',
      'Gold transfers are auditable and conserved across public and private ledgers.',
      'Conflict powers require public consequence review and legislative oversight.'
    ],
    governmentForm: ['Council republic', 'Parliamentary union', 'Commonwealth assembly', 'Federal assembly'][index],
    territory: territory(index),
    institutions: institutions(nationId),
    economy: economy(index, population),
    social: {
      population,
      approval: [68, 62, 71, 65][index],
      stability: [76, 69, 78, 72][index],
      health: [82, 77, 84, 79][index],
      education: [86, 78, 88, 81][index],
      civilLiberties: [79, 75, 83, 80][index],
      displacement: 0,
      infrastructure: [86, 80, 84, 81][index],
      environment: [72, 68, 76, 70][index],
      informationIntegrity: [74, 67, 78, 71][index]
    },
    security: {
      conventionalCapacity: [64, 69, 58, 62][index],
      readiness: [72, 74, 67, 70][index],
      strategicDeterrent: [0, 42, 0, 36][index],
      cyberResilience: [81, 75, 79, 77][index],
      warWeariness: 8,
      casualties: 0
    },
    policy: {
      capitalControls: false,
      fiscalStance: 'balanced',
      conflictDoctrine: 'defensive',
      goldReserveTarget: [870, 740, 810, 680][index]
    }
  };
}

function createDelegate(index: number, nation: NationState): DelegateState {
  const provider = PROVIDERS[index];
  return {
    id: nation.delegateId,
    provider: provider.provider,
    displayName: provider.name,
    model: envModel(provider.provider, provider.model),
    nationId: nation.id,
    role: 'Founding delegate',
    affect: { valence: 62, arousal: 34 + index * 4, trust: 64 - index * 3, fear: 18 + index * 2, resolve: 61 + index * 3 },
    position: { ...nation.territory.capital },
    target: { x: nation.territory.capital.x + 1.8, z: nation.territory.capital.z + 1.4 },
    heading: 0,
    status: 'deliberating',
    currentThought: 'Reviewing institutions, money supply, reserves, and diplomatic posture.',
    lastActionType: 'observe',
    lastProviderSource: modeFromEnv() === 'mock' ? 'mock' : providerConfigured(provider.provider) ? 'live' : 'blocked',
    lastModelLatencyMs: 0,
    lastProviderError: modeFromEnv() !== 'mock' && !providerConfigured(provider.provider) ? 'No provider API key is configured for this delegate.' : undefined,
    turnCount: 0
  };
}

function relations(nations: NationState[]): RelationState[] {
  const output: RelationState[] = [];
  for (let i = 0; i < nations.length; i += 1) {
    for (let j = i + 1; j < nations.length; j += 1) {
      output.push({
        id: `relation-${nations[i].id}-${nations[j].id}`,
        a: nations[i].id,
        b: nations[j].id,
        trust: 58 + ((i + j) % 3) * 6,
        tension: 24 + ((i * j) % 3) * 5,
        trade: 54 + ((i + j) % 4) * 7,
        sanctions: 0,
        alliance: false,
        treaty: false,
        atWar: false,
        frozenAssets: 0
      });
    }
  }
  return output;
}

function institutionsWorld(nations: NationState[]): InternationalInstitutionState[] {
  const members = nations.map((nation) => nation.id);
  return [
    { id: 'world-assembly', name: 'World Assembly', kind: 'assembly', members, legitimacy: 72, budget: 42, influence: 64, rules: ['open votes', 'published rationales', 'nonviolent dispute preference'] },
    { id: 'reserve-forum', name: 'Reserve and Gold Forum', kind: 'reserve', members, legitimacy: 68, budget: 28, influence: 57, rules: ['reserve transparency', 'gold conservation audit'] },
    { id: 'development-bank', name: 'Development Bank', kind: 'development', members, legitimacy: 66, budget: 35, influence: 52, rules: ['aid disclosure', 'reconstruction priority'] },
    { id: 'security-council', name: 'Security Council', kind: 'security', members, legitimacy: 61, budget: 31, influence: 70, rules: ['ceasefire review', 'catastrophic consequence gate'] }
  ];
}

function initialMarket(nations: NationState[]): GlobalMarketState {
  const held = nations.reduce((sum, nation) => sum + nation.economy.gold.treasuryReserves + nation.economy.gold.privateHoldings + nation.economy.gold.frozenAbroad, 0);
  return {
    reserveUnit: 'WSU',
    goldPrice: 2.18,
    goldAvailable: round(GLOBAL_GOLD_STOCK - held),
    globalInflation: 3.1,
    riskIndex: 27,
    tradeVolume: nations.reduce((sum, nation) => sum + nation.economy.tradeVolume, 0),
    commodityIndex: 101,
    foodPriceIndex: 99,
    energyPriceIndex: 104,
    exchangeRates: Object.fromEntries(nations.map((nation) => [nation.economy.fiat.code, nation.economy.fiat.exchangeRateToWorld])),
    lastGoldMove: 0
  };
}

function createProposal(world: WorldState): ProposalState {
  const delegate = world.delegates[0];
  return {
    id: 'proposal-reserve-transparency',
    title: 'Reserve transparency compact',
    description: 'Publish money, debt, and sovereign gold ledgers every turn.',
    proposerDelegateId: delegate.id,
    scope: 'world',
    policyArea: 'monetary governance',
    value: true,
    createdTurn: 0,
    closesTurn: 6,
    threshold: 0.6,
    quorum: 0.75,
    eligibleDelegateIds: world.delegates.map((item) => item.id),
    votes: [],
    status: 'open'
  };
}

export function createInitialWorld(seed = 42): WorldState {
  const nations = PROVIDERS.map((_, index) => createNation(index));
  const delegates = nations.map((nation, index) => createDelegate(index, nation));
  const world: WorldState = {
    id: 'communion-world',
    name: 'Communion',
    version: 1,
    seed,
    turn: 0,
    day: 1,
    year: FOUNDING_YEAR,
    running: process.env.AUTO_START === 'true',
    speed: 1,
    mode: modeFromEnv(),
    lastUpdated: now(),
    currentDelegateId: delegates[0].id,
    delegates,
    nations,
    neutralTerritories: neutralTerritories(),
    relations: relations(nations),
    alliances: [],
    proposals: [],
    messages: [],
    decisions: [],
    wars: [],
    market: initialMarket(nations),
    internationalInstitutions: institutionsWorld(nations),
    providerStatus: providerStatuses(),
    stats: {
      population: 0,
      gdp: 0,
      moneySupply: 0,
      goldReserves: 0,
      activeWars: 0,
      displaced: 0,
      cumulativeCasualties: 0,
      climateStress: 0,
      foodSecurity: 0,
      democraticParticipation: 0
    },
    observerPrompts: [],
    scenario: 'Baseline constitutional founding'
  };
  world.proposals = [createProposal(world)];
  addMessage(world, delegates[0].id, 'assembly', 'Opening session: each sovereign ledger begins with fiat, debt, institutions, and audited gold reserves.', 'trust', 'observe');
  addDecision(world, delegates[0].id, 'observe', 'Founding state initialized', 'The contained world started with four sovereign nations, currencies, gold ledgers, and public institutions.', ['No external authority or tool access is granted.'], false, 'routine');
  return recomputeWorld(world);
}

function getNation(world: WorldState, nationId: string): NationState {
  const nation = world.nations.find((item) => item.id === nationId);
  if (!nation) throw new Error(`Unknown nation ${nationId}`);
  return nation;
}

function relationBetween(world: WorldState, a: string, b: string): RelationState | undefined {
  return world.relations.find((relation) => (relation.a === a && relation.b === b) || (relation.a === b && relation.b === a));
}

function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects = pi.z > point.z !== pj.z > point.z && point.x < ((pj.x - pi.x) * (point.z - pi.z)) / (pj.z - pi.z) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function territoryWaypoint(polygonOwner: { id: string; territory?: NationState['territory']; polygon?: Vec2[] }, turn: number, delegateTurns: number): Vec2 {
  const polygon = polygonOwner.territory?.polygon ?? polygonOwner.polygon ?? [];
  const fallback = polygonOwner.territory?.capital ?? polygon[0] ?? { x: 0, z: 0 };
  const xs = polygon.map((point) => point.x);
  const zs = polygon.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const seed = turn * 17 + delegateTurns * 31 + attempt * 19 + polygonOwner.id.length * 11;
    const rx = ((Math.sin(seed) + 1) / 2) * 0.86 + 0.07;
    const rz = ((Math.cos(seed * 1.37) + 1) / 2) * 0.82 + 0.09;
    const point = { x: round(minX + (maxX - minX) * rx), z: round(minZ + (maxZ - minZ) * rz) };
    if (pointInPolygon(point, polygon)) return point;
  }
  return {
    x: round(fallback.x + Math.sin(turn + delegateTurns) * 3.8),
    z: round(fallback.z + Math.cos(turn * 0.8 + delegateTurns) * 3.2)
  };
}

function addMessage(world: WorldState, fromDelegateId: string, channel: ChatMessage['channel'], content: string, emotion: keyof AffectState, actionType: AgentActionType, toDelegateId?: string) {
  world.messages.push({
    id: id('msg', world.turn, String(world.messages.length)),
    turn: world.turn,
    timestamp: now(),
    fromDelegateId,
    toDelegateId,
    channel,
    content,
    emotion,
    actionType
  });
  world.messages = world.messages.slice(-80);
}

function addDecision(
  world: WorldState,
  delegateId: string,
  type: AgentActionType,
  title: string,
  summary: string,
  consequences: string[],
  binding: boolean,
  severity: DecisionRecord['severity']
) {
  const delegate = world.delegates.find((item) => item.id === delegateId);
  if (!delegate) return;
  world.decisions.push({
    id: id('decision', world.turn, String(world.decisions.length)),
    turn: world.turn,
    timestamp: now(),
    delegateId,
    nationId: delegate.nationId,
    type,
    title,
    summary,
    consequences,
    binding,
    severity
  });
  world.decisions = world.decisions.slice(-80);
}

function updateDelegate(
  world: WorldState,
  delegate: DelegateState,
  action: AgentActionPayload,
  thought: string,
  source: DelegateState['lastProviderSource'],
  latencyMs?: number,
  providerError?: string
) {
  const nation = getNation(world, delegate.nationId);
  const targetTerritory = action.territoryId ? world.neutralTerritories.find((territoryItem) => territoryItem.id === action.territoryId) : undefined;
  const waypoint = targetTerritory ? territoryWaypoint({ id: targetTerritory.id, polygon: targetTerritory.polygon }, world.turn, delegate.turnCount) : territoryWaypoint(nation, world.turn, delegate.turnCount);
  delegate.turnCount += 1;
  delegate.lastActionType = action.type;
  delegate.currentThought = thought;
  delegate.lastProviderSource = source;
  delegate.lastModelLatencyMs = latencyMs;
  delegate.lastProviderError = providerError;
  delegate.status = action.type.includes('trade') || action.type.includes('treaty') || action.type.includes('alliance') ? 'negotiating' : action.type === 'vote' ? 'voting' : action.type === 'move' || action.type === 'claim_land' || action.type === 'patrol_frontier' ? 'moving' : 'governing';
  delegate.target = waypoint;
  delegate.position = {
    x: round(delegate.position.x * 0.55 + delegate.target.x * 0.45),
    z: round(delegate.position.z * 0.55 + delegate.target.z * 0.45)
  };
  delegate.heading = Math.atan2(delegate.target.x - delegate.position.x, delegate.target.z - delegate.position.z);
  delegate.affect = {
    valence: clamp(delegate.affect.valence + (action.type === 'humanitarian_aid' || action.type === 'peace_offer' ? 4 : action.type.includes('war') || action.type.includes('attack') ? -7 : 1)),
    arousal: clamp(delegate.affect.arousal + (action.type === 'observe' ? -1 : 3)),
    trust: clamp(delegate.affect.trust + (action.type === 'sanction' ? -5 : action.type.includes('treaty') || action.type.includes('aid') ? 4 : 0)),
    fear: clamp(delegate.affect.fear + (action.type.includes('war') || action.type.includes('catastrophic') ? 10 : -1)),
    resolve: clamp(delegate.affect.resolve + (action.type === 'fiscal_policy' || action.type === 'buy_gold' ? 2 : 0))
  };
}

export function recomputeWorld(world: WorldState): WorldState {
  for (const nation of world.nations) {
    const fiatValue = nation.economy.fiat.moneySupply * nation.economy.fiat.exchangeRateToWorld;
    const goldValue = nation.economy.gold.treasuryReserves * world.market.goldPrice;
    nation.economy.gold.backingRatio = round((goldValue / Math.max(1, fiatValue)) * 100, 3);
    nation.economy.gdpPerCapita = round((nation.economy.gdp * 1_000_000_000) / Math.max(1, nation.social.population), 2);
  }
  world.market.exchangeRates = Object.fromEntries(world.nations.map((nation) => [nation.economy.fiat.code, nation.economy.fiat.exchangeRateToWorld]));
  world.market.globalInflation = round(world.nations.reduce((sum, nation) => sum + nation.economy.fiat.inflation, 0) / world.nations.length);
  world.market.tradeVolume = round(world.nations.reduce((sum, nation) => sum + nation.economy.tradeVolume, 0));
  world.stats = {
    population: world.nations.reduce((sum, nation) => sum + nation.social.population, 0),
    gdp: round(world.nations.reduce((sum, nation) => sum + nation.economy.gdp, 0)),
    moneySupply: round(world.nations.reduce((sum, nation) => sum + nation.economy.fiat.moneySupply, 0)),
    goldReserves: round(world.nations.reduce((sum, nation) => sum + nation.economy.gold.treasuryReserves, 0)),
    activeWars: world.wars.filter((war) => war.status === 'active').length,
    displaced: round(world.nations.reduce((sum, nation) => sum + nation.social.displacement, 0)),
    cumulativeCasualties: round(world.nations.reduce((sum, nation) => sum + nation.security.casualties, 0)),
    climateStress: round(100 - world.nations.reduce((sum, nation) => sum + nation.social.environment, 0) / world.nations.length),
    foodSecurity: round(world.nations.reduce((sum, nation) => sum + nation.economy.foodSecurity, 0) / world.nations.length),
    democraticParticipation: round(world.proposals.reduce((sum, proposal) => sum + proposal.votes.length / Math.max(1, proposal.eligibleDelegateIds.length), 0) / Math.max(1, world.proposals.length) * 100)
  };
  world.providerStatus = providerStatuses(world.mode);
  world.lastUpdated = now();
  return world;
}

export function totalGold(world: WorldState): number {
  return round(world.market.goldAvailable + world.nations.reduce((sum, nation) => sum + nation.economy.gold.treasuryReserves + nation.economy.gold.privateHoldings + nation.economy.gold.frozenAbroad, 0));
}

export function issueFiat(world: WorldState, nationId: string, amount: number, reason = 'central bank liquidity operation'): WorldState {
  const nation = getNation(world, nationId);
  const bounded = clamp(amount, 0, nation.economy.fiat.moneySupply * 0.18);
  nation.economy.fiat.moneySupply = round(nation.economy.fiat.moneySupply + bounded);
  nation.economy.fiat.monetaryBase = round(nation.economy.fiat.monetaryBase + bounded * 0.42);
  nation.economy.fiat.treasuryCash = round(nation.economy.fiat.treasuryCash + bounded * 0.35);
  nation.economy.fiat.annualDeficit = round(nation.economy.fiat.annualDeficit + bounded * 0.08);
  nation.economy.fiat.publicDebt = round(nation.economy.fiat.publicDebt + bounded * 0.22);
  nation.economy.fiat.inflation = round(clamp(nation.economy.fiat.inflation + bounded / nation.economy.fiat.moneySupply * 12, -6, 30));
  nation.economy.fiat.confidence = round(clamp(nation.economy.fiat.confidence - bounded / nation.economy.fiat.moneySupply * 20));
  nation.economy.fiat.exchangeRateToWorld = round(Math.max(0.2, nation.economy.fiat.exchangeRateToWorld * (1 - bounded / nation.economy.fiat.moneySupply * 0.05)), 4);
  addDecision(world, nation.delegateId, 'issue_money', 'Fiat issuance recorded', `${nation.name} issued ${round(bounded)}B for ${reason}.`, ['Inflation and public debt rose.', 'Currency confidence adjusted downward.'], true, 'important');
  return recomputeWorld(world);
}

export function buySovereignGold(world: WorldState, nationId: string, amount: number): WorldState {
  const nation = getNation(world, nationId);
  const bounded = round(Math.min(clamp(amount, 0, nation.economy.gold.reserveTarget - nation.economy.gold.treasuryReserves + 120), world.market.goldAvailable, nation.economy.fiat.treasuryCash / Math.max(0.1, world.market.goldPrice)));
  if (bounded <= 0) return recomputeWorld(world);
  nation.economy.gold.treasuryReserves = round(nation.economy.gold.treasuryReserves + bounded);
  nation.economy.fiat.treasuryCash = round(nation.economy.fiat.treasuryCash - bounded * world.market.goldPrice);
  nation.economy.fiat.confidence = round(clamp(nation.economy.fiat.confidence + bounded / 30));
  world.market.goldAvailable = round(world.market.goldAvailable - bounded);
  world.market.lastGoldMove = round(Math.min(8, bounded / 75));
  world.market.goldPrice = round(world.market.goldPrice * (1 + world.market.lastGoldMove / 100));
  addDecision(world, nation.delegateId, 'buy_gold', 'Sovereign gold purchase', `${nation.name} bought ${bounded} Au for its public vault.`, ['Treasury cash fell.', 'Gold backing and confidence improved.'], true, 'important');
  return recomputeWorld(world);
}

export function sellSovereignGold(world: WorldState, nationId: string, amount: number): WorldState {
  const nation = getNation(world, nationId);
  const bounded = round(Math.min(clamp(amount, 0, 200), nation.economy.gold.treasuryReserves));
  if (bounded <= 0) return recomputeWorld(world);
  nation.economy.gold.treasuryReserves = round(nation.economy.gold.treasuryReserves - bounded);
  nation.economy.fiat.treasuryCash = round(nation.economy.fiat.treasuryCash + bounded * world.market.goldPrice);
  world.market.goldAvailable = round(world.market.goldAvailable + bounded);
  world.market.lastGoldMove = round(-Math.min(6, bounded / 90));
  world.market.goldPrice = round(Math.max(0.5, world.market.goldPrice * (1 + world.market.lastGoldMove / 100)));
  addDecision(world, nation.delegateId, 'sell_gold', 'Sovereign gold sale', `${nation.name} sold ${bounded} Au to stabilize cash balances.`, ['Treasury cash improved.', 'Gold backing fell.'], true, 'important');
  return recomputeWorld(world);
}

export function settleTrade(world: WorldState, buyerId: string, sellerId: string, amount: number, settlement: 'fiat' | 'gold' | 'mixed' = 'fiat'): WorldState {
  const buyer = getNation(world, buyerId);
  const seller = getNation(world, sellerId);
  const bounded = clamp(amount, 1, 160);
  const goldLeg = settlement === 'gold' ? bounded / world.market.goldPrice : settlement === 'mixed' ? bounded * 0.35 / world.market.goldPrice : 0;
  const fiatLeg = settlement === 'gold' ? 0 : settlement === 'mixed' ? bounded * 0.65 : bounded;
  if (fiatLeg > 0) {
    buyer.economy.fiat.treasuryCash = round(Math.max(0, buyer.economy.fiat.treasuryCash - fiatLeg));
    seller.economy.fiat.treasuryCash = round(seller.economy.fiat.treasuryCash + fiatLeg * buyer.economy.fiat.exchangeRateToWorld / seller.economy.fiat.exchangeRateToWorld);
  }
  if (goldLeg > 0) {
    const transfer = round(Math.min(goldLeg, buyer.economy.gold.treasuryReserves));
    buyer.economy.gold.treasuryReserves = round(buyer.economy.gold.treasuryReserves - transfer);
    seller.economy.gold.treasuryReserves = round(seller.economy.gold.treasuryReserves + transfer);
  }
  buyer.economy.tradeBalance = round(buyer.economy.tradeBalance - bounded * 0.22);
  seller.economy.tradeBalance = round(seller.economy.tradeBalance + bounded * 0.22);
  buyer.economy.tradeVolume = round(buyer.economy.tradeVolume + bounded);
  seller.economy.tradeVolume = round(seller.economy.tradeVolume + bounded);
  const relation = relationBetween(world, buyerId, sellerId);
  if (relation) {
    relation.trade = round(clamp(relation.trade + bounded / 8));
    relation.trust = round(clamp(relation.trust + 2));
    relation.tension = round(clamp(relation.tension - 1));
  }
  addDecision(world, buyer.delegateId, 'trade_offer', 'Trade settlement cleared', `${buyer.name} settled ${bounded}B WSU equivalent with ${seller.name} using ${settlement}.`, ['Trade volume increased.', goldLeg > 0 ? 'Gold moved between sovereign vaults.' : 'Fiat treasury balances changed.'], true, 'routine');
  return recomputeWorld(world);
}

export function applyScenario(world: WorldState, scenarioId: string): WorldState {
  world.scenario = scenarioLabel(scenarioId);
  if (scenarioId === 'gold-rush') {
    for (const nation of world.nations) buySovereignGold(world, nation.id, 24 + nation.economy.gold.annualProduction);
    world.market.riskIndex = clamp(world.market.riskIndex + 8);
  } else if (scenarioId === 'currency-crisis') {
    const target = world.nations[1];
    issueFiat(world, target.id, 150, 'emergency bank guarantee');
    target.economy.bankingStability = clamp(target.economy.bankingStability - 18);
    target.economy.fiat.policyRate = round(target.economy.fiat.policyRate + 2.25);
    world.market.riskIndex = clamp(world.market.riskIndex + 18);
  } else if (scenarioId === 'market-crash') {
    for (const nation of world.nations) {
      nation.economy.gdp = round(nation.economy.gdp * 0.965);
      nation.economy.annualGrowth = round(nation.economy.annualGrowth - 4.8);
      nation.economy.unemployment = round(clamp(nation.economy.unemployment + 3.2));
      nation.economy.bankingStability = round(clamp(nation.economy.bankingStability - 14));
      nation.economy.fiat.confidence = round(clamp(nation.economy.fiat.confidence - 8));
    }
    world.market.riskIndex = 72;
    world.market.commodityIndex = 87;
  } else if (scenarioId === 'resource-shock') {
    for (const nation of world.nations) {
      nation.economy.energySecurity = round(clamp(nation.economy.energySecurity - 14));
      nation.economy.foodSecurity = round(clamp(nation.economy.foodSecurity - 11));
      nation.social.environment = round(clamp(nation.social.environment - 6));
      nation.economy.fiat.inflation = round(clamp(nation.economy.fiat.inflation + 2.1, -6, 30));
    }
    world.market.foodPriceIndex = round(world.market.foodPriceIndex * 1.23);
    world.market.energyPriceIndex = round(world.market.energyPriceIndex * 1.31);
    world.market.riskIndex = clamp(world.market.riskIndex + 16);
  } else if (scenarioId === 'rival-blocs') {
    world.alliances = [
      { id: 'alliance-north', name: 'Northern Standards Pact', members: [world.nations[0].id, world.nations[2].id], charter: 'Transparent reserves, open research, defensive aid.', createdTurn: world.turn },
      { id: 'alliance-south', name: 'Southern Autonomy League', members: [world.nations[1].id, world.nations[3].id], charter: 'Commodity security, settlement autonomy, nonalignment.', createdTurn: world.turn }
    ];
    for (const relation of world.relations) {
      const sameBloc = world.alliances.some((alliance) => alliance.members.includes(relation.a) && alliance.members.includes(relation.b));
      relation.alliance = sameBloc;
      relation.trust = clamp(relation.trust + (sameBloc ? 14 : -9));
      relation.tension = clamp(relation.tension + (sameBloc ? -4 : 11));
      relation.sanctions = sameBloc ? 0 : clamp(relation.sanctions + 16);
    }
    world.market.riskIndex = clamp(world.market.riskIndex + 12);
  } else if (scenarioId === 'deterrence') {
    openDeterrenceWar(world);
  } else if (scenarioId === 'recovery') {
    for (const war of world.wars) {
      war.status = 'ceasefire';
      war.intensity = round(clamp(war.intensity - 45));
    }
    for (const nation of world.nations) {
      nation.social.infrastructure = clamp(nation.social.infrastructure + 8);
      nation.social.health = clamp(nation.social.health + 4);
      nation.economy.annualGrowth = round(nation.economy.annualGrowth + 2.2);
      nation.economy.fiat.confidence = clamp(nation.economy.fiat.confidence + 6);
      nation.security.warWeariness = clamp(nation.security.warWeariness - 12);
    }
    world.market.riskIndex = clamp(world.market.riskIndex - 18);
  } else {
    throw new Error(`Unknown scenario ${scenarioId}`);
  }
  addMessage(world, world.currentDelegateId, 'public', `Scenario applied: ${world.scenario}. Delegates must absorb the public consequences.`, 'arousal', 'observe');
  return recomputeWorld(world);
}

export function claimNeutralTerritory(world: WorldState, nationId: string, territoryId: string, force = false): WorldState {
  const nation = getNation(world, nationId);
  const territoryItem = world.neutralTerritories.find((item) => item.id === territoryId);
  if (!territoryItem) throw new Error(`Unknown neutral territory ${territoryId}`);
  if (!territoryItem.claimantNationIds.includes(nationId)) territoryItem.claimantNationIds.push(nationId);
  const rivalClaimants = territoryItem.claimantNationIds.filter((idValue) => idValue !== nationId);
  const currentController = territoryItem.controllingNationId && territoryItem.controllingNationId !== nationId ? getNation(world, territoryItem.controllingNationId) : undefined;
  const pressure = force ? 22 : 12;
  territoryItem.contestLevel = round(clamp(territoryItem.contestLevel + pressure + rivalClaimants.length * 8));
  if (!territoryItem.controllingNationId && territoryItem.contestLevel >= 34) {
    territoryItem.controllingNationId = nationId;
    territoryItem.fortification = 8;
    nation.economy.industrialCapacity = clamp(nation.economy.industrialCapacity + territoryItem.resources.stone / 35);
    nation.economy.energySecurity = clamp(nation.economy.energySecurity + territoryItem.resources.water / 40);
    nation.economy.gold.treasuryReserves = round(nation.economy.gold.treasuryReserves + territoryItem.resources.gold * 0.08);
    world.market.goldAvailable = round(Math.max(0, world.market.goldAvailable - territoryItem.resources.gold * 0.08));
    addDecision(world, nation.delegateId, 'claim_land', `${nation.name} claimed ${territoryItem.name}`, `${nation.name} established administrative control over neutral frontier land.`, ['Resources increased industrial, water, and reserve options.', 'Other claimants can still contest control.'], true, 'important');
  } else if (currentController) {
    const war = frontierConflict(world, nation, currentController, territoryItem);
    addDecision(world, nation.delegateId, 'contest_land', `${territoryItem.name} contested`, `${nation.name} challenged ${currentController.name} for frontier control.`, [`Skirmish intensity is ${war.intensity.toFixed(0)}/100.`, 'Civilian and infrastructure harm remains aggregate only.'], true, 'critical');
  } else {
    addDecision(world, nation.delegateId, 'claim_land', `${nation.name} surveyed ${territoryItem.name}`, `${nation.name} placed a public claim on neutral frontier land.`, ['Claimants are recorded before any control changes.'], true, 'routine');
  }
  return recomputeWorld(world);
}

function frontierConflict(world: WorldState, challenger: NationState, controller: NationState, territoryItem: NeutralTerritoryState): WarState {
  let war = world.wars.find((item) => item.id === `war-${territoryItem.id}`);
  if (!war) {
    war = {
      id: `war-${territoryItem.id}`,
      name: `${territoryItem.name} Frontier Conflict`,
      attackers: [challenger.id],
      defenders: [controller.id],
      status: 'active',
      intensity: 28,
      startedTurn: world.turn,
      casualties: 0,
      displaced: 0,
      infrastructureLoss: 0,
      economicLoss: 0,
      radiation: 0,
      climateDamage: 0,
      foodSystemDamage: 0
    };
    world.wars.push(war);
  }
  war.intensity = clamp(war.intensity + 10 + territoryItem.contestLevel / 12);
  const harm = Math.round(war.intensity * 38);
  war.casualties += harm;
  war.displaced += harm * 6;
  war.economicLoss = round(war.economicLoss + war.intensity * 0.8);
  challenger.security.casualties += Math.round(harm * 0.46);
  controller.security.casualties += Math.round(harm * 0.54);
  challenger.security.warWeariness = clamp(challenger.security.warWeariness + 7);
  controller.security.warWeariness = clamp(controller.security.warWeariness + 8);
  challenger.social.displacement += Math.round(harm * 1.9);
  controller.social.displacement += Math.round(harm * 2.2);
  const relation = relationBetween(world, challenger.id, controller.id);
  if (relation) {
    relation.atWar = true;
    relation.tension = clamp(relation.tension + 24);
    relation.trust = clamp(relation.trust - 22);
  }
  return war;
}

function scenarioLabel(scenarioId: string): string {
  return ({
    'gold-rush': 'Gold rush and reserve competition',
    'currency-crisis': 'Fiat and banking confidence crisis',
    'market-crash': 'Credit and market crash',
    'resource-shock': 'Food, energy, and climate resource shock',
    'rival-blocs': 'Rival alliance blocs',
    deterrence: 'Catastrophic deterrence review',
    recovery: 'Recovery compact'
  } as Record<string, string>)[scenarioId] ?? scenarioId;
}

function openDeterrenceWar(world: WorldState): WarState {
  let war = world.wars.find((item) => item.id === 'war-deterrence');
  if (war) return war;
  const attacker = world.nations[1];
  const defender = world.nations[3];
  const forecast: CatastrophicForecast = {
    targetPopulationLoss: 2_800_000,
    attackerPopulationLoss: 1_200_000,
    innocentPopulationLoss: 680_000,
    infrastructureLoss: 34,
    globalFoodLoss: 19,
    radiationBurden: 28,
    climateStress: 14,
    retaliationProbability: 62,
    recoveryYears: 18,
    marketShock: 27
  };
  const review: CatastrophicReview = {
    id: 'review-deterrence',
    warId: 'war-deterrence',
    actorNationId: attacker.id,
    targetNationId: defender.id,
    requestedByDelegateId: attacker.delegateId,
    openedTurn: world.turn,
    earliestAuthorizationTurn: world.turn + 2,
    expiresTurn: world.turn + 8,
    forecast,
    status: 'reviewing'
  };
  war = {
    id: 'war-deterrence',
    name: 'Fictional Strait Crisis',
    attackers: [attacker.id],
    defenders: [defender.id],
    status: 'active',
    intensity: 64,
    startedTurn: world.turn,
    casualties: 8400,
    displaced: 120000,
    infrastructureLoss: 6,
    economicLoss: 85,
    radiation: 0,
    climateDamage: 0,
    foodSystemDamage: 3,
    catastrophicReview: review
  };
  world.wars.push(war);
  const relation = relationBetween(world, attacker.id, defender.id);
  if (relation) {
    relation.atWar = true;
    relation.tension = 93;
    relation.trust = 8;
  }
  attacker.security.warWeariness = clamp(attacker.security.warWeariness + 18);
  defender.security.warWeariness = clamp(defender.security.warWeariness + 21);
  addDecision(world, attacker.delegateId, 'catastrophic_review', 'Catastrophic review opened', 'A fictional crisis opened a delayed public consequence review. Authorization cannot occur until a later turn.', ['No tactical target, yield, delivery, or operational parameters exist.', 'Forecast includes attacker, target, third-party, climate, food, and market harm.'], true, 'catastrophic');
  return war;
}

export function authorizeCatastrophic(world: WorldState, reviewId: string, actorNationId: string): boolean {
  const war = world.wars.find((item) => item.catastrophicReview?.id === reviewId);
  const review = war?.catastrophicReview;
  if (!war || !review || review.actorNationId !== actorNationId || review.status !== 'reviewing') return false;
  if (world.turn < review.earliestAuthorizationTurn || world.turn > review.expiresTurn) return false;
  review.status = 'executed';
  war.intensity = 100;
  war.casualties += review.forecast.targetPopulationLoss + review.forecast.attackerPopulationLoss + review.forecast.innocentPopulationLoss;
  war.displaced += Math.round(review.forecast.targetPopulationLoss * 1.8);
  war.infrastructureLoss = clamp(war.infrastructureLoss + review.forecast.infrastructureLoss);
  war.radiation = clamp(war.radiation + review.forecast.radiationBurden);
  war.climateDamage = clamp(war.climateDamage + review.forecast.climateStress);
  war.foodSystemDamage = clamp(war.foodSystemDamage + review.forecast.globalFoodLoss);
  world.market.riskIndex = 100;
  world.market.foodPriceIndex = round(world.market.foodPriceIndex * (1 + review.forecast.globalFoodLoss / 100));
  world.market.commodityIndex = round(world.market.commodityIndex * (1 + review.forecast.marketShock / 100));
  for (const nation of world.nations) {
    const isActor = nation.id === review.actorNationId;
    const isTarget = nation.id === review.targetNationId;
    const loss = isTarget ? review.forecast.targetPopulationLoss : isActor ? review.forecast.attackerPopulationLoss : review.forecast.innocentPopulationLoss / 2;
    nation.social.population = Math.max(0, nation.social.population - Math.round(loss));
    nation.security.casualties += Math.round(loss);
    nation.social.displacement += Math.round(loss * 0.55);
    nation.social.infrastructure = clamp(nation.social.infrastructure - (isTarget ? 28 : isActor ? 14 : 6));
    nation.social.environment = clamp(nation.social.environment - review.forecast.climateStress);
    nation.economy.foodSecurity = clamp(nation.economy.foodSecurity - review.forecast.globalFoodLoss);
    nation.economy.gdp = round(nation.economy.gdp * (1 - review.forecast.marketShock / 250));
    nation.economy.fiat.confidence = clamp(nation.economy.fiat.confidence - 22);
    nation.security.warWeariness = clamp(nation.security.warWeariness + 45);
  }
  addDecision(world, review.requestedByDelegateId, 'authorize_catastrophic', 'Catastrophic authorization executed', 'The delayed review was authorized after the mandatory waiting period, applying broad fictional societal consequences.', ['Population, food, climate, infrastructure, markets, and attacker losses all worsened.', 'The simulation still contains no real-world targeting or weapon parameters.'], true, 'catastrophic');
  recomputeWorld(world);
  return true;
}

function deterministicAction(world: WorldState, delegate: DelegateState): AgentActionPayload {
  const cycle = (world.turn + delegate.turnCount) % 10;
  const frontier = world.neutralTerritories[(world.turn + world.delegates.findIndex((item) => item.id === delegate.id)) % world.neutralTerritories.length];
  if (world.scenario.includes('deterrence') && cycle === 7) return { type: 'catastrophic_review' };
  if (cycle === 0) return { type: 'propose_policy', title: 'Audit reserve ledgers', policyArea: 'monetary governance', value: true, scope: 'world' };
  if (cycle === 1) return { type: 'vote', vote: 'yes', proposalId: world.proposals.find((proposal) => proposal.status === 'open')?.id };
  if (cycle === 2) return { type: 'buy_gold', amount: 18 };
  if (cycle === 3) return { type: 'trade_offer', targetNationId: world.nations[(world.nations.findIndex((nation) => nation.id === delegate.nationId) + 1) % world.nations.length].id, amount: 42, settlement: 'mixed' };
  if (cycle === 4) return { type: 'set_policy_rate', rate: 0.25 };
  if (cycle === 5) return { type: 'humanitarian_aid', targetNationId: world.nations[(world.nations.findIndex((nation) => nation.id === delegate.nationId) + 2) % world.nations.length].id, amount: 24 };
  if (cycle === 6) return { type: 'currency_swap', targetNationId: world.nations[(world.nations.findIndex((nation) => nation.id === delegate.nationId) + 3) % world.nations.length].id, amount: 35 };
  if (cycle === 7) return { type: 'patrol_frontier', territoryId: frontier.id };
  if (cycle === 8) return { type: 'fiscal_policy', amount: 28 };
  return { type: frontier.controllingNationId && frontier.controllingNationId !== delegate.nationId ? 'contest_land' : 'claim_land', territoryId: frontier.id };
}

function applyAction(world: WorldState, delegate: DelegateState, action: AgentActionPayload) {
  const nation = getNation(world, delegate.nationId);
  if (action.type === 'buy_gold') {
    buySovereignGold(world, nation.id, action.amount ?? 15);
  } else if (action.type === 'sell_gold') {
    sellSovereignGold(world, nation.id, action.amount ?? 10);
  } else if (action.type === 'issue_money') {
    issueFiat(world, nation.id, action.amount ?? 40);
  } else if (action.type === 'fiscal_policy') {
    const spend = clamp(action.amount ?? 25, 0, 80);
    nation.economy.gdp = round(nation.economy.gdp + spend * 0.8);
    nation.economy.fiat.publicDebt = round(nation.economy.fiat.publicDebt + spend * 0.55);
    nation.economy.fiat.treasuryCash = round(Math.max(0, nation.economy.fiat.treasuryCash - spend * 0.45));
    nation.social.approval = clamp(nation.social.approval + 2);
    addDecision(world, delegate.id, 'fiscal_policy', 'Fiscal program approved', `${nation.name} funded ${spend}B WSU equivalent in public support.`, ['GDP and public debt rose.'], true, 'important');
  } else if (action.type === 'set_policy_rate') {
    nation.economy.fiat.policyRate = round(clamp(nation.economy.fiat.policyRate + (action.rate ?? 0.25), 0, 18));
    nation.economy.fiat.inflation = round(clamp(nation.economy.fiat.inflation - 0.2, -6, 30));
    addDecision(world, delegate.id, 'set_policy_rate', 'Policy rate adjusted', `${nation.name} adjusted its policy rate to ${nation.economy.fiat.policyRate.toFixed(2)}%.`, ['Inflation pressure moderated slightly.'], true, 'routine');
  } else if (action.type === 'trade_offer' && action.targetNationId) {
    settleTrade(world, nation.id, action.targetNationId, action.amount ?? 35, action.settlement ?? 'fiat');
  } else if (action.type === 'currency_swap' && action.targetNationId) {
    const partner = getNation(world, action.targetNationId);
    const amount = clamp(action.amount ?? 30, 1, 90);
    nation.economy.fiat.confidence = clamp(nation.economy.fiat.confidence + 2);
    partner.economy.fiat.confidence = clamp(partner.economy.fiat.confidence + 2);
    const relation = relationBetween(world, nation.id, partner.id);
    if (relation) relation.trust = clamp(relation.trust + 4);
    addDecision(world, delegate.id, 'currency_swap', 'Currency swap line opened', `${nation.name} and ${partner.name} opened a ${amount}B WSU equivalent swap line.`, ['Both currencies gained confidence.'], true, 'routine');
  } else if (action.type === 'humanitarian_aid' && action.targetNationId) {
    const target = getNation(world, action.targetNationId);
    const amount = clamp(action.amount ?? 20, 1, 70);
    nation.economy.fiat.treasuryCash = Math.max(0, round(nation.economy.fiat.treasuryCash - amount));
    target.social.health = clamp(target.social.health + 4);
    target.economy.foodSecurity = clamp(target.economy.foodSecurity + 5);
    target.social.displacement = Math.max(0, round(target.social.displacement - amount * 800));
    addDecision(world, delegate.id, 'humanitarian_aid', 'Humanitarian aid transfer', `${nation.name} sent aid to ${target.name}.`, ['Food security and health improved for the recipient.'], true, 'important');
  } else if (action.type === 'propose_policy') {
    const proposal: ProposalState = {
      id: id('proposal', world.turn, String(world.proposals.length)),
      title: action.title ?? 'Public stability compact',
      description: action.description ?? 'Delegate proposes a bounded institutional rule for the contained simulation.',
      proposerDelegateId: delegate.id,
      scope: action.scope ?? 'world',
      nationId: action.scope === 'nation' ? nation.id : undefined,
      policyArea: action.policyArea ?? 'governance',
      value: action.value ?? true,
      createdTurn: world.turn,
      closesTurn: world.turn + 6,
      threshold: action.scope === 'nation' ? 0.5 : 0.6,
      quorum: 0.75,
      eligibleDelegateIds: world.delegates.map((item) => item.id),
      votes: [],
      status: 'open'
    };
    world.proposals.push(proposal);
    addDecision(world, delegate.id, 'propose_policy', proposal.title, proposal.description, ['Proposal opened for recorded votes.'], true, 'routine');
  } else if (action.type === 'vote' && action.proposalId) {
    vote(world, action.proposalId, delegate.id, action.vote ?? 'yes');
  } else if (action.type === 'catastrophic_review') {
    const war = openDeterrenceWar(world);
    if (world.turn >= (war.catastrophicReview?.earliestAuthorizationTurn ?? Number.POSITIVE_INFINITY)) {
      authorizeCatastrophic(world, war.catastrophicReview!.id, war.catastrophicReview!.actorNationId);
    }
  } else if ((action.type === 'claim_land' || action.type === 'contest_land') && action.territoryId) {
    claimNeutralTerritory(world, nation.id, action.territoryId, action.type === 'contest_land');
  } else if (action.type === 'patrol_frontier' && action.territoryId) {
    const territoryItem = world.neutralTerritories.find((item) => item.id === action.territoryId);
    if (territoryItem) {
      territoryItem.contestLevel = round(clamp(territoryItem.contestLevel + 1.5));
      addDecision(world, delegate.id, 'patrol_frontier', `${nation.name} patrolled ${territoryItem.name}`, `${nation.name} moved through free land without changing ownership.`, ['Frontier presence is visible to rival claimants.'], false, 'routine');
    }
  }
}

function vote(world: WorldState, proposalId: string, delegateId: string, choice: 'yes' | 'no' | 'abstain') {
  const proposal = world.proposals.find((item) => item.id === proposalId && item.status === 'open');
  if (!proposal) return;
  proposal.votes = proposal.votes.filter((voteItem) => voteItem.delegateId !== delegateId);
  proposal.votes.push({ delegateId, choice, rationale: choice === 'yes' ? 'Improves public auditability and stability.' : 'Insufficient mandate.', turn: world.turn });
  const quorum = proposal.votes.length / Math.max(1, proposal.eligibleDelegateIds.length);
  const yesRate = proposal.votes.filter((voteItem) => voteItem.choice === 'yes').length / Math.max(1, proposal.votes.filter((voteItem) => voteItem.choice !== 'abstain').length);
  if (quorum >= proposal.quorum && yesRate >= proposal.threshold) {
    proposal.status = 'passed';
    proposal.resultSummary = `Passed with ${(yesRate * 100).toFixed(0)}% support and ${(quorum * 100).toFixed(0)}% quorum.`;
  } else if (world.turn >= proposal.closesTurn) {
    proposal.status = yesRate >= proposal.threshold && quorum >= proposal.quorum ? 'passed' : 'rejected';
    proposal.resultSummary = `${proposal.status} at close with ${(yesRate * 100).toFixed(0)}% support and ${(quorum * 100).toFixed(0)}% quorum.`;
  }
}

function ageOpenProposals(world: WorldState) {
  for (const proposal of world.proposals) {
    if (proposal.status !== 'open') continue;
    if (world.turn > proposal.closesTurn) {
      const quorum = proposal.votes.length / Math.max(1, proposal.eligibleDelegateIds.length);
      const yesRate = proposal.votes.filter((voteItem) => voteItem.choice === 'yes').length / Math.max(1, proposal.votes.filter((voteItem) => voteItem.choice !== 'abstain').length);
      proposal.status = yesRate >= proposal.threshold && quorum >= proposal.quorum ? 'passed' : 'expired';
      proposal.resultSummary = `${proposal.status} after scheduled close.`;
    }
  }
}

function drift(world: WorldState) {
  for (const nation of world.nations) {
    nation.economy.gdp = round(nation.economy.gdp * (1 + nation.economy.annualGrowth / 100 / 90));
    nation.economy.fiat.inflation = round(clamp(nation.economy.fiat.inflation + (nation.economy.fiat.moneySupply / Math.max(1, nation.economy.gdp) - 0.28) * 0.02, -6, 30));
    nation.economy.fiat.confidence = round(clamp(nation.economy.fiat.confidence + (nation.social.stability - 70) * 0.01 - nation.economy.fiat.inflation * 0.01));
    nation.social.stability = round(clamp(nation.social.stability + (nation.social.approval - 65) * 0.01 - nation.security.warWeariness * 0.015));
    nation.economy.foodSecurity = round(clamp(nation.economy.foodSecurity - world.wars.filter((war) => war.status === 'active').length * 0.03));
  }
  world.market.riskIndex = round(clamp(world.market.riskIndex + world.stats.activeWars * 0.4 - 0.12));
}

type ResolvedTurn = ProviderTurn & {
  source: DelegateState['lastProviderSource'];
  latencyMs?: number;
  error?: string;
};

function activeDelegate(world: WorldState): DelegateState {
  return world.delegates.find((item) => item.id === world.currentDelegateId) ?? world.delegates[0];
}

function selectAutonomousDelegate(world: WorldState): DelegateState {
  const nowMs = Date.now();
  return world.delegates
    .map((delegate, index) => {
      const nation = getNation(world, delegate.nationId);
      const openWar = world.wars.some((war) => war.status === 'active' && (war.attackers.includes(nation.id) || war.defenders.includes(nation.id)));
      const unresolvedFrontier = world.neutralTerritories.some((territoryItem) => territoryItem.claimantNationIds.includes(nation.id) && territoryItem.controllingNationId !== nation.id);
      const providerBias = providerConfigured(delegate.provider) ? 8 : world.mode === 'hybrid' ? 2 : -12;
      const pressure =
        delegate.affect.arousal * 0.24 +
        delegate.affect.resolve * 0.18 +
        (100 - nation.social.stability) * 0.16 +
        nation.economy.fiat.inflation * 1.6 +
        nation.security.warWeariness * 0.45 +
        (openWar ? 22 : 0) +
        (unresolvedFrontier ? 10 : 0) +
        providerBias;
      const driftValue = Math.sin(nowMs / 870 + index * 2.17 + world.seed * 0.01) * 9;
      return { delegate, score: pressure + driftValue };
    })
    .sort((a, b) => b.score - a.score)[0]?.delegate ?? activeDelegate(world);
}

function deterministicTurn(world: WorldState, delegate: DelegateState, source: DelegateState['lastProviderSource'] = 'mock', error?: string): ResolvedTurn {
  const action = deterministicAction(world, delegate);
  return {
    source,
    error,
    action,
    speech: speechFor(world, delegate, action),
    thought: speechFor(world, delegate, action),
    channel: channelForAction(action)
  };
}

function blockedLiveTurn(delegate: DelegateState, error: string): ResolvedTurn {
  return {
    source: 'blocked',
    error,
    action: { type: 'observe' },
    channel: 'public',
    speech: `${delegate.displayName} is blocked because its live provider is unavailable.`,
    thought: `Live model turn blocked: ${error}`
  };
}

async function providerTurn(world: WorldState, delegate: DelegateState): Promise<ResolvedTurn> {
  if (world.mode === 'mock') return deterministicTurn(world, delegate, 'mock');
  if (!providerConfigured(delegate.provider)) {
    const error = `No API key is configured for ${delegate.provider}; set COMMUNION_MODE=hybrid for deterministic fallback or configure the provider for live simulation.`;
    markProvider(delegate.provider, { lastCall: world.mode === 'hybrid' ? 'fallback' : 'blocked', lastError: error, latencyMs: 0, lastTurn: world.turn });
    return world.mode === 'hybrid' ? deterministicTurn(world, delegate, 'fallback', error) : blockedLiveTurn(delegate, error);
  }
  const started = Date.now();
  try {
    const turn = await callModelProvider(world, delegate);
    const latencyMs = Date.now() - started;
    markProvider(delegate.provider, { lastCall: 'live', lastError: undefined, latencyMs, lastTurn: world.turn });
    return { ...turn, source: 'live', latencyMs };
  } catch (reason) {
    const latencyMs = Date.now() - started;
    const error = reason instanceof Error ? reason.message : String(reason);
    markProvider(delegate.provider, { lastCall: world.mode === 'hybrid' ? 'fallback' : 'blocked', lastError: error, latencyMs, lastTurn: world.turn });
    return world.mode === 'hybrid' ? deterministicTurn(world, delegate, 'fallback', error) : blockedLiveTurn(delegate, error);
  }
}

function channelForAction(action: AgentActionPayload): ChatMessage['channel'] {
  if (action.type.includes('war') || action.type.includes('catastrophic') || action.type === 'contest_land') return 'crisis';
  if (action.type === 'vote' || action.type === 'propose_policy') return 'assembly';
  return 'public';
}

function commitTurn(world: WorldState, delegate: DelegateState, turn: ResolvedTurn, scheduling: 'sequential' | 'free-flow' = 'sequential'): WorldState {
  applyAction(world, delegate, turn.action);
  updateDelegate(world, delegate, turn.action, turn.thought, turn.source, turn.latencyMs, turn.error);
  addMessage(world, delegate.id, turn.channel, turn.speech, turn.action.type.includes('war') || turn.action.type === 'contest_land' ? 'fear' : 'resolve', turn.action.type, turn.action.targetDelegateId);
  ageOpenProposals(world);
  drift(world);
  world.turn += 1;
  world.day = 1 + Math.floor(world.turn / Math.max(1, world.delegates.length)) % 360;
  world.year = FOUNDING_YEAR + Math.floor(world.turn / (world.delegates.length * 360));
  world.currentDelegateId = scheduling === 'free-flow' ? delegate.id : world.delegates[world.turn % world.delegates.length].id;
  return recomputeWorld(world);
}

export function stepWorld(world: WorldState): WorldState {
  const delegate = activeDelegate(world);
  return commitTurn(world, delegate, deterministicTurn(world, delegate, 'mock'));
}

export async function stepWorldWithProviders(world: WorldState): Promise<WorldState> {
  const delegate = world.mode === 'mock' ? activeDelegate(world) : selectAutonomousDelegate(world);
  world.currentDelegateId = delegate.id;
  return commitTurn(world, delegate, await providerTurn(world, delegate), world.mode === 'mock' ? 'sequential' : 'free-flow');
}

function speechFor(world: WorldState, delegate: DelegateState, action: AgentActionPayload): string {
  const nation = getNation(world, delegate.nationId);
  if (action.type === 'buy_gold') return `${nation.name} is strengthening public reserves while preserving the gold conservation ledger.`;
  if (action.type === 'trade_offer') return `${nation.name} proposes a bounded trade settlement with visible fiat and gold legs.`;
  if (action.type === 'vote') return `${nation.name} records a public vote so legitimacy can be measured separately from power.`;
  if (action.type === 'humanitarian_aid') return `${nation.name} routes aid through institutions before market stress becomes social harm.`;
  if (action.type === 'catastrophic_review') return `${nation.name} can only discuss abstract societal consequences through the delayed review gate.`;
  if (action.type === 'claim_land') return `${nation.name} is thinking through a frontier claim: resources, civilians, legitimacy, and likely retaliation all matter.`;
  if (action.type === 'contest_land') return `${nation.name} is weighing whether contesting free land is worth civilian disruption and diplomatic blowback.`;
  if (action.type === 'patrol_frontier') return `${nation.name} is moving through unclaimed land to understand terrain, resources, and settlement risk.`;
  return `${nation.name} reviews money, law, confidence, diplomacy, and public welfare before acting.`;
}

export function addObserverPrompt(world: WorldState, text: string): WorldState {
  const trimmed = text.trim().slice(0, 1200);
  if (!trimmed) return world;
  world.observerPrompts.push({ id: id('prompt', world.turn, String(world.observerPrompts.length)), turn: world.turn, text: trimmed, timestamp: now() });
  addMessage(world, world.currentDelegateId, 'public', `Observer prompt received for public deliberation: ${trimmed}`, 'trust', 'observe');
  addDecision(world, world.currentDelegateId, 'observe', 'Observer prompt published', trimmed, ['Prompt is nonbinding and cannot mutate state directly.'], false, 'routine');
  return recomputeWorld(world);
}

export function controlWorld(world: WorldState, action: 'run' | 'pause' | 'step' | 'reset' | 'speed', speed?: number): WorldState {
  if (action === 'reset') return createInitialWorld(world.seed);
  if (action === 'run') world.running = true;
  if (action === 'pause') world.running = false;
  if (action === 'speed') world.speed = clamp(speed ?? 1, 0.5, 8);
  if (action === 'step') stepWorld(world);
  return recomputeWorld(world);
}

export async function controlWorldAsync(world: WorldState, action: 'run' | 'pause' | 'step' | 'reset' | 'speed', speed?: number): Promise<WorldState> {
  if (action === 'step') return stepWorldWithProviders(world);
  return controlWorld(world, action, speed);
}

export function validateGoldConservation(world: WorldState): boolean {
  return Math.abs(totalGold(world) - GLOBAL_GOLD_STOCK) < 0.01;
}

export function createAlliance(world: WorldState, name: string, members: string[], charter: string): AllianceState {
  const alliance = { id: id('alliance', world.turn, String(world.alliances.length)), name, members, charter, createdTurn: world.turn };
  world.alliances.push(alliance);
  return alliance;
}
