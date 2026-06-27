import dotenv from 'dotenv';
// override:true so .env wins over any stale shell vars (e.g. an exported COMMUNION_MODE=mock).
dotenv.config({ override: true });
import express, { type Request, type Response } from 'express';
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { HealthResponse, WorldState } from '../src/lib/types';
import {
  addObserverPrompt,
  applyScenario,
  controlWorldAsync,
  createInitialWorld,
  pulseWorld,
  providerStatuses,
  recomputeWorld,
  stepWorldWithProviders,
  validateGoldConservation
} from './world';

const app = express();
const rootDir = process.cwd();
const dataDir = path.join(rootDir, 'data');
const worldPath = path.join(dataDir, 'world.json');
const auditPath = path.join(dataDir, 'audit.jsonl');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT ?? 8787);
const tickMs = Math.max(250, Number(process.env.TICK_MS ?? 1800));
const persistState = process.env.PERSIST_STATE === 'true';
const restoreState = process.env.RESTORE_STATE === 'true';
const clients = new Set<Response>();

const controlSchema = z.object({
  action: z.enum(['run', 'pause', 'step', 'reset', 'speed', 'mode']),
  speed: z.number().min(0.5).max(8).optional(),
  mode: z.enum(['mock', 'hybrid', 'live']).optional()
});

const scenarioSchema = z.object({
  id: z.enum(['gold-rush', 'currency-crisis', 'market-crash', 'resource-shock', 'rival-blocs', 'deterrence', 'recovery'])
});

const promptSchema = z.object({
  text: z.string().trim().min(1).max(1200)
});

let world = await loadWorld();
let tickCounter = 0;
let pulseCounter = 0;
let worldEpoch = 0;

app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (request.path.startsWith('/api')) {
    response.setHeader('Cache-Control', 'no-store');
  }
  next();
});
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_request, response) => {
  const body: HealthResponse = {
    ok: validateGoldConservation(world),
    mode: world.mode,
    running: world.running,
    turn: world.turn,
    providers: providerStatuses(world.mode)
  };
  response.json(body);
});

app.get('/api/state', (_request, response) => {
  response.json(world);
});

app.get('/api/export', (_request, response) => {
  response.setHeader('Content-Disposition', `attachment; filename="communion-world-event-${world.turn}.json"`);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.send(JSON.stringify(world, null, 2));
});

app.get('/api/stream', (request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  clients.add(response);
  sendEvent(response, world);
  request.on('close', () => {
    clients.delete(response);
  });
});

app.post('/api/control', async (request, response) => {
  const parsed = controlSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).send(parsed.error.issues.map((issue) => issue.message).join('; '));
  if (parsed.data.action === 'reset' || parsed.data.action === 'step' || parsed.data.action === 'mode') {
    worldEpoch += 1;
    tickCounter = 0;
    pulseCounter = 0;
  }
  world = await controlWorldAsync(world, parsed.data.action, parsed.data.speed, parsed.data.mode);
  await afterMutation(`control:${parsed.data.action}`);
  response.json({ ok: true, state: world });
});

app.post('/api/scenario', async (request, response) => {
  const parsed = scenarioSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).send(parsed.error.issues.map((issue) => issue.message).join('; '));
  worldEpoch += 1;
  world = applyScenario(world, parsed.data.id);
  await afterMutation(`scenario:${parsed.data.id}`);
  response.json({ ok: true, state: world });
});

app.post('/api/prompt', async (request, response) => {
  const parsed = promptSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).send(parsed.error.issues.map((issue) => issue.message).join('; '));
  worldEpoch += 1;
  world = addObserverPrompt(world, parsed.data.text);
  await afterMutation('prompt');
  response.json({ ok: true, state: world });
});

if (await exists(distDir)) {
  app.use(express.static(distDir, { index: false }));
  app.use((request, response, next) => {
    if (request.method === 'GET' && !request.path.startsWith('/api') && request.accepts('html')) {
      response.sendFile(path.join(distDir, 'index.html'));
      return;
    }
    next();
  });
}

app.listen(port, () => {
  console.log(`Communion server listening on http://localhost:${port}`);
});

let flowInFlight = false;

setInterval(() => {
  if (!world.running) return;
  pulseCounter += 1;
  world = pulseWorld(world, pulseCounter);
  broadcast(world);
  if (persistState && pulseCounter % 4 === 0) {
    void persistSnapshot();
  }
  tickCounter += world.speed;
  if (tickCounter < 1) return;
  if (flowInFlight) return;
  tickCounter = Math.max(0, tickCounter - 1);
  flowInFlight = true;
  void (async () => {
    const epochAtStart = worldEpoch;
    try {
      const nextWorld = await stepWorldWithProviders(world);
      if (epochAtStart !== worldEpoch) return;
      world = nextWorld;
      await afterMutation('flow');
    } catch (reason) {
      world.running = false;
      await audit(`flow-error:${reason instanceof Error ? reason.message : String(reason)}`);
      broadcast(world);
    } finally {
      flowInFlight = false;
    }
  })();
}, tickMs);

async function loadWorld(): Promise<WorldState> {
  if (restoreState && await exists(worldPath)) {
    const raw = await readFile(worldPath, 'utf8');
    const restored = JSON.parse(raw) as WorldState;
    restored.running = false;
    return recomputeWorld(restored);
  }
  return createInitialWorld();
}

async function afterMutation(reason: string) {
  if (!validateGoldConservation(world)) {
    world.running = false;
    await audit('invariant:gold-conservation-paused');
    throw new Error('Gold conservation invariant changed; simulation paused.');
  }
  broadcast(world);
  if (persistState) {
    await persistSnapshot();
    await audit(reason);
  }
}

async function persistSnapshot() {
  await mkdir(dataDir, { recursive: true });
  await writeFile(worldPath, JSON.stringify(world, null, 2));
}

async function audit(reason: string) {
  const latestDecision = world.decisions.at(-1);
  const latestMessage = world.messages.at(-1);
  await appendFile(auditPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    reason,
    turn: world.turn,
    scenario: world.scenario,
    running: world.running,
    stats: world.stats,
    latestDecision,
    latestMessage
  }) + '\n');
}

function broadcast(state: WorldState) {
  for (const client of clients) {
    sendEvent(client, state);
  }
}

function sendEvent(response: Response, state: WorldState) {
  response.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
