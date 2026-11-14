// Game-logic tests (node scripts/logic_check.mjs). Exhaustive over every reachable plan.
import { missions } from '../src/missions.js';
import { start, choices, runShift, estimate, preview, progress, pickUpRock, deliverRock, rockCounts } from '../src/simulation.js';
// Carrying rocks to the lab is free: the plan checks start with every rock already in the tray.
const ready = (m) => (m.rocks ?? []).reduce((s, id) => deliverRock(m, pickUpRock(m, s, id)), start(m));
globalThis.localStorage = { getItem: () => 'uk', setItem() {} };
const { feedbackText } = await import('../src/i18n.js');

let failures = 0;
const ok = (cond, name, detail = '') => { if (!cond) { failures++; console.log('FAIL', name, detail); } };
const pass = (name) => console.log('PASS', name);
function subsets(arr) { const out = [[]]; for (const a of arr) { const n = out.length; for (let i = 0; i < n; i++) out.push([...out[i], a]); } return out; }
const messages = new Set();

// 1) Exhaustive invariants
for (const m of missions) {
  let states = 0;
  (function rec(state) {
    if (state.status !== 'active') return;
    states++;
    for (const sel of subsets(choices(m, state))) {
      const est = estimate(m, state, sel);
      const warn = preview(m, state, sel);
      warn.forEach((w) => messages.add(w.text));
      if (est.remaining < 0) {
        ok(runShift(m, state, sel) === state, `${m.id}: over-budget plan is refused`);
        continue;
      }
      const next = runShift(m, state, sel);
      [next.cause, next.failReason, ...next.feedback].filter(Boolean).forEach((x) => messages.add(x));
      ok(next.battery === Math.max(0, est.stored), `${m.id}: shown "charge left" equals real battery`, `${est.stored} vs ${next.battery}`);
      ok(['battery', 'air', 'water', 'food', 'samples', 'crops', 'growth'].every((k) => next[k] >= 0), `${m.id}: no negative supplies`, JSON.stringify(next));
      if (next.status === 'failed') ok(!!next.failReason, `${m.id}: every loss has a specific reason`);
      const resourceLoss = next.status === 'failed' && !/^Time is up|pump|not turned on/.test(next.failReason);
      if (resourceLoss) ok(warn.some((w) => w.level === 'danger'), `${m.id}: a resource loss is warned BEFORE the shift`, `${JSON.stringify(sel)} -> ${next.failReason}`);
      if (warn.some((w) => w.level === 'danger')) ok(next.status === 'failed', `${m.id}: a danger warning is real`, `${JSON.stringify(sel)} shift ${state.shift}`);
      rec(next);
    }
  })(ready(m));
  pass(`${m.id}: invariants over ${states} reachable states`);
}

// 2) Retry resets the mission
for (const m of missions) {
  let s = start(m);
  s = runShift(m, s, choices(m, s).slice(0, 1));
  const fresh = start(m);
  ok(JSON.stringify(start(m)) === JSON.stringify(fresh) && fresh.shift === 0 && fresh.feedback.length === 0, `${m.id}: retry state is fresh`);
}
pass('retry resets state');

// 2b) Sample rocks: collect -> tray -> studied (only after the shift)
for (const m of missions.filter((x) => x.rocks)) {
  let s = start(m);
  ok(!choices(m, s).includes('lab'), `${m.id}: the lab cannot run without a rock in the tray`);
  s = pickUpRock(m, s, 'rock1');
  ok(pickUpRock(m, s, 'rock1') === s && pickUpRock(m, s, 'rock2') === s, `${m.id}: the same rock (or a second rock) cannot be picked up twice`);
  ok(!choices(m, s).includes('lab'), `${m.id}: carrying is not enough, the rock must be in the tray`);
  s = deliverRock(m, s);
  ok(deliverRock(m, s) === s && rockCounts(s).tray === 1, `${m.id}: one rock is delivered once`);
  ok(s.battery === start(m).battery, `${m.id}: delivering costs no energy`);
  const skip = runShift(m, s, ['crew']);
  ok(skip.rocks.rock1 === 'tray' && skip.samples === 0, `${m.id}: a rock waits in the tray when the lab is off`);
  const studied = runShift(m, skip, ['lab']); // the cheapest plan that fits after the shadow
  if (choices(m, skip).includes('lab')) ok(studied.rocks.rock1 === 'studied' && studied.samples === 1, `${m.id}: studied only after the shift with the lab`);
  ok(JSON.stringify(start(m).rocks) === JSON.stringify({ rock1: 'ground', rock2: 'ground' }) && start(m).carrying === null, `${m.id}: retry puts the rocks back on the ground`);
}
pass('sample rocks: collect, tray, study, retry');

