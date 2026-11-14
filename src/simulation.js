import { modules } from './missions.js';

// Game rules. Pure functions, no DOM. All player-facing sentences are English
// source strings; src/i18n.js translates them (feedbackText) by pattern.
//
//   start(mission)                       -> state
//   available / estimate / choices       -> budget + which modules can run this shift
//   preview(mission, state, selected)    -> warnings BEFORE Run Shift (critical risks first)
//   runShift(mission, state, selected)   -> next state with lastPlan, cause, feedback, failReason
//   progress(mission, state)             -> goal progress for the tablet ("Rocks: 1 of 2")
//
// Supplies never go below 0: when something runs out, the mission stops with a
// specific reason instead.

export const batteryCapacity = 10;
const CREW_COST = () => modules.crew.cost;

export function start(mission) {
  const airMax = mission.air ?? 2;
  return {
    shift: 0, battery: mission.battery, air: airMax, airMax, water: mission.water ?? 3, food: mission.food ?? 3,
    crops: 0, growth: 0, samples: 0, radiation: 0, watered: false,
    status: 'active', feedback: [], lastPlan: [], cause: null, failReason: null,
  };
}

export function available(mission, state) {
  return state.battery + (mission.generation[state.shift] ?? 0);
}

export function estimate(mission, state, selected) {
  const cost = selected.reduce((sum, key) => sum + modules[key].cost, 0);
  const remaining = available(mission, state) - cost;
  const stored = Math.min(batteryCapacity, remaining);
  return { cost, remaining, stored, wasted: Math.max(0, remaining - batteryCapacity) };
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

// Why the shift went the way it did (one sentence, about the power source).
function causeOf(mission, state, budget) {
  const gen = mission.generation[state.shift] ?? 0;
  if (mission.id === 'earth') return 'The power was out, so the station could only use the battery.';
  if (gen === 0) return 'The solar panels were in shadow, so all the power came from the battery.';
  if (mission.id === 'mars' && gen < 5) return `Dust blocked the sun, so the solar panels made only ${gen} energy.`;
  if (budget.wasted > 0) return `The solar panels made ${gen} energy. The battery was full, so ${budget.wasted} energy could not be saved.`;
  return `The solar panels made ${gen} energy in the sunlight.`;
}

export function preview(mission, state, input) {
  const selected = new Set(input);
  const warnings = [];
  if (state.status !== 'active') return warnings;
  const budget = estimate(mission, state, [...selected]);
  if (budget.remaining < 0) return warnings; // the budget line already says it
  const add = (level, text) => warnings.push({ level, text });
  const space = mission.id !== 'earth';

  if (space && !selected.has('crew')) {
    if (state.air - 1 <= 0) add('danger', 'If Life Support stays off, the air will run out and the mission will stop.');
    else add('info', `Life Support is off: the crew will use 1 backup air tank (${Math.max(0, state.air - 2)} left).`);
  }
  if (space && state.shift === mission.shelterShift && !selected.has('shelter')) {
    add('danger', 'Radiation warning: if the crew is not in the Shelter, the mission will stop.');
  }
  if (space) {
    const waterAfterCrew = Math.max(0, Math.min(4, state.water + (selected.has('crew') ? 1 : -1)));
    const plantsDrink = selected.has('greenhouse') && waterAfterCrew > 0 ? 1 : 0;
    if (selected.has('greenhouse') && waterAfterCrew < 1) add('info', 'There is no water for the plants. They will not grow.');
    if (waterAfterCrew - plantsDrink <= 0) add('danger', 'The water will run out and the mission will stop. Life Support cleans water.');
  }
  if (mission.id === 'mars') {
    const willHarvest = selected.has('greenhouse') && state.growth + 1 >= 2;
    if (state.food - 1 < 0 && !willHarvest) add('danger', 'The food will run out this shift.');
    else if (state.food - 1 === 0 && !willHarvest && state.shift + 1 < mission.generation.length) {
      add('info', 'After this shift there will be no food left. The crop must be ready next shift.');
    }
  }
  if (budget.wasted > 0) add('info', `The battery can hold only ${batteryCapacity}. ${budget.wasted} energy will be lost unless you use it now.`);

  // Look one shift ahead (not on Earth: there the child applies the rule alone).
  const next = state.shift + 1;
  if (mission.lookahead !== false && next < mission.generation.length && space) {
    const nextPower = Math.max(0, budget.stored) + (mission.generation[next] ?? 0);
    const need = CREW_COST() + (next === mission.shelterShift ? modules.shelter.cost : 0);
    if (nextPower < need) {
      add('info', next === mission.shelterShift
        ? `Next shift you will need ${need} energy for Life Support and the Shelter, but you would have only ${nextPower}.`
        : `Next shift you would have only ${nextPower} energy. Life Support needs ${CREW_COST()}.`);
    }
  }
  // Critical first.
  return warnings.sort((a, b) => (a.level === 'danger' ? -1 : 0) - (b.level === 'danger' ? -1 : 0));
}

export function runShift(mission, previous, input) {
  if (previous.status !== 'active') return previous;
  const options = choices(mission, previous);
  const selected = new Set(input);
  if ([...selected].some(key => !options.includes(key))) return previous;
  const budget = estimate(mission, previous, [...selected]);
  if (budget.remaining < 0) return previous;

  const state = {
    ...previous, shift: previous.shift + 1, battery: budget.stored, feedback: [],
    lastPlan: mission.modules.filter(key => selected.has(key)),
    cause: causeOf(mission, previous, budget), failReason: null,
  };
  const note = message => state.feedback.push(message);
  let fail = null;
  const failWith = (reason) => { if (!fail) fail = reason; };

  if (mission.id !== 'earth') {
    if (selected.has('crew')) {
      // The backup tank is single-use: Life Support keeps the crew breathing but does not refill it.
      state.water = Math.min(4, state.water + 1);
      note('Life Support gave the crew air and cleaned water.');
    } else {
      state.air = Math.max(0, state.air - 1);
      state.water = Math.max(0, state.water - 1);
      note(`Life Support was off. The crew used 1 backup air tank and 1 water. Backup tanks left: ${Math.max(0, state.air - 1)}.`);
      if (state.air === 0) failWith('The air ran out. Life Support was off and there was no backup air left.');
    }
    if (previous.shift === mission.shelterShift) {
      if (selected.has('shelter')) note('The crew waited safely in the Shelter during the radiation warning.');
      else {
        state.radiation += 1;
        note('The crew was outside during the radiation warning.');
        failWith('The crew was not in the Shelter during the radiation warning.');
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
      } else note('The plants grew. Water them one more time to get food.');
    } else note('The greenhouse had no water. The plants did not grow.');
  }
  if (mission.id === 'mars') {
    if (state.food > 0) {
      state.food -= 1;
      note('The crew ate 1 food.');
    } else {
      failWith('The food ran out before the crop was ready.');
    }
  }
  if (selected.has('lab')) {
    state.samples += 1;
    note(mission.id === 'earth' ? 'The lab finished its test.' : `The lab studied a rock. Rocks studied: ${state.samples} of ${mission.labTarget}.`);
  }
  if (selected.has('pump')) {
    state.watered = true;
    note('The pump used the saved energy to water the plants after sunset.');
  }
  if (mission.id !== 'earth' && state.water === 0) failWith('The water ran out. Turn on Life Support to clean water.');

  if (fail) {
    state.status = 'failed';
    state.failReason = fail;
  } else if (state.shift === mission.generation.length) {
    if (mission.id === 'earth') {
      state.status = state.watered ? 'won' : 'failed';
      if (!state.watered) state.failReason = available(mission, previous) >= modules.pump.cost
        ? 'You saved enough energy, but the pump was not turned on.'
        : `After sunset the pump needed ${modules.pump.cost} energy, but only ${available(mission, previous)} was left.`;
    } else {
      const rocksOk = state.samples >= mission.labTarget;
      const cropOk = state.crops >= (mission.cropTarget ?? 0);
      state.status = rocksOk && cropOk ? 'won' : 'failed';
      if (!rocksOk) state.failReason = `Time is up: you studied ${state.samples} of ${mission.labTarget} rocks.`;
      else if (!cropOk) state.failReason = 'Time is up: the crop was not harvested.';
    }
  } else if (mission.id === 'earth' && state.shift === 1 && available(mission, state) < modules.pump.cost) {
    // The pump can no longer run: say so now instead of letting the child press on.
    state.status = 'failed';
    state.failReason = `After sunset the pump needs ${modules.pump.cost} energy, but only ${available(mission, state)} is left.`;
  }
  return state;
}

// Goal progress for the tablet. `done` marks finished goals.
export function progress(mission, state) {
  const items = [];
  if (mission.id === 'earth') {
    items.push({ key: 'watered', value: state.watered ? 1 : 0, target: 1, done: state.watered });
    return items;
  }
  items.push({ key: 'rocks', value: state.samples, target: mission.labTarget, done: state.samples >= mission.labTarget });
  if (mission.cropTarget) items.push({ key: 'harvest', value: state.crops, target: mission.cropTarget, growth: state.growth, done: state.crops >= mission.cropTarget });
  // Shown as backup tanks: air 2 of max 2 = 1 of 1 backup left.
  items.push({ key: 'air', value: Math.max(0, state.air - 1), target: state.airMax - 1, done: false });
  if (mission.id === 'mars') items.push({ key: 'food', value: state.food, target: null, done: false });
  return items;
}
