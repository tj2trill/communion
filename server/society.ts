import type { DrugPolicy, GunRegulation, IdeologyVariant, NationState, PolicingLevel, SocietyState } from '../src/lib/types';

// Slice 4: a deterministic, auditable society model. Regulations and funding
// levers (stored on nation.policy) plus ideology drive a small set of clamped
// feedback loops each tick. All curves live here so they can be reviewed and
// tested in one place. No silent default-on-shortage: funding draws treasury.

const clamp = (value: number): number => Math.max(0, Math.min(100, value));
const toward = (current: number, target: number, rate: number): number => current + (target - current) * rate;

const GUN_STRICT: Record<GunRegulation, number> = { unrestricted: 0, licensed: 1, restricted: 2, banned: 3 };

export function inferIdeology(text: string): IdeologyVariant {
  const value = (text ?? '').toLowerCase();
  if (/communist|marxist|vanguard/.test(value)) return 'communist';
  if (/socialist|collectivist/.test(value)) return 'socialist';
  if (/social.?democrat|nordic|welfare/.test(value)) return 'social-democratic';
  if (/libertarian|free.?market|minarchist/.test(value)) return 'libertarian';
  if (/nationalist|sovereign|traditional/.test(value)) return 'nationalist';
  if (/technocrat|technocratic|rational|engineer/.test(value)) return 'technocratic';
  return 'capitalist';
}

interface IdeologyProfile {
  tax: number;
  educationFunding: number;
  healthFunding: number;
  scienceFunding: number;
  welfareFunding: number;
  gunRegulation: GunRegulation;
  drugPolicy: DrugPolicy;
  policingLevel: PolicingLevel;
}

const IDEOLOGY: Record<IdeologyVariant, IdeologyProfile> = {
  capitalist: { tax: 20, educationFunding: 50, healthFunding: 45, scienceFunding: 55, welfareFunding: 35, gunRegulation: 'licensed', drugPolicy: 'prohibition', policingLevel: 'standard' },
  socialist: { tax: 42, educationFunding: 75, healthFunding: 78, scienceFunding: 60, welfareFunding: 80, gunRegulation: 'restricted', drugPolicy: 'decriminalized', policingLevel: 'standard' },
  communist: { tax: 55, educationFunding: 80, healthFunding: 80, scienceFunding: 65, welfareFunding: 88, gunRegulation: 'banned', drugPolicy: 'prohibition', policingLevel: 'heavy' },
  'social-democratic': { tax: 40, educationFunding: 78, healthFunding: 80, scienceFunding: 62, welfareFunding: 72, gunRegulation: 'restricted', drugPolicy: 'legal-regulated', policingLevel: 'standard' },
  libertarian: { tax: 14, educationFunding: 35, healthFunding: 30, scienceFunding: 45, welfareFunding: 18, gunRegulation: 'unrestricted', drugPolicy: 'legal-regulated', policingLevel: 'minimal' },
  nationalist: { tax: 26, educationFunding: 48, healthFunding: 50, scienceFunding: 50, welfareFunding: 45, gunRegulation: 'restricted', drugPolicy: 'prohibition', policingLevel: 'heavy' },
  technocratic: { tax: 30, educationFunding: 70, healthFunding: 65, scienceFunding: 85, welfareFunding: 55, gunRegulation: 'licensed', drugPolicy: 'decriminalized', policingLevel: 'standard' }
};

export function ideologyProfile(variant: IdeologyVariant): IdeologyProfile {
  return IDEOLOGY[variant];
}

function num(policy: NationState['policy'], key: string, fallback: number): number {
  const value = policy[key];
  return typeof value === 'number' ? value : fallback;
}

function str<T extends string>(policy: NationState['policy'], key: string, fallback: T): T {
  const value = policy[key];
  return typeof value === 'string' ? (value as T) : fallback;
}

