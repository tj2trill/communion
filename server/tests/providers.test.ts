import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProviderTurn } from '../providers';
import { createInitialWorld } from '../world';

process.env.AUTO_START = 'false';
process.env.COMMUNION_MODE = 'mock';

function fixture() {
  const world = createInitialWorld();
  const delegate = world.delegates[0];
  return { world, delegate };
}

test('provider parser accepts fenced JSON with aliases and numeric strings', () => {
  const { world, delegate } = fixture();
  const turn = normalizeProviderTurn(
    '```json\n{"thought":"Increase reserve credibility.","speech":"Buying gold.","action":{"action_type":"purchase gold","amount":"18"}}\n```',
    world,
    delegate
  );
  assert.equal(turn.action.type, 'buy_gold');
  assert.equal(turn.action.amount, 18);
  assert.equal(turn.thought, 'Increase reserve credibility.');
});

test('provider parser extracts JSON embedded in prose', () => {
  const { world, delegate } = fixture();
  const turn = normalizeProviderTurn(
    'I will respond with public JSON: {"rationale":"Food stability is weakening.","channel":"public","action":{"type":"aid","target_nation_id":"nation-lumen","amount":22}} Thank you.',
    world,
    delegate
  );
  assert.equal(turn.action.type, 'humanitarian_aid');
  assert.equal(turn.action.targetNationId, 'nation-lumen');
  assert.equal(turn.action.amount, 22);
  assert.equal(turn.thought, 'Food stability is weakening.');
});

test('provider parser treats non-json model prose as live observe text', () => {
  const { world, delegate } = fixture();
  const turn = normalizeProviderTurn(
    'The assembly should pause and review banking stress before moving reserves.',
    world,
    delegate
  );
  assert.equal(turn.action.type, 'observe');
  assert.equal(turn.speech, 'The assembly should pause and review banking stress before moving reserves.');
});

test('provider parser bounds long text before validation', () => {
  const { world, delegate } = fixture();
  const turn = normalizeProviderTurn(
    JSON.stringify({ thought: 'x'.repeat(1200), action: { type: 'propose', title: 'y'.repeat(400), description: 'z'.repeat(900) } }),
    world,
    delegate
  );
  assert.equal(turn.action.type, 'propose_policy');
  assert.equal(turn.thought.length, 900);
  assert.equal(turn.action.title?.length, 120);
  assert.equal(turn.action.description?.length, 420);
});
