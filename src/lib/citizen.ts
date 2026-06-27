import type { NationState, SettlementState } from './types';

// Deterministic representative-citizen generation. Citizens are NOT persistently
// simulated; a stable seed (settlement id + index) regenerates an identical
// individual every time, so the "civilian space" is reproducible and cheap.

export interface CitizenProfile {
  seed: number;
  name: string;
  age: number;
  job: string;
  employed: boolean;
  district: 'residential' | 'commercial' | 'industrial' | 'civic';
  income: 'low' | 'middle' | 'high';
  wants: string[];
  needs: string[];
  likes: string[];
  dislikes: string[];
  thought: string;
  mood: 'content' | 'hopeful' | 'anxious' | 'angry' | 'weary';
  satisfaction: { label: string; value: number }[];
  overall: number;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GIVEN = ['Ada', 'Mateo', 'Nia', 'Soren', 'Imani', 'Kai', 'Lena', 'Tariq', 'Yara', 'Bo', 'Elif', 'Rune', 'Priya', 'Oskar', 'Dalia', 'Hana', 'Ezra', 'Mira', 'Cyrus', 'Noa'];
const FAMILY = ['Vance', 'Okoye', 'Reyes', 'Holm', 'Aziz', 'Nakamura', 'Bauer', 'Costa', 'Singh', 'Larsen', 'Mensah', 'Ito', 'Falk', 'Romero', 'Khan', 'Berg', 'Diallo', 'Park', 'Moreau', 'Sato'];

const JOBS_BY_DISTRICT: Record<CitizenProfile['district'], string[]> = {
  residential: ['teacher', 'nurse', 'care worker', 'remote clerk', 'retiree', 'student', 'parent at home'],
  commercial: ['shopkeeper', 'barista', 'accountant', 'designer', 'sales lead', 'logistics planner'],
  industrial: ['machinist', 'foundry hand', 'dock worker', 'electrician', 'line supervisor', 'welder'],
  civic: ['civil servant', 'researcher', 'police officer', 'doctor', 'judge clerk', 'lab technician']
};

const WANTS = ['affordable housing', 'a stable job', 'safer streets', 'better schools', 'shorter commute', 'clean parks', 'reliable power', 'fair wages', 'health coverage', 'free time'];
const NEEDS = ['food security', 'shelter', 'clean water', 'medical access', 'employment', 'public safety', 'transport', 'education'];
const LIKES = ['weekend markets', 'public transit', 'community festivals', 'the riverfront', 'local football', 'night markets', 'libraries', 'green space', 'street food', 'live music'];
const DISLIKES = ['traffic jams', 'rising rents', 'corruption', 'pollution', 'long queues', 'noise', 'crime reports', 'tax hikes', 'blackouts', 'red tape'];

function pick<T>(rng: () => number, list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

function pickSome<T>(rng: () => number, list: T[], count: number): T[] {
  const pool = [...list];
  const out: T[] = [];
  for (let index = 0; index < count && pool.length; index += 1) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function generateCitizen(settlement: SettlementState, nation: NationState, index: number): CitizenProfile {
  const seed = hashString(`${settlement.id}:${index}`);
  const rng = mulberry32(seed);
  const social = nation.social;
  const economy = nation.economy;

  // District weighting from the settlement's economic mix.
  const weights: Array<[CitizenProfile['district'], number]> = [
    ['residential', settlement.housing + 40],
    ['commercial', settlement.services + 10],
    ['industrial', settlement.industry + 10],
    ['civic', settlement.infrastructure * 0.4 + 8]
  ];
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  let district: CitizenProfile['district'] = 'residential';
  for (const [name, weight] of weights) {
    roll -= weight;
    if (roll <= 0) {
      district = name;
      break;
    }
  }

  const employed = rng() * 100 > economy.unemployment;
  const job = employed ? pick(rng, JOBS_BY_DISTRICT[district]) : pick(rng, ['between jobs', 'job-seeking', 'informal work']);
  const age = 16 + Math.floor(rng() * 70);
  const incomeRoll = rng() * 100;
  const income: CitizenProfile['income'] = incomeRoll > 100 - economy.inequality * 0.4 ? 'high' : incomeRoll < 35 ? 'low' : 'middle';

  // Satisfaction dimensions from the mechanical society model when present,
  // falling back to headline state so this stays correct without it.
  const society = nation.society;
  const crime = society?.crimeRate ?? Math.max(0, 60 - social.stability * 0.5);
  const safety = clamp(100 - crime * 0.7 + (society?.policing ?? 0) * 0.2);
  const jobs = clamp((society?.employment ?? 100 - economy.unemployment) - 4 + (employed ? 12 : -18));
  const health = clamp(society?.publicHealth ?? social.health);
  const education = clamp(society?.educationAttainment ?? social.education);
  const liberty = clamp(social.civilLiberties);
  const cost = clamp(100 - economy.fiat.inflation * 3 - (income === 'low' ? 22 : income === 'high' ? -8 : 6));
  const satisfaction = [
    { label: 'Safety', value: safety },
    { label: 'Jobs', value: jobs },
    { label: 'Health', value: health },
    { label: 'Education', value: education },
    { label: 'Liberty', value: liberty },
    { label: 'Cost of living', value: cost }
  ];
  const overall = clamp(satisfaction.reduce((sum, item) => sum + item.value, 0) / satisfaction.length);

  const mood: CitizenProfile['mood'] =
    overall > 72 ? 'content' : overall > 58 ? 'hopeful' : overall > 44 ? 'anxious' : overall > 30 ? 'weary' : 'angry';

  const wants = pickSome(rng, WANTS, 3);
  const needs = pickSome(rng, NEEDS, 2);
  const likes = pickSome(rng, LIKES, 2);
  const dislikes = pickSome(rng, DISLIKES, 2);

  const lowest = [...satisfaction].sort((a, b) => a.value - b.value)[0];
  const thoughtBank: Record<CitizenProfile['mood'], string[]> = {
    content: [`Life in ${settlement.name} feels steady right now.`, `Proud to be ${nation.adjective}. Things are working.`],
    hopeful: [`If ${lowest.label.toLowerCase()} improves, this could be a great place.`, `Saving up. The future looks brighter.`],
    anxious: [`Worried about ${lowest.label.toLowerCase()} lately.`, `${employed ? 'Hours are unstable' : 'Still looking for work'} and prices keep rising.`],
    weary: [`Tired of fighting for ${wants[0]}.`, `${lowest.label} keeps getting worse here.`],
    angry: [`Fed up - ${lowest.label.toLowerCase()} is a disgrace.`, `Someone has to answer for ${dislikes[0]}.`]
  };
  const thought = pick(rng, thoughtBank[mood]);

  return {
    seed,
    name: `${pick(rng, GIVEN)} ${pick(rng, FAMILY)}`,
    age,
    job,
    employed,
    district,
    income,
    wants,
    needs,
    likes,
    dislikes,
    thought,
    mood,
    satisfaction,
    overall
  };
}

export const MOOD_COLOR: Record<CitizenProfile['mood'], string> = {
  content: '#7CFFB2',
  hopeful: '#9FE8FF',
  anxious: '#FFD977',
  weary: '#FFB187',
  angry: '#FF6F6F'
};
