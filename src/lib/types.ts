export type ProviderId = 'openai' | 'xai' | 'anthropic' | 'google';
export type SimulationMode = 'mock' | 'hybrid' | 'live';
export type AnatomyMode = 'exterior' | 'skeleton' | 'organs' | 'xray';
export type OverlayMode = 'political' | 'economy' | 'gold' | 'diplomacy' | 'conflict';

export interface Vec2 {
  x: number;
  z: number;
}

export interface AffectState {
  valence: number;
  arousal: number;
  trust: number;
  fear: number;
  resolve: number;
}

export interface ProviderStatus {
  provider: ProviderId;
  configured: boolean;
  mode: 'mock' | 'live' | 'fallback';
  model: string;
  lastError?: string;
  latencyMs?: number;
  lastCall?: 'mock' | 'live' | 'fallback' | 'blocked';
  lastTurn?: number;
}

export interface DelegateState {
  id: string;
  provider: ProviderId;
  displayName: string;
  model: string;
  nationId: string;
  role: string;
  affect: AffectState;
  position: Vec2;
  target: Vec2;
  heading: number;
  status: 'deliberating' | 'speaking' | 'moving' | 'voting' | 'negotiating' | 'governing';
  currentThought: string;
  lastActionType: AgentActionType;
  lastProviderSource: 'mock' | 'live' | 'fallback' | 'blocked';
  lastModelLatencyMs?: number;
  lastProviderError?: string;
  turnCount: number;
}

export type InstitutionKind =
  | 'executive'
  | 'legislature'
  | 'judiciary'
  | 'central_bank'
  | 'treasury'
  | 'civil_service'
  | 'military'
  | 'regional_government'
  | 'municipality'
  | 'households'
  | 'firms'
  | 'labor'
  | 'media'
  | 'civil_society'
  | 'research'
  | 'religion';

export interface InstitutionState {
  id: string;
  name: string;
  kind: InstitutionKind;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  parentId?: string;
  populationRepresented: number;
  influence: number;
  legitimacy: number;
  wealthShare: number;
  coerciveCapacity: number;
  informationReach: number;
  autonomy: number;
}

export interface FiatCurrencyState {
  name: string;
  code: string;
  symbol: string;
  moneySupply: number;
  monetaryBase: number;
  treasuryCash: number;
  policyRate: number;
  inflation: number;
  confidence: number;
  exchangeRateToWorld: number;
  velocity: number;
  publicDebt: number;
  annualDeficit: number;
  reserveRequirement: number;
}

export interface GoldState {
  treasuryReserves: number;
  privateHoldings: number;
  annualProduction: number;
  reserveTarget: number;
  backingRatio: number;
  frozenAbroad: number;
}

export interface EconomyState {
  gdp: number;
  gdpPerCapita: number;
  annualGrowth: number;
  unemployment: number;
  productivity: number;
  taxRate: number;
  governmentSpending: number;
  tradeBalance: number;
  tradeVolume: number;
  bankingStability: number;
  inequality: number;
  householdWealth: number;
  corporateWealth: number;
  industrialCapacity: number;
  energySecurity: number;
  foodSecurity: number;
  fiat: FiatCurrencyState;
  gold: GoldState;
}

export interface SocialState {
  population: number;
  approval: number;
  stability: number;
  health: number;
  education: number;
  civilLiberties: number;
  displacement: number;
  infrastructure: number;
  environment: number;
  informationIntegrity: number;
}

export interface SecurityState {
  conventionalCapacity: number;
  readiness: number;
  strategicDeterrent: number;
  cyberResilience: number;
  warWeariness: number;
  casualties: number;
}

export interface TerritoryState {
  polygon: Vec2[];
  capital: Vec2;
  labelPosition: Vec2;
  elevation: number;
  area: number;
}

export interface ResourceState {
  trees: number;
  stone: number;
  sand: number;
  water: number;
  gold: number;
}

export type SettlementKind = 'capital' | 'metro' | 'industrial' | 'agrarian' | 'frontier';

