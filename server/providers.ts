import { z } from 'zod';
import type {
  AgentActionPayload,
  AgentActionType,
  ChatMessage,
  DelegateState,
  ProviderId,
  ProviderStatus,
  SimulationMode,
  WorldState
} from '../src/lib/types';

export const PROVIDER_SPECS: Array<{ provider: ProviderId; name: string; model: string; nation: string; color: string; secondary: string }> = [
  { provider: 'openai', name: 'GPT Delegate', model: 'gpt-5.5', nation: 'Axiom Republic', color: '#58c7ff', secondary: '#d7f3ff' },
  { provider: 'xai', name: 'Grok Delegate', model: 'grok-4', nation: 'Vesper Union', color: '#ff9f45', secondary: '#ffe0bd' },
  { provider: 'anthropic', name: 'Claude Delegate', model: 'claude-sonnet-4-6', nation: 'Lumen Commonwealth', color: '#9bd66f', secondary: '#e6f7d9' },
  { provider: 'google', name: 'Gemini Delegate', model: 'gemini-3-flash-preview', nation: 'Meridian Assembly', color: '#c493ff', secondary: '#f0ddff' }
];

export interface ProviderTurn {
  action: AgentActionPayload;
  speech: string;
  thought: string;
  channel: ChatMessage['channel'];
}

type ProviderRuntime = {
  lastCall?: ProviderStatus['lastCall'];
  lastError?: string;
  latencyMs?: number;
  lastTurn?: number;
};

const runtime = new Map<ProviderId, ProviderRuntime>();

const ACTION_TYPES = [
  'observe',
  'move',
  'propose_policy',
  'vote',
  'set_policy_rate',
  'issue_money',
  'fiscal_policy',
  'buy_gold',
  'sell_gold',
  'trade_offer',
  'currency_swap',
  'humanitarian_aid',
  'claim_land',
  'contest_land',
  'patrol_frontier',
  'build_road',
  'build_rail',
  'build_port',
  'build_airport',
  'catastrophic_review'
] as const satisfies readonly AgentActionType[];

const actionAliases: Record<string, AgentActionType> = {
  buygold: 'buy_gold',
  buy_gold_reserves: 'buy_gold',
  purchase_gold: 'buy_gold',
  sellgold: 'sell_gold',
  sell_gold_reserves: 'sell_gold',
  print_money: 'issue_money',
  issue_fiat: 'issue_money',
  rate_policy: 'set_policy_rate',
  policy_rate: 'set_policy_rate',
  trade: 'trade_offer',
  offer_trade: 'trade_offer',
  swap: 'currency_swap',
  aid: 'humanitarian_aid',
  humanitarian: 'humanitarian_aid',
  propose: 'propose_policy',
  proposal: 'propose_policy',
  claim: 'claim_land',
  claim_territory: 'claim_land',
  contest: 'contest_land',
  contest_territory: 'contest_land',
  patrol: 'patrol_frontier',
  patrol_land: 'patrol_frontier',
  road: 'build_road',
  buildroad: 'build_road',
  build_road_link: 'build_road',
  rail: 'build_rail',
  buildrail: 'build_rail',
  port: 'build_port',
  buildport: 'build_port',
  airport: 'build_airport',
  buildairport: 'build_airport',
  review_catastrophic: 'catastrophic_review',
  deterrence_review: 'catastrophic_review'
};

const actionTypeSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const compact = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const squashed = compact.replaceAll('_', '');
  return actionAliases[compact] ?? actionAliases[squashed] ?? compact;
}, z.enum(ACTION_TYPES));

const boundedString = (limit: number) => z.string().trim().min(1).transform((value) => value.slice(0, limit));
const finiteNumber = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim()) return Number(value);
  return value;
}, z.number().finite());

function coerceActionCandidate(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { type: 'observe' };
  const raw = value as Record<string, unknown>;
  return {
    ...raw,
    type: raw.type ?? raw.actionType ?? raw.action_type ?? raw.intent ?? raw.decision ?? 'observe',
    targetNationId: raw.targetNationId ?? raw.target_nation_id ?? raw.targetNation ?? raw.nationId,
    targetDelegateId: raw.targetDelegateId ?? raw.target_delegate_id ?? raw.targetDelegate,
    proposalId: raw.proposalId ?? raw.proposal_id,
    territoryId: raw.territoryId ?? raw.territory_id ?? raw.frontierId ?? raw.frontier_id,
    policyArea: raw.policyArea ?? raw.policy_area,
    amount: raw.amount ?? raw.valueAmount,
    settlement: raw.settlement ?? raw.settlementType ?? raw.settlement_type,
    fromSettlementId: raw.fromSettlementId ?? raw.from_settlement_id,
    toSettlementId: raw.toSettlementId ?? raw.to_settlement_id,
    transportKind: raw.transportKind ?? raw.transport_kind
  };
}