export function ensureSociety(nation: NationState): void {
  nation.ideologyVariant ??= inferIdeology(nation.ideology);
  const profile = IDEOLOGY[nation.ideologyVariant];

  // Initialize regulation + funding levers on the policy record if absent.
  if (typeof nation.policy.gunRegulation !== 'string') nation.policy.gunRegulation = profile.gunRegulation;
  if (typeof nation.policy.weaponRegulation !== 'string') nation.policy.weaponRegulation = profile.gunRegulation === 'unrestricted' ? 'restricted' : 'banned';
  if (typeof nation.policy.drugPolicy !== 'string') nation.policy.drugPolicy = profile.drugPolicy;
  if (typeof nation.policy.policingLevel !== 'string') nation.policy.policingLevel = profile.policingLevel;
  if (typeof nation.policy.educationFunding !== 'number') nation.policy.educationFunding = profile.educationFunding;
  if (typeof nation.policy.healthFunding !== 'number') nation.policy.healthFunding = profile.healthFunding;
  if (typeof nation.policy.scienceFunding !== 'number') nation.policy.scienceFunding = profile.scienceFunding;
  if (typeof nation.policy.welfareFunding !== 'number') nation.policy.welfareFunding = profile.welfareFunding;

  if (!nation.society) {
    const social = nation.social;
    const economy = nation.economy;
    nation.society = {
      crimeRate: clamp(28 + economy.inequality * 0.4 + economy.unemployment * 0.8 - social.stability * 0.2),
      incarceration: clamp(20 + economy.inequality * 0.3),
      policing: policingTarget(str<PolicingLevel>(nation.policy, 'policingLevel', profile.policingLevel)),
      drugPrevalence: drugTarget(str<DrugPolicy>(nation.policy, 'drugPolicy', profile.drugPolicy)),
      addiction: clamp(18 + economy.unemployment),
      publicHealth: clamp(social.health),
      educationAttainment: clamp(social.education),
      scienceTech: clamp(economy.productivity),
      employment: clamp(100 - economy.unemployment),
      socialCohesion: clamp(58 - economy.inequality * 0.3 + social.approval * 0.2),
      civilUnrest: clamp(100 - social.stability)
    };
  }
}

function policingTarget(level: PolicingLevel): number {
  return level === 'heavy' ? 85 : level === 'minimal' ? 25 : 55;
}

function drugTarget(policy: DrugPolicy): number {
  return policy === 'legal-regulated' ? 60 : policy === 'decriminalized' ? 45 : 25;
}

