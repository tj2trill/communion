import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addObserverPrompt,
  applyScenario,
  authorizeCatastrophic,
  buySovereignGold,
  createInitialWorld,
  issueFiat,
  pulseWorld,
  recomputeWorld,
  sellSovereignGold,
  settleTrade,
  stepWorld,
  stepWorldWithProviders,
  totalGold,
  validateGoldConservation
} from '../world';
import { findRoute } from '../routing';
import { landPolygons, segmentOnLand } from '../terrain';

process.env.AUTO_START = 'false';
process.env.COMMUNION_MODE = 'mock';

test('initial world creates four sovereign model nations', () => {
  const world = createInitialWorld();
  assert.equal(world.nations.length, 4);
  assert.equal(world.delegates.length, 4);
  assert.equal(world.relations.length, 6);
  assert.equal(world.providerStatus.every((provider) => provider.mode === 'mock'), true);
  assert.equal(world.nations.every((nation) => nation.institutions.length >= 12), true);
  assert.equal(world.stats.activeWars, 0);
});

test('initial fiat, gold, and world stats are populated', () => {
  const world = createInitialWorld();
  assert.ok(world.stats.population > 100_000_000);
  assert.ok(world.stats.gdp > 9_000);
  assert.ok(world.stats.moneySupply > 2_000);
  assert.ok(world.stats.goldReserves > 2_000);
  assert.equal(totalGold(world), 6400);
  assert.equal(validateGoldConservation(world), true);
  assert.equal(world.nations.every((nation) => nation.economy.gold.backingRatio > 0), true);
});

test('initial nations have persistent settlements and resource stockpiles', () => {
  const world = createInitialWorld();
  for (const nation of world.nations) {
    assert.equal(nation.settlements.length, 5);
    assert.ok(nation.civilianCohorts.length >= 4);
    assert.ok(nation.settlements.some((settlement) => settlement.kind === 'capital'));
    assert.ok(nation.settlements.every((settlement) => settlement.population > 1_000_000));
    assert.ok(nation.settlements.every((settlement) => settlement.resourceDemand.water > 0));
    assert.ok(nation.civilianCohorts.every((cohort) => cohort.representedPopulation > 0));
    assert.ok(nation.civilianCohorts.every((cohort) => cohort.fromSettlementId !== cohort.toSettlementId));
    assert.ok(nation.civilianCohorts.every((cohort) => cohort.mode === 'road' || cohort.mode === 'rail'));
    assert.ok(nation.civilianCohorts.every((cohort) => !cohort.blocked && cohort.routeLinkIds?.length));
    assert.ok(nation.settlements.every((settlement) => typeof settlement.isCoastal === 'boolean'));
    assert.ok(nation.resources.trees > 0);
    assert.ok(nation.resources.stone > 0);
    assert.ok(nation.resources.water > 0);
  }
  assert.ok(world.transportLinks.length >= 40);
  assert.ok(world.transportLinks.some((link) => link.kind === 'road' && link.built));
  assert.ok(world.transportLinks.some((link) => link.kind === 'rail' && link.built));
});

test('recompute backfills civilian cohorts for restored worlds', () => {
  const world = createInitialWorld();
  for (const nation of world.nations) {
    delete (nation as { civilianCohorts?: unknown }).civilianCohorts;
  }
  delete (world as { transportLinks?: unknown }).transportLinks;
  recomputeWorld(world);
  assert.equal(world.nations.every((nation) => nation.civilianCohorts.length >= 4), true);
  assert.ok(world.transportLinks.length >= 40);
  assert.equal(validateGoldConservation(world), true);
});

test('terrain passability and transport routing constrain movement', () => {
  const world = createInitialWorld();
  const polygons = landPolygons(world);
  const localA = world.nations[0].settlements[0];
  const localB = world.nations[0].settlements[1];
  const separated = world.nations[2].settlements[0];
  assert.equal(segmentOnLand(localA.position, localB.position, polygons, 22), true);
  assert.equal(segmentOnLand(localA.position, separated.position, polygons, 22), false);
  assert.ok(findRoute(localA.id, localB.id, world.transportLinks));
  assert.equal(findRoute(localA.id, separated.id, world.transportLinks), null);
});

test('civilian cohorts block instead of moving when no route is built', () => {
  const world = createInitialWorld();
  const nation = world.nations[0];
  const cohort = nation.civilianCohorts[0];
  const before = { ...cohort.position };
  for (const link of world.transportLinks.filter((item) => item.ownerNationId === nation.id)) {
    link.built = false;
  }
  pulseWorld(world, 17);
  assert.equal(cohort.blocked, true);
  assert.equal(cohort.blockReason, 'no-route');
  assert.deepEqual(cohort.position, nation.settlements.find((settlement) => settlement.id === cohort.fromSettlementId)?.position);
  assert.notDeepEqual(cohort.position, before);
  assert.equal(validateGoldConservation(world), true);
});

