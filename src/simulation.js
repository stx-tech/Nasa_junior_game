import { modules } from './missions.js';

const batteryCapacity = 10;

export function start(mission) {
  return {
    shift: 0, battery: mission.battery, air: mission.air ?? 2, water: 3, food: 3,
    crops: 0, growth: 0, samples: 0, radiation: 0, watered: false,
    status: 'active', feedback: [],
  };
}

export function available(mission, state) {
  return state.battery + (mission.generation[state.shift] ?? 0);
}

export function estimate(mission, state, selected) {
  const cost = selected.reduce((sum, key) => sum + modules[key].cost, 0);
  const remaining = available(mission, state) - cost;
  return { cost, remaining, stored: Math.min(batteryCapacity, remaining) };
}

export function choices(mission, state) {
  return mission.modules.filter(key => {
    if (key === 'shelter') return state.shift === mission.shelterShift;
    if (mission.id === 'earth' && key === 'lab') return state.shift === 0;
    if (key === 'lab' || key === 'greenhouse') return state.shift !== mission.shelterShift;
    if (key === 'pump') return state.shift === 1;
    return true;
  });
}

export function runShift(mission, previous, input) {
  if (previous.status !== 'active') return previous;
  const options = choices(mission, previous);
  const selected = new Set(input);
  if ([...selected].some(key => !options.includes(key))) return previous;
  const budget = estimate(mission, previous, [...selected]);
  if (budget.remaining < 0) return previous;

  const state = { ...previous, shift: previous.shift + 1, battery: budget.stored, feedback: [] };
  const note = message => state.feedback.push(message);
  note(`You stored ${state.battery} energy for the next shift.`);

  if (mission.id !== 'earth') {
    if (selected.has('crew')) {
      state.air = Math.min(mission.air ?? 2, state.air + 1);
      state.water = Math.min(4, state.water + 1);
      note('Life support restored air and recovered water.');
    } else {
      state.air -= 1;
      state.water -= 1;
      note('The crew used emergency air and water.');
    }
    if (previous.shift === mission.shelterShift) {
      if (selected.has('shelter')) note('The crew stayed protected in the shelter.');
      else {
        state.radiation += 1;
        note('The crew missed the shelter during the radiation alert.');
      }
    }
  }
  if (selected.has('greenhouse')) {
    if (state.water > 0) {
      state.water -= 1;
      state.growth += 1;
      if (state.growth === 2) {
        state.food += 3;
        state.crops += 1;
        state.growth = 0;
        note('The crop is ready. You added 3 food to the supply.');
      } else note('The crop grew. One more growing shift will finish it.');
    } else note('The greenhouse had no water. The crop did not grow.');
  }
  if (mission.id === 'mars') {
    state.food -= 1;
    note('The crew ate 1 food.');
  }
  if (selected.has('lab')) {
    state.samples += 1;
    note('The lab analyzed a sample.');
  }
  if (selected.has('pump')) {
    state.watered = true;
    note('The pump used the reserve to water the plants after sunset.');
  }

  const crewSafe = state.air > 0 && state.water > 0 && state.food >= 0 && state.radiation === 0;
  if (!crewSafe) {
    state.status = 'failed';
    note('The crew needs a safer plan. Review this shift and try again.');
  } else if (state.shift === mission.generation.length) {
    const complete = mission.id === 'earth'
      ? state.watered
      : state.samples >= mission.labTarget && state.crops >= (mission.cropTarget ?? 0);
    state.status = complete ? 'won' : 'failed';
    if (!complete) note(mission.id === 'earth'
      ? 'The pump needed 5 energy after sunset.'
      : 'The mission ended before you reached the science or harvest goal.');
  }
  return state;
}