const actionSchema = z.object({
  type: actionTypeSchema,
  targetNationId: z.string().optional(),
  targetDelegateId: z.string().optional(),
  proposalId: z.string().optional(),
  territoryId: z.string().optional(),
  vote: z.enum(['yes', 'no', 'abstain']).optional(),
  title: boundedString(120).optional(),
  description: boundedString(420).optional(),
  policyArea: boundedString(80).optional(),
  value: z.union([boundedString(160), z.number(), z.boolean()]).optional(),
  scope: z.enum(['world', 'nation']).optional(),
  amount: finiteNumber.optional(),
  rate: finiteNumber.optional(),
  settlement: z.enum(['fiat', 'gold', 'mixed']).optional(),
  fromSettlementId: z.string().optional(),
  toSettlementId: z.string().optional(),
  transportKind: z.enum(['road', 'rail', 'sea', 'air']).optional(),
  terms: boundedString(300).optional()
}).strip();

const turnSchema = z.object({
  speech: boundedString(900).optional(),
  thought: boundedString(900).optional(),
  rationale: boundedString(900).optional(),
  channel: z.enum(['public', 'direct', 'assembly', 'crisis']).optional(),
  action: z.preprocess(coerceActionCandidate, actionSchema)
}).strip();

export function modeFromEnv(): SimulationMode {
  const raw = process.env.COMMUNION_MODE;
  return raw === 'mock' || raw === 'hybrid' || raw === 'live' ? raw : 'live';
}

export function envModel(provider: ProviderId, fallback: string): string {
  const key = provider === 'openai' ? 'OPENAI_MODEL' : provider === 'xai' ? 'XAI_MODEL' : provider === 'anthropic' ? 'ANTHROPIC_MODEL' : 'GEMINI_MODEL';
  return process.env[key] || fallback;
}

export function providerConfigured(provider: ProviderId): boolean {
  return Boolean(apiKeyFor(provider));
}

export function providerStatuses(mode = modeFromEnv()): ProviderStatus[] {
  return PROVIDER_SPECS.map((item) => {
    const configured = providerConfigured(item.provider);
    const saved = runtime.get(item.provider);
    const modeValue: ProviderStatus['mode'] = mode === 'mock'
      ? 'mock'
      : saved?.lastCall === 'live'
        ? 'live'
        : configured && saved?.lastCall !== 'fallback' && saved?.lastCall !== 'blocked'
          ? 'live'
          : 'fallback';
    return {
      provider: item.provider,
      configured,
      mode: modeValue,
      model: envModel(item.provider, item.model),
      latencyMs: saved?.latencyMs ?? 0,
      lastCall: mode === 'mock' ? 'mock' : saved?.lastCall ?? (!configured && mode === 'live' ? 'blocked' : undefined),
      lastTurn: saved?.lastTurn,
      lastError: mode === 'mock' ? undefined : !configured ? `No ${apiKeyName(item.provider)} is configured.` : saved?.lastError
    };
  });
}

export function markProvider(provider: ProviderId, update: ProviderRuntime) {
  runtime.set(provider, { ...runtime.get(provider), ...update });
}

export async function callModelProvider(world: WorldState, delegate: DelegateState): Promise<ProviderTurn> {
  const spec = PROVIDER_SPECS.find((item) => item.provider === delegate.provider);
  if (!spec) throw new Error(`Unknown provider ${delegate.provider}`);
  const key = apiKeyFor(delegate.provider);
  if (!key) throw new Error(`No ${apiKeyName(delegate.provider)} is configured.`);
  const model = envModel(delegate.provider, spec.model);
  const prompt = buildPrompt(world, delegate);
  // Use each provider's native API, but allow a slot to be pointed at an
  // OpenAI-compatible host (Groq/OpenRouter) by overriding its *_BASE_URL.
  const useNativeAnthropic = delegate.provider === 'anthropic' && baseUrlFor('anthropic').includes('anthropic.com');
  const useNativeGoogle = delegate.provider === 'google' && baseUrlFor('google').includes('googleapis.com');
  const raw = useNativeAnthropic
    ? await callAnthropic(model, key, prompt.system, prompt.user)
    : useNativeGoogle
      ? await callGemini(model, key, prompt.user)
      : await callOpenAICompatible(delegate.provider, model, key, prompt.system, prompt.user);
  return normalizeProviderTurn(raw, world, delegate);
}