test('fiat issuance expands money and changes macro indicators without creating gold', () => {
  const world = createInitialWorld();
  const nation = world.nations[0];
  const moneyBefore = nation.economy.fiat.moneySupply;
  const debtBefore = nation.economy.fiat.publicDebt;
  const inflationBefore = nation.economy.fiat.inflation;
  const goldBefore = totalGold(world);
  issueFiat(world, nation.id, 80);
  assert.ok(nation.economy.fiat.moneySupply > moneyBefore);
  assert.ok(nation.economy.fiat.publicDebt > debtBefore);
  assert.ok(nation.economy.fiat.inflation > inflationBefore);
  assert.equal(totalGold(world), goldBefore);
});

test('sovereign gold purchases and sales conserve global gold stock', () => {
  const world = createInitialWorld();
  const nation = world.nations[0];
  const totalBefore = totalGold(world);
  const treasuryBefore = nation.economy.gold.treasuryReserves;
  buySovereignGold(world, nation.id, 35);
  assert.ok(nation.economy.gold.treasuryReserves > treasuryBefore);
  assert.equal(totalGold(world), totalBefore);
  sellSovereignGold(world, nation.id, 20);
  assert.equal(totalGold(world), totalBefore);
  assert.equal(validateGoldConservation(world), true);
});

test('mixed trade settlement moves fiat and gold between sovereign ledgers', () => {
  const world = createInitialWorld();
  const buyer = world.nations[0];
  const seller = world.nations[1];
  const buyerGoldBefore = buyer.economy.gold.treasuryReserves;
  const sellerGoldBefore = seller.economy.gold.treasuryReserves;
  const sellerCashBefore = seller.economy.fiat.treasuryCash;
  settleTrade(world, buyer.id, seller.id, 60, 'mixed');
  assert.ok(buyer.economy.gold.treasuryReserves < buyerGoldBefore);
  assert.ok(seller.economy.gold.treasuryReserves > sellerGoldBefore);
  assert.ok(seller.economy.fiat.treasuryCash > sellerCashBefore);
  assert.equal(totalGold(world), 6400);
});

test('contained scenarios mutate society and markets while preserving gold', () => {
  const world = createInitialWorld();
  applyScenario(world, 'resource-shock');
  assert.ok(world.market.foodPriceIndex > 99);
  assert.ok(world.stats.foodSecurity < 80);
  assert.equal(totalGold(world), 6400);
  applyScenario(world, 'rival-blocs');
  assert.equal(world.alliances.length, 2);
  assert.ok(world.relations.some((relation) => relation.sanctions > 0));
  assert.equal(validateGoldConservation(world), true);
});

test('catastrophic review cannot authorize until a later turn', () => {
  const world = createInitialWorld();
  applyScenario(world, 'deterrence');
  const review = world.wars[0].catastrophicReview;
  assert.ok(review);
  assert.equal(authorizeCatastrophic(world, review.id, review.actorNationId), false);
  world.turn = review.earliestAuthorizationTurn;
  assert.equal(authorizeCatastrophic(world, review.id, review.actorNationId), true);
  assert.equal(world.wars[0].catastrophicReview?.status, 'executed');
  assert.ok(world.stats.cumulativeCasualties > 0);
});

test('observer prompts are logged but do not directly command state', () => {
  const world = createInitialWorld();
  const turnBefore = world.turn;
  addObserverPrompt(world, 'Should states reduce inflation without harming food security?');
  assert.equal(world.turn, turnBefore);
  assert.equal(world.observerPrompts.length, 1);
  assert.ok(world.messages.at(-1)?.content.includes('Observer prompt received'));
});

test('ambient pulses move the world without creating audit events or gold', () => {
  const world = createInitialWorld();
  const eventBefore = world.turn;
  const gdpBefore = world.stats.gdp;
  const targetsBefore = world.delegates.map((delegate) => `${delegate.target.x}:${delegate.target.z}`).join('|');
  const builtAreaBefore = world.nations[0].settlements[0].builtArea;
  const resourceBefore = world.nations[0].resources.stone;
  const cohortBefore = { ...world.nations[0].civilianCohorts[0].position };
  pulseWorld(world, 11);
  assert.equal(world.turn, eventBefore);
  assert.equal(totalGold(world), 6400);
  assert.ok(world.stats.gdp > gdpBefore);
  assert.notEqual(world.delegates.map((delegate) => `${delegate.target.x}:${delegate.target.z}`).join('|'), targetsBefore);
  assert.ok(world.nations[0].settlements[0].builtArea >= builtAreaBefore);
  assert.notEqual(world.nations[0].resources.stone, resourceBefore);
  assert.notDeepEqual(world.nations[0].civilianCohorts[0].position, cohortBefore);
});