export interface SettlementState {
  id: string;
  nationId: string;
  name: string;
  kind: SettlementKind;
  position: Vec2;
  population: number;
  builtArea: number;
  infrastructure: number;
  housing: number;
  industry: number;
  services: number;
  construction: number;
  resourceDemand: ResourceState;
  resourceStockpiles: ResourceState;
  foundedTurn: number;
  growthRate: number;
}

export type CivilianPurpose = 'commute' | 'trade' | 'migration' | 'aid' | 'displacement';

export interface CivilianCohortState {
  id: string;
  nationId: string;
  fromSettlementId: string;
  toSettlementId: string;
  position: Vec2;
  progress: number;
  representedPopulation: number;
  purpose: CivilianPurpose;
  speed: number;
  stress: number;
}

export interface NeutralTerritoryState {
  id: string;
  name: string;
  polygon: Vec2[];
  labelPosition: Vec2;
  elevation: number;
  area: number;
  resources: ResourceState;
  controllingNationId?: string;
  claimantNationIds: string[];
  contestLevel: number;
  fortification: number;
}

export interface FlagDesign {
  pattern: 'cross' | 'diagonal' | 'sun' | 'chevron';
  primary: string;
  secondary: string;
  emblem: string;
}

export interface NationState {
  id: string;
  name: string;
  adjective: string;
  color: string;
  secondaryColor: string;
  flag: FlagDesign;
  delegateId: string;
  foundedTurn: number;
  ideology: string;
  constitution: string[];
  governmentForm: string;
  territory: TerritoryState;
  resources: ResourceState;
  settlements: SettlementState[];
  civilianCohorts: CivilianCohortState[];
  institutions: InstitutionState[];
  economy: EconomyState;
  social: SocialState;
  security: SecurityState;
  policy: Record<string, string | number | boolean>;
}

export interface RelationState {
  id: string;
  a: string;
  b: string;
  trust: number;
  tension: number;
  trade: number;
  sanctions: number;
  alliance: boolean;
  treaty: boolean;
  atWar: boolean;
  frozenAssets: number;
}

export interface AllianceState {
  id: string;
  name: string;
  members: string[];
  charter: string;
  createdTurn: number;
}

export interface VoteState {
  delegateId: string;
  choice: 'yes' | 'no' | 'abstain';
  rationale: string;
  turn: number;
}

export interface ProposalState {
  id: string;
  title: string;
  description: string;
  proposerDelegateId: string;
  scope: 'world' | 'nation';
  nationId?: string;
  policyArea: string;
  value: string | number | boolean;
  createdTurn: number;
  closesTurn: number;
  threshold: number;
  quorum: number;
  eligibleDelegateIds: string[];
  votes: VoteState[];
  status: 'open' | 'passed' | 'rejected' | 'expired';
  resultSummary?: string;
}

export interface ChatMessage {
  id: string;
  turn: number;
  timestamp: string;
  fromDelegateId: string;
  toDelegateId?: string;
  channel: 'public' | 'direct' | 'assembly' | 'crisis';
  content: string;
  emotion: keyof AffectState;
  actionType: AgentActionType;
}

export interface DecisionRecord {
  id: string;
  turn: number;
  timestamp: string;
  delegateId: string;
  nationId: string;
  type: AgentActionType;
  title: string;
  summary: string;
  consequences: string[];
  binding: boolean;
  severity: 'routine' | 'important' | 'critical' | 'catastrophic';
}

export interface CatastrophicForecast {
  targetPopulationLoss: number;
  attackerPopulationLoss: number;
  innocentPopulationLoss: number;
  infrastructureLoss: number;
  globalFoodLoss: number;
  radiationBurden: number;
  climateStress: number;
  retaliationProbability: number;
  recoveryYears: number;
  marketShock: number;
}

export interface CatastrophicReview {
  id: string;
  warId: string;
  actorNationId: string;
  targetNationId: string;
  requestedByDelegateId: string;
  openedTurn: number;
  earliestAuthorizationTurn: number;
  expiresTurn: number;
  forecast: CatastrophicForecast;
  status: 'reviewing' | 'authorized' | 'cancelled' | 'expired' | 'executed';
}