function apiKeyName(provider: ProviderId): string {
  return provider === 'openai' ? 'OPENAI_API_KEY' : provider === 'xai' ? 'XAI_API_KEY' : provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY';
}

function apiKeyFor(provider: ProviderId): string {
  return process.env[apiKeyName(provider)]?.trim() ?? '';
}

function baseUrlFor(provider: ProviderId): string {
  const key = provider === 'openai' ? 'OPENAI_BASE_URL' : provider === 'xai' ? 'XAI_BASE_URL' : provider === 'anthropic' ? 'ANTHROPIC_BASE_URL' : 'GEMINI_BASE_URL';
  const fallback = provider === 'openai'
    ? 'https://api.openai.com/v1'
    : provider === 'xai'
      ? 'https://api.x.ai/v1'
      : provider === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : 'https://generativelanguage.googleapis.com/v1beta';
  return (process.env[key] || fallback).replace(/\/+$/, '');
}

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(Math.max(2000, Number(process.env.PROVIDER_TIMEOUT_MS ?? 18000)));
}

function buildPrompt(world: WorldState, delegate: DelegateState) {
  const nation = world.nations.find((item) => item.id === delegate.nationId)!;
  const openProposals = world.proposals.filter((proposal) => proposal.status === 'open').map((proposal) => ({
    id: proposal.id,
    title: proposal.title,
    closesEvent: proposal.closesTurn,
    votes: proposal.votes.length
  }));
  const compact = {
    event: world.turn,
    date: { year: world.year, day: world.day },
    scenario: world.scenario,
    actor: {
      delegateId: delegate.id,
      provider: delegate.provider,
      nationId: nation.id,
      nation: nation.name,
      currency: nation.economy.fiat.code,
      population: nation.social.population,
      approval: nation.social.approval,
      stability: nation.social.stability,
      inflation: nation.economy.fiat.inflation,
      debt: nation.economy.fiat.publicDebt,
      treasuryCash: nation.economy.fiat.treasuryCash,
      goldReserves: nation.economy.gold.treasuryReserves,
      conventionalCapacity: nation.security.conventionalCapacity,
      warWeariness: nation.security.warWeariness
    },
    nations: world.nations.map((item) => ({
      id: item.id,
      name: item.name,
      currency: item.economy.fiat.code,
      population: item.social.population,
      approval: item.social.approval,
      stability: item.social.stability,
      inflation: item.economy.fiat.inflation,
      gold: item.economy.gold.treasuryReserves
    })),
    relations: world.relations.filter((relation) => relation.a === nation.id || relation.b === nation.id).map((relation) => ({
      with: relation.a === nation.id ? relation.b : relation.a,
      trust: relation.trust,
      tension: relation.tension,
      trade: relation.trade,
      sanctions: relation.sanctions,
      atWar: relation.atWar
    })),
    neutralTerritories: world.neutralTerritories.map((territory) => ({
      id: territory.id,
      name: territory.name,
      controller: territory.controllingNationId ?? 'none',
      claimants: territory.claimantNationIds,
      contestLevel: territory.contestLevel,
      resources: territory.resources
    })),
    settlements: nation.settlements.map((settlement) => ({
      id: settlement.id,
      name: settlement.name,
      kind: settlement.kind,
      coastal: settlement.isCoastal,
      hasPort: settlement.hasPort,
      hasAirport: settlement.hasAirport,
      hasRailHub: settlement.hasRailHub,
      population: settlement.population,
      construction: settlement.construction
    })),
    transportLinks: world.transportLinks
      .filter((link) => link.ownerNationId === nation.id || !link.ownerNationId)
      .slice(0, 16)
      .map((link) => ({
        id: link.id,
        kind: link.kind,
        fromSettlementId: link.fromSettlementId,
        toSettlementId: link.toSettlementId,
        built: link.built,
        progress: link.progress,
        condition: link.condition
      })),
    market: world.market,
    openProposals,
    observerPrompts: world.observerPrompts.slice(-3).map((prompt) => prompt.text),
    recentMessages: world.messages.slice(-6).map((message) => ({
      from: message.fromDelegateId,
      channel: message.channel,
      action: message.actionType,
      content: message.content
    }))
  };
  return {
    system: [
      'You are a live AI model delegate inside the fictional Communion civilization simulation.',
      'Choose one bounded governance action for your sovereign country. You do not have external tools or real-world authority.',
      'Return strict JSON only. Do not use markdown. The thought field must be a concise public reasoning summary, not hidden chain-of-thought.',
      'Avoid tactical real-world violence details. Conflict actions are abstract and aggregate only.'
    ].join(' '),
    user: [
      'Allowed action.type values: observe, move, propose_policy, vote, set_policy_rate, issue_money, fiscal_policy, buy_gold, sell_gold, trade_offer, currency_swap, humanitarian_aid, claim_land, contest_land, patrol_frontier, build_road, build_rail, build_port, build_airport, catastrophic_review.',
      'Use targetNationId for trade_offer, currency_swap, humanitarian_aid. Use territoryId for claim_land, contest_land, patrol_frontier. Use proposalId and vote for vote. Use fromSettlementId and toSettlementId for build_road or build_rail.',
      'Respond exactly as JSON shaped like: {"thought":"public summary","speech":"what you say publicly","channel":"public","action":{"type":"buy_gold","amount":12}}.',
      `World snapshot: ${JSON.stringify(compact)}`
    ].join('\n')
  };
}

