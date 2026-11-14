// Tiny stand-in rules so the map can be played end to end. Replace with Codex's simulation.
export const COSTS = { crew: 3, lab: 3 };
export const BATTERY_CAPACITY = 10;

export function startMission(mission) {
  return { shift: 0, battery: mission.startBattery, science: 0, lifeSupportMissed: 0, done: false, failed: false, log: [] };
}

export function plannedCost(selected) {
  return selected.reduce((s, k) => s + (COSTS[k] || 0), 0);
}

export function runShift(state, selected, mission) {
  const gen = mission.generation[state.shift] ?? 0;
  const available = state.battery + gen;
  const cost = plannedCost(selected);
  if (cost > available) return { ...state, error: 'Not enough energy. Turn something off.' };
  const next = { ...state, error: null };
  next.battery = Math.min(BATTERY_CAPACITY, available - cost);
  const reasons = [];
  if (gen === 0) reasons.push('The panels were in shadow. Solar output was 0.');
  if (selected.includes('crew')) reasons.push('Life Support kept the crew safe.');
  else { next.lifeSupportMissed += 1; reasons.push('Life Support was off. The crew used reserve air.'); }
  if (selected.includes('lab')) { next.science += 1; reasons.push(`The lab analyzed a sample (${next.science}/${mission.labGoal}).`); }
  reasons.push(`Battery now: ${next.battery}.`);
  next.log = [...state.log, reasons];
  next.shift = state.shift + 1;
  if (next.lifeSupportMissed >= 2) { next.failed = true; next.done = true; }
  if (next.shift >= mission.generation.length) {
    next.done = true;
    next.failed = next.failed || next.science < mission.labGoal || next.lifeSupportMissed > 0;
  }
  next.lastReasons = reasons;
  return next;
}