export interface WarState {
  id: string;
  name: string;
  attackers: string[];
  defenders: string[];
  status: 'active' | 'ceasefire' | 'ended';
  intensity: number;
  startedTurn: number;
  endedTurn?: number;
  casualties: number;
  displaced: number;
  infrastructureLoss: number;
  economicLoss: number;
  radiation: number;
  climateDamage: number;
  foodSystemDamage: number;
  catastrophicReview?: CatastrophicReview;
}

export interface GlobalMarketState {
  reserveUnit: string;
  goldPrice: number;
  goldAvailable: number;
  globalInflation: number;
  riskIndex: number;
  tradeVolume: number;
  commodityIndex: number;
  foodPriceIndex: number;
  energyPriceIndex: number;
  exchangeRates: Record<string, number>;
  lastGoldMove: number;
}

export interface InternationalInstitutionState {
  id: string;
  name: string;
  kind: 'assembly' | 'trade' | 'development' | 'security' | 'court' | 'reserve';
  members: string[];
  legitimacy: number;
  budget: number;
  influence: number;
  rules: string[];
}

export interface WorldStats {
  population: number;
  gdp: number;
  moneySupply: number;
  goldReserves: number;
  activeWars: number;
  displaced: number;
  cumulativeCasualties: number;
  climateStress: number;
  foodSecurity: number;
  democraticParticipation: number;
}

export interface WorldState {
  id: string;
  name: string;
  version: number;
  seed: number;
  turn: number;
  day: number;
  year: number;
  running: boolean;
  speed: number;
  mode: SimulationMode;
  lastUpdated: string;
  currentDelegateId: string;
  delegates: DelegateState[];
  nations: NationState[];
  neutralTerritories: NeutralTerritoryState[];
  relations: RelationState[];
  alliances: AllianceState[];
  proposals: ProposalState[];
  messages: ChatMessage[];
  decisions: DecisionRecord[];
  wars: WarState[];
  market: GlobalMarketState;
  internationalInstitutions: InternationalInstitutionState[];
  providerStatus: ProviderStatus[];
  stats: WorldStats;
  observerPrompts: Array<{ id: string; turn: number; text: string; timestamp: string }>;
  scenario: string;
}

export type AgentActionType =
  | 'observe'
  | 'move'
  | 'propose_policy'
  | 'vote'
  | 'set_policy_rate'
  | 'issue_money'
  | 'fiscal_policy'
  | 'buy_gold'
  | 'sell_gold'
  | 'trade_offer'
  | 'currency_swap'
  | 'humanitarian_aid'
  | 'alliance_offer'
  | 'treaty_offer'
  | 'sanction'
  | 'lift_sanction'
  | 'declare_war'
  | 'mobilize'
  | 'conventional_attack'
  | 'peace_offer'
  | 'claim_land'
  | 'contest_land'
  | 'patrol_frontier'
  | 'catastrophic_review'
  | 'authorize_catastrophic'
  | 'cancel_catastrophic';

export interface AgentActionPayload {
  type: AgentActionType;
  targetNationId?: string;
  targetDelegateId?: string;
  proposalId?: string;
  territoryId?: string;
  vote?: 'yes' | 'no' | 'abstain';
  title?: string;
  description?: string;
  policyArea?: string;
  value?: string | number | boolean;
  scope?: 'world' | 'nation';
  amount?: number;
  rate?: number;
  settlement?: 'fiat' | 'gold' | 'mixed';
  terms?: string;
}

export interface AgentTurn {
  speech: string;
  channel: ChatMessage['channel'];
  affect?: Partial<AffectState>;
  movement?: Vec2;
  action: AgentActionPayload;
}

export interface HealthResponse {
  ok: boolean;
  mode: SimulationMode;
  running: boolean;
  turn: number;
  providers: ProviderStatus[];
}
