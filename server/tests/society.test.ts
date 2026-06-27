import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialWorld, pulseWorld, validateGoldConservation } from '../world';
import { setFunding, setRegulation } from '../society';

process.env.AUTO_START = 'false';
process.env.COMMUNION_MODE = 'mock';

test('society state is initialized and responds to policy levers', () => {
  const world = createInitialWorld();
  const nation = world.nations[0];
  assert.ok(nation.society);
  const before = {
    drugPrevalence: nation.society.drugPrevalence,
    publicHealth: nation.society.publicHealth,
    treasuryCash: nation.economy.fiat.treasuryCash
  };
  assert.equal(setRegulation(nation, 'drugPolicy', 'legal-regulated'), 'drugPolicy -> legal-regulated');
  assert.equal(setFunding(nation, 'healthFunding', 92), 'healthFunding -> 92');
  for (let i = 0; i < 4; i += 1) pulseWorld(world, 80 + i);
  assert.equal(nation.policy.drugPolicy, 'legal-regulated');
  assert.ok((nation.policy.healthFunding as number) > 80);
  assert.notEqual(nation.society?.drugPrevalence, before.drugPrevalence);
  assert.notEqual(nation.society?.publicHealth, before.publicHealth);
  assert.ok(nation.economy.fiat.treasuryCash < before.treasuryCash);
  assert.equal(validateGoldConservation(world), true);
});

test('settlement construction is gated by money and materials', () => {
  const world = createInitialWorld();
  const nation = world.nations[0];
  const settlement = nation.settlements[0];
  const builtAreaBefore = settlement.builtArea;
  nation.economy.fiat.treasuryCash = 0;
  nation.resources.trees = 0;
  nation.resources.stone = 0;
  nation.resources.sand = 0;
  pulseWorld(world, 91);
  assert.equal(settlement.constructionHalted, true);
  assert.equal(settlement.builtArea, builtAreaBefore);

  nation.economy.fiat.treasuryCash = 500;
  nation.resources.trees = 500;
  nation.resources.stone = 500;
  nation.resources.sand = 500;
  const cashBefore = nation.economy.fiat.treasuryCash;
  const stoneBefore = nation.resources.stone;
  pulseWorld(world, 92);
  assert.equal(settlement.constructionHalted, false);
  assert.ok(settlement.builtArea > builtAreaBefore);
  assert.ok(nation.economy.fiat.treasuryCash < cashBefore);
  assert.ok(nation.resources.stone < stoneBefore);
  assert.equal(validateGoldConservation(world), true);
});