test('civilian cohorts react to resource shocks', () => {
  const world = createInitialWorld();
  const before = world.nations.map((nation) => nation.civilianCohorts[0].stress);
  applyScenario(world, 'resource-shock');
  assert.equal(totalGold(world), 6400);
  assert.ok(world.nations.every((nation, index) => nation.civilianCohorts[0].stress > before[index]));
  assert.ok(world.nations.some((nation) => nation.civilianCohorts.some((cohort) => cohort.purpose === 'migration')));
});

test('live mode blocks missing provider credentials instead of faking a model action', async () => {
  const previousMode = process.env.COMMUNION_MODE;
  try {
    process.env.COMMUNION_MODE = 'live';
    delete process.env.OPENAI_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const world = createInitialWorld();
    await stepWorldWithProviders(world);
    const active = world.delegates.find((delegate) => delegate.lastProviderSource === 'blocked' && delegate.turnCount > 0);
    assert.ok(active);
    assert.equal(active.lastActionType, 'observe');
    assert.match(active.currentThought, /blocked/i);
    assert.equal(validateGoldConservation(world), true);
  } finally {
    process.env.COMMUNION_MODE = previousMode;
  }
});

test('live scheduler surfaces every missing provider without round robin turns', async () => {
  const previousMode = process.env.COMMUNION_MODE;
  try {
    process.env.COMMUNION_MODE = 'live';
    delete process.env.OPENAI_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const world = createInitialWorld();
    for (let i = 0; i < world.delegates.length; i += 1) {
      await stepWorldWithProviders(world);
      assert.equal(validateGoldConservation(world), true);
    }
    assert.equal(world.delegates.every((delegate) => delegate.lastProviderSource === 'blocked'), true);
    assert.equal(world.delegates.every((delegate) => delegate.turnCount > 0), true);
    assert.equal(new Set(world.messages.slice(-4).map((message) => message.fromDelegateId)).size, 4);
  } finally {
    process.env.COMMUNION_MODE = previousMode;
  }
});

test('live flow frame can resolve multiple delegates concurrently', async () => {
  const previousMode = process.env.COMMUNION_MODE;
  const previousWidth = process.env.FLOW_ACTORS_PER_TICK;
  try {
    process.env.COMMUNION_MODE = 'live';
    process.env.FLOW_ACTORS_PER_TICK = '4';
    delete process.env.OPENAI_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const world = createInitialWorld();
    await stepWorldWithProviders(world);
    assert.equal(world.turn, 4);
    assert.equal(world.delegates.every((delegate) => delegate.turnCount === 1), true);
    assert.equal(world.delegates.every((delegate) => delegate.lastProviderSource === 'blocked'), true);
    assert.equal(new Set(world.messages.slice(-4).map((message) => message.fromDelegateId)).size, 4);
    assert.equal(validateGoldConservation(world), true);
  } finally {
    process.env.COMMUNION_MODE = previousMode;
    if (previousWidth === undefined) delete process.env.FLOW_ACTORS_PER_TICK;
    else process.env.FLOW_ACTORS_PER_TICK = previousWidth;
  }
});

test('mock provider stepping remains single delegate by default', async () => {
  const previousMode = process.env.COMMUNION_MODE;
  const previousWidth = process.env.FLOW_ACTORS_PER_TICK;
  try {
    process.env.COMMUNION_MODE = 'mock';
    delete process.env.FLOW_ACTORS_PER_TICK;
    const world = createInitialWorld();
    await stepWorldWithProviders(world);
    assert.equal(world.turn, 1);
    assert.equal(world.delegates.filter((delegate) => delegate.turnCount > 0).length, 1);
    assert.equal(validateGoldConservation(world), true);
  } finally {
    process.env.COMMUNION_MODE = previousMode;
    if (previousWidth === undefined) delete process.env.FLOW_ACTORS_PER_TICK;
    else process.env.FLOW_ACTORS_PER_TICK = previousWidth;
  }
});

test('deterministic stepping advances delegates and maintains invariants', () => {
  process.env.COMMUNION_MODE = 'mock';
  const world = createInitialWorld();
  for (let i = 0; i < 8; i += 1) {
    stepWorld(world);
    assert.equal(validateGoldConservation(world), true);
  }
  assert.equal(world.turn, 8);
  assert.equal(world.delegates.every((delegate) => delegate.turnCount > 0), true);
  assert.ok(world.messages.length > 4);
  assert.ok(world.decisions.length > 2);
});