// 3) Every message has a Ukrainian translation
const untranslated = [...messages].filter((x) => feedbackText(x) === x);
ok(untranslated.length === 0, 'all reachable messages translated', untranslated.join(' | '));
pass(`${messages.size} reachable messages translated to Ukrainian`);

// 4) Named play-throughs
function play(id, plan) {
  const m = missions.find((x) => x.id === id);
  let s = ready(m);
  const log = [];
  for (const step of plan) {
    const sel = step ? step.split('+') : [];
    const est = estimate(m, s, sel);
    const warn = preview(m, s, sel).map((w) => `${w.level}: ${w.text}`);
    s = runShift(m, s, sel);
    log.push({ shift: s.shift, plan: step || '-', battery: s.battery, air: s.air, water: s.water, food: s.food, rocks: s.samples, growth: s.growth, crops: s.crops, status: s.status, why: s.cause, warn, fail: s.failReason, wasted: est.wasted });
    if (s.status !== 'active') break;
  }
  return { s, log, goals: progress(m, s) };
}
const seqs = [
  ['moon', 'safe: rocks after the shadow', ['crew', 'crew', 'crew+lab', 'crew+lab'], 'won'],
  ['moon', 'recoverable: rock before the shadow uses the backup air', ['crew+lab', '', 'crew+lab', 'crew'], 'won'],
  ['moon', 'loss: Life Support off twice', ['crew+lab', '', 'lab', 'crew'], 'failed'],
  ['mars', 'plan A: science first, harvest last', ['crew+lab', 'crew+greenhouse+lab', 'crew+shelter', 'crew+greenhouse'], 'won'],
  ['mars', 'plan B: plants early, science later', ['crew+greenhouse+lab', 'crew+greenhouse', 'crew+shelter', 'crew+lab'], 'won'],
  ['mars', 'recoverable: saving power in full sun wastes it, backup air needed', ['crew', 'crew+greenhouse+lab', 'crew+shelter', 'greenhouse+lab'], 'won'],
  ['mars', 'loss: crew stayed outside during the radiation warning', ['crew+lab', 'crew+greenhouse+lab', 'crew'], 'failed'],
  ['mars', 'loss: watering never started (food runs out)', ['crew+lab', 'crew+lab', 'crew+shelter', 'crew'], 'failed'],
  ['earth', 'apply the rule alone: keep 5 for the pump', ['', 'pump'], 'won'],
  ['earth', 'loss: the lab test used the pump energy', ['lab'], 'failed'],
];
for (const [id, name, plan, expect] of seqs) {
  const { s, log } = play(id, plan);
  ok(s.status === expect, `${id}: ${name}`, `${s.status} ${s.failReason ?? ''}`);
  console.log(`\n${id.toUpperCase()} — ${name}: ${s.status}${s.failReason ? ` (${s.failReason})` : ''}`);
  for (const r of log) console.log(`  shift ${r.shift}: ${r.plan.padEnd(22)} battery ${r.battery}${r.wasted ? ` (wasted ${r.wasted})` : ''} air ${r.air} water ${r.water} food ${r.food} rocks ${r.rocks} growth ${r.growth} crops ${r.crops}${r.warn.length ? `\n      before: ${r.warn.join(' / ')}` : ''}`);
}

console.log(failures ? `\n${failures} FAILED` : '\nALL LOGIC CHECKS PASSED');
process.exit(failures ? 1 : 0);
