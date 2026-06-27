import assert from 'node:assert/strict';
import test from 'node:test';
import { generateCitizen } from '../../src/lib/citizen';
import { createInitialWorld } from '../world';

process.env.AUTO_START = 'false';
process.env.COMMUNION_MODE = 'mock';

test('citizen profiles are deterministic and respond to settlement context', () => {
  const world = createInitialWorld();
  const nation = world.nations[0];
  const settlement = nation.settlements[0];
  const citizen = generateCitizen(settlement, nation, 7);
  assert.deepEqual(generateCitizen(settlement, nation, 7), citizen);
  assert.notDeepEqual(generateCitizen(settlement, nation, 8), citizen);
  assert.equal(citizen.satisfaction.length, 6);
  assert.ok(citizen.overall >= 0 && citizen.overall <= 100);
  assert.ok(citizen.thought.includes(settlement.name) || citizen.thought.length > 12);
});