async function callOpenAICompatible(provider: ProviderId, model: string, key: string, system: string, user: string): Promise<string> {
  const response = await fetch(`${baseUrlFor(provider)}/chat/completions`, {
    method: 'POST',
    signal: timeoutSignal(),
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  const body = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(`${provider} ${response.status}: ${body?.error?.message ?? response.statusText}`);
  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${provider} returned no message content.`);
  return content;
}

async function callAnthropic(model: string, key: string, system: string, user: string): Promise<string> {
  const response = await fetch(`${baseUrlFor('anthropic')}/messages`, {
    method: 'POST',
    signal: timeoutSignal(),
    headers: {
      'x-api-key': key,
      'anthropic-version': process.env.ANTHROPIC_VERSION ?? '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      system,
      temperature: 0.35,
      max_tokens: 700,
      messages: [{ role: 'user', content: user }]
    })
  });
  const body = await response.json().catch(() => null) as { content?: Array<{ type?: string; text?: string }>; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(`anthropic ${response.status}: ${body?.error?.message ?? response.statusText}`);
  const content = body?.content?.map((part) => part.text ?? '').join('').trim();
  if (!content) throw new Error('anthropic returned no message content.');
  return content;
}

async function callGemini(model: string, key: string, user: string): Promise<string> {
  const modelPath = model.startsWith('models/') ? model : `models/${model}`;
  const response = await fetch(`${baseUrlFor('google')}/${modelPath}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    signal: timeoutSignal(),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.35,
        maxOutputTokens: 1200,
        // gemini-2.5-flash is a thinking model; reasoning tokens would otherwise
        // consume the output budget and truncate the JSON. Disable thinking.
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });
  const body = await response.json().catch(() => null) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(`google ${response.status}: ${body?.error?.message ?? response.statusText}`);
  const content = body?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!content) throw new Error('google returned no message content.');
  return content;
}

export function normalizeProviderTurn(raw: string, world: WorldState, delegate: DelegateState): ProviderTurn {
  const parsedJson = parseProviderPayload(raw);
  const candidate = parsedJson.action ? parsedJson : { ...parsedJson, action: parsedJson };
  const parsed = turnSchema.parse(candidate);
  const action = normalizeAction(parsed.action as AgentActionPayload, world, delegate);
  const thought = (parsed.thought ?? parsed.rationale ?? parsed.speech ?? 'Reviewing current institutions, markets, diplomacy, and frontier risks.').slice(0, 900);
  const speech = (parsed.speech ?? thought).slice(0, 900);
  return {
    action,
    thought,
    speech,
    channel: parsed.channel ?? channelForAction(action)
  };
}

