// Enumerate every plan of every mission with the real rules (node scripts/plan_search.mjs [overrides.json]).
import { missions } from '../src/missions.js';
import { start, choices, runShift, estimate } from '../src/simulation.js';
const overrides = process.argv[2] ? JSON.parse(process.argv[2]) : {};
function subsets(arr) { const out = [[]]; for (const a of arr) { const n = out.length; for (let i = 0; i < n; i++) out.push([...out[i], a]); } return out; }
export function explore(m) {
  const wins = [], fails = {};
  (function rec(state, path) {
    if (state.status !== 'active') {
      if (state.status === 'won') wins.push(path);
      else fails[state.failReason] = (fails[state.failReason] || 0) + 1;
      return;
    }
    for (const s of subsets(choices(m, state))) {
      if (estimate(m, state, s).remaining < 0) continue;
      rec(runShift(m, state, s), [...path, s.join('+') || '-']);
    }
  })(start(m), []);
  return { wins, fails };
}
for (const base of missions) {
  const m = { ...base, ...(overrides[base.id] || {}) };
  const { wins, fails } = explore(m);
  const total = wins.length + Object.values(fails).reduce((a, b) => a + b, 0);
  console.log(`\n== ${m.id} battery ${m.battery} air ${m.air ?? 2} gen ${JSON.stringify(m.generation)} — ${wins.length} of ${total} plans win`);
  if (wins.length <= 40 || process.argv[3] === 'all') wins.forEach((w) => console.log('   WIN', w.join(' | ')));
  for (const [r, n] of Object.entries(fails).sort((a, b) => b[1] - a[1])) console.log(`   fail ×${n}: ${r}`);
}
