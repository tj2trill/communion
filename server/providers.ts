import { z } from 'zod';
import type {
  AgentActionPayload,
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

const actionTypeSchema = z.enum([
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
  'catastrophic_review'
]);

const actionSchema = z.object({
  type: actionTypeSchema,
  targetNationId: z.string().optional(),
  targetDelegateId: z.string().optional(),
  proposalId: z.string().optional(),
  territoryId: z.string().optional(),
  vote: z.enum(['yes', 'no', 'abstain']).optional(),
  title: z.string().max(120).optional(),
  description: z.string().max(420).optional(),
  policyArea: z.string().max(80).optional(),
  value: z.union([z.string().max(160), z.number(), z.boolean()]).optional(),
  scope: z.enum(['world', 'nation']).optional(),
  amount: z.number().finite().optional(),
  rate: z.number().finite().optional(),
  settlement: z.enum(['fiat', 'gold', 'mixed']).optional(),
  terms: z.string().max(300).optional()
}).strip();

const turnSchema = z.object({
  speech: z.string().trim().min(1).max(900).optional(),
  thought: z.string().trim().min(1).max(900).optional(),
  rationale: z.string().trim().min(1).max(900).optional(),
  channel: z.enum(['public', 'direct', 'assembly', 'crisis']).optional(),
  action: actionSchema
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
  const raw = delegate.provider === 'anthropic'
    ? await callAnthropic(model, key, prompt.system, prompt.user)
    : delegate.provider === 'google'
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
      'Allowed action.type values: observe, move, propose_policy, vote, set_policy_rate, issue_money, fiscal_policy, buy_gold, sell_gold, trade_offer, currency_swap, humanitarian_aid, claim_land, contest_land, patrol_frontier, catastrophic_review.',
      'Use targetNationId for trade_offer, currency_swap, humanitarian_aid. Use territoryId for claim_land, contest_land, patrol_frontier. Use proposalId and vote for vote.',
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
        maxOutputTokens: 700
      }
    })
  });
  const body = await response.json().catch(() => null) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(`google ${response.status}: ${body?.error?.message ?? response.statusText}`);
  const content = body?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!content) throw new Error('google returned no message content.');
  return content;
}

function normalizeProviderTurn(raw: string, world: WorldState, delegate: DelegateState): ProviderTurn {
  const parsedJson = parseJsonObject(raw);
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

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    throw new Error('Provider response was not valid JSON.');
  }
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