// One tick of the society feedback loops. Bounded, clamped, deterministic.
export function applySociety(nation: NationState, intensity = 1): void {
  ensureSociety(nation);
  const society = nation.society as SocietyState;
  const social = nation.social;
  const economy = nation.economy;
  const rate = 0.12 * intensity;

  const gunStrict = GUN_STRICT[str<GunRegulation>(nation.policy, 'gunRegulation', 'licensed')];
  const weaponStrict = GUN_STRICT[str<GunRegulation>(nation.policy, 'weaponRegulation', 'banned')];
  const policingLevel = str<PolicingLevel>(nation.policy, 'policingLevel', 'standard');
  const drugPolicy = str<DrugPolicy>(nation.policy, 'drugPolicy', 'prohibition');
  const educationFunding = num(nation.policy, 'educationFunding', 50);
  const healthFunding = num(nation.policy, 'healthFunding', 50);
  const scienceFunding = num(nation.policy, 'scienceFunding', 50);
  const welfareFunding = num(nation.policy, 'welfareFunding', 40);

  society.policing = clamp(toward(society.policing, policingTarget(policingLevel), rate));

  society.drugPrevalence = clamp(toward(society.drugPrevalence, drugTarget(drugPolicy) - healthFunding * 0.12, rate));
  society.addiction = clamp(toward(society.addiction, society.drugPrevalence * 0.6 - healthFunding * 0.2, rate));

  // Crime: pushed up by inequality, joblessness, drugs, weak cohesion; pushed
  // down by policing and weapon strictness. Prohibition adds a black-market
  // premium so banning everything is not a free win.
  const blackMarket = drugPolicy === 'prohibition' ? society.drugPrevalence * 0.18 : 0;
  const crimeTarget =
    18 +
    economy.inequality * 0.5 +
    economy.unemployment * 1.2 +
    society.drugPrevalence * 0.2 +
    (100 - society.socialCohesion) * 0.2 +
    blackMarket -
    society.policing * 0.4 -
    gunStrict * 6 -
    weaponStrict * 4;
  society.crimeRate = clamp(toward(society.crimeRate, crimeTarget, rate));

  society.incarceration = clamp(toward(society.incarceration, society.policing * 0.4 + society.crimeRate * 0.3, rate * 0.8));

  society.publicHealth = clamp(toward(society.publicHealth, 38 + healthFunding * 0.5 + social.health * 0.2 - society.addiction * 0.3, rate * 0.7));
  society.educationAttainment = clamp(toward(society.educationAttainment, 28 + educationFunding * 0.5 + social.education * 0.2, rate * 0.6));
  society.scienceTech = clamp(toward(society.scienceTech, 18 + scienceFunding * 0.4 + society.educationAttainment * 0.3 + economy.productivity * 0.2, rate * 0.6));
  society.employment = clamp(toward(society.employment, 100 - economy.unemployment, rate * 1.4));

  society.socialCohesion = clamp(toward(society.socialCohesion, 55 + welfareFunding * 0.2 - economy.inequality * 0.4 - society.civilUnrest * 0.3 + (100 - society.crimeRate) * 0.1, rate * 0.7));
  const unrestTarget =
    society.crimeRate * 0.3 +
    (100 - society.socialCohesion) * 0.3 +
    economy.unemployment * 1.0 +
    (gunStrict >= 3 ? 6 : 0) +
    (policingLevel === 'heavy' ? 8 : 0) -
    social.approval * 0.2;
  society.civilUnrest = clamp(toward(society.civilUnrest, unrestTarget, rate));

  // Funding draws treasury cash (money is finite, ties into the slice-2 economy).
  const fundingLoad = (educationFunding + healthFunding + scienceFunding + welfareFunding) * 0.0009 * intensity;
  economy.fiat.treasuryCash = Math.max(0, economy.fiat.treasuryCash - fundingLoad);

  // Mechanical feedback into the headline state so society is not cosmetic.
  social.health = clamp(toward(social.health, society.publicHealth, 0.05 * intensity));
  social.education = clamp(toward(social.education, society.educationAttainment, 0.05 * intensity));
  social.stability = clamp(toward(social.stability, 100 - society.civilUnrest, 0.05 * intensity));
  social.approval = clamp(toward(social.approval, 50 + society.employment * 0.3 + society.publicHealth * 0.2 - society.crimeRate * 0.3, 0.05 * intensity));
  economy.productivity = clamp(toward(economy.productivity, 50 + society.scienceTech * 0.4 + society.educationAttainment * 0.1, 0.04 * intensity));
}

// Ideology biases the INITIAL regulation/funding defaults (see ensureSociety) and
// therefore the society outcomes, but it never continuously rewrites the
// agent-controlled funding levers - that would fight an agent's explicit choice.

const FUNDING_KEYS = new Set(['educationFunding', 'healthFunding', 'scienceFunding', 'welfareFunding']);
const REGULATION_VALUES: Record<string, string[]> = {
  gunRegulation: ['unrestricted', 'licensed', 'restricted', 'banned'],
  weaponRegulation: ['unrestricted', 'licensed', 'restricted', 'banned'],
  drugPolicy: ['prohibition', 'decriminalized', 'legal-regulated'],
  policingLevel: ['minimal', 'standard', 'heavy']
};

// Validated setters used by agent actions. Return a short result label or null
// when the request is invalid (so callers can refuse rather than mutate blindly).
export function setRegulation(nation: NationState, area: string, value: string): string | null {
  const allowed = REGULATION_VALUES[area];
  if (!allowed || !allowed.includes(value)) return null;
  ensureSociety(nation);
  nation.policy[area] = value;
  return `${area} -> ${value}`;
}

export function setFunding(nation: NationState, area: string, value: number): string | null {
  if (!FUNDING_KEYS.has(area) || !Number.isFinite(value)) return null;
  ensureSociety(nation);
  nation.policy[area] = clamp(value);
  return `${area} -> ${clamp(value)}`;
}
