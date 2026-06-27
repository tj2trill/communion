import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { HealthResponse, WorldState } from '../src/lib/types';
import {
  addObserverPrompt,
  applyScenario,
  controlWorld,
  createInitialWorld,
  providerStatuses,
  stepWorld,
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
  action: z.enum(['run', 'pause', 'step', 'reset', 'speed']),
  speed: z.number().min(0.5).max(8).optional()
});

const scenarioSchema = z.object({
  id: z.enum(['gold-rush', 'currency-crisis', 'market-crash', 'resource-shock', 'rival-blocs', 'deterrence', 'recovery'])
});

const promptSchema = z.object({
  text: z.string().trim().min(1).max(1200)
});

let world = await loadWorld();
let tickCounter = 0;

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
  response.setHeader('Content-Disposition', `attachment; filename="communion-world-turn-${world.turn}.json"`);
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
  world = controlWorld(world, parsed.data.action, parsed.data.speed);
  await afterMutation(`control:${parsed.data.action}`);
  response.json({ ok: true, state: world });
});

app.post('/api/scenario', async (request, response) => {
  const parsed = scenarioSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).send(parsed.error.issues.map((issue) => issue.message).join('; '));
  world = applyScenario(world, parsed.data.id);
  await afterMutation(`scenario:${parsed.data.id}`);
  response.json({ ok: true, state: world });
});

app.post('/api/prompt', async (request, response) => {
  const parsed = promptSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).send(parsed.error.issues.map((issue) => issue.message).join('; '));
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

setInterval(() => {
  if (!world.running) return;
  tickCounter += world.speed;
  if (tickCounter < 1) return;
  const steps = Math.min(4, Math.floor(tickCounter));
  tickCounter -= steps;
  for (let i = 0; i < steps; i += 1) {
    world = stepWorld(world);
  }
  void afterMutation(`tick:${steps}`);
}, tickMs);

async function loadWorld(): Promise<WorldState> {
  if (restoreState && await exists(worldPath)) {
    const raw = await readFile(worldPath, 'utf8');
    const restored = JSON.parse(raw) as WorldState;
    restored.running = false;
    return restored;
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
    await mkdir(dataDir, { recursive: true });
    await writeFile(worldPath, JSON.stringify(world, null, 2));
    await audit(reason);
  }
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