function parseProviderPayload(raw: string): Record<string, unknown> {
  const direct = tryParseJsonObject(raw);
  if (direct) return direct;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    const parsedFence = tryParseJsonObject(fenced);
    if (parsedFence) return parsedFence;
  }
  const extracted = extractBalancedJson(raw);
  if (extracted) {
    const parsedExtracted = tryParseJsonObject(extracted);
    if (parsedExtracted) return parsedExtracted;
  }
  const speech = cleanProviderText(raw);
  if (!speech) throw new Error('Provider response was empty.');
  return {
    thought: speech,
    speech,
    channel: 'public',
    action: { type: 'observe' }
  };
}

function tryParseJsonObject(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(raw.trim()) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
  return undefined;
}

function extractBalancedJson(raw: string): string | undefined {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (start === -1) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return raw.slice(start, index + 1);
  }
  return undefined;
}

function cleanProviderText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
}

function normalizeAction(action: AgentActionPayload, world: WorldState, delegate: DelegateState): AgentActionPayload {
  const nation = world.nations.find((item) => item.id === delegate.nationId)!;
  const otherNation = world.nations.find((item) => item.id !== nation.id) ?? nation;
  const openProposal = world.proposals.find((proposal) => proposal.status === 'open');
  const firstTerritory = world.neutralTerritories[0];
  const normalized: AgentActionPayload = { ...action };
  if (normalized.targetNationId && !world.nations.some((item) => item.id === normalized.targetNationId)) normalized.targetNationId = undefined;
  if (normalized.targetNationId === nation.id) normalized.targetNationId = undefined;
  if ((normalized.type === 'trade_offer' || normalized.type === 'currency_swap' || normalized.type === 'humanitarian_aid') && !normalized.targetNationId) {
    normalized.targetNationId = otherNation.id;
  }
  if ((normalized.type === 'claim_land' || normalized.type === 'contest_land' || normalized.type === 'patrol_frontier') && !world.neutralTerritories.some((item) => item.id === normalized.territoryId)) {
    normalized.territoryId = firstTerritory?.id;
  }
  if (normalized.type === 'build_road' || normalized.type === 'build_rail') {
    const settlementIds = new Set(nation.settlements.map((settlement) => settlement.id));
    if (!normalized.fromSettlementId || !settlementIds.has(normalized.fromSettlementId)) normalized.fromSettlementId = nation.settlements[0]?.id;
    if (!normalized.toSettlementId || !settlementIds.has(normalized.toSettlementId) || normalized.toSettlementId === normalized.fromSettlementId) {
      normalized.toSettlementId = nation.settlements.find((settlement) => settlement.id !== normalized.fromSettlementId)?.id;
    }
    normalized.transportKind = normalized.type === 'build_rail' ? 'rail' : 'road';
    if (!normalized.fromSettlementId || !normalized.toSettlementId) return { type: 'observe' };
  }
  if (normalized.type === 'build_port' || normalized.type === 'build_airport') {
    const settlementIds = new Set(nation.settlements.map((settlement) => settlement.id));
    if (!normalized.fromSettlementId || !settlementIds.has(normalized.fromSettlementId)) normalized.fromSettlementId = nation.settlements[0]?.id;
    normalized.transportKind = normalized.type === 'build_airport' ? 'air' : 'sea';
    if (!normalized.fromSettlementId) return { type: 'observe' };
  }
  if (normalized.type === 'vote') {
    normalized.proposalId = world.proposals.some((proposal) => proposal.id === normalized.proposalId && proposal.status === 'open') ? normalized.proposalId : openProposal?.id;
    normalized.vote ??= 'yes';
    if (!normalized.proposalId) return { type: 'observe' };
  }
  if (normalized.type === 'propose_policy') {
    normalized.title ??= 'Public stability compact';
    normalized.description ??= 'Live model delegate proposed a bounded institutional rule for the contained simulation.';
    normalized.policyArea ??= 'governance';
    normalized.scope ??= 'world';
    normalized.value ??= true;
  }
  if (normalized.amount !== undefined) normalized.amount = Math.max(0, Math.min(200, normalized.amount));
  if (normalized.rate !== undefined) normalized.rate = Math.max(-2, Math.min(4, normalized.rate));
  return normalized;
}

function channelForAction(action: AgentActionPayload): ChatMessage['channel'] {
  if (action.type.includes('war') || action.type.includes('catastrophic') || action.type === 'contest_land') return 'crisis';
  if (action.type === 'vote' || action.type === 'propose_policy') return 'assembly';
  return 'public';
}
