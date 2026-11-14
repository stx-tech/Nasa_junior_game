// The guide at the bottom of the screen: ONE next action, computed from the game
// state (pure, no DOM). It reacts as soon as the child does the step.
//
//   nextStep(mission, state, selected, { near(id), readBattery, rockPos(id) }) -> { key, target }
//   key: an i18n key (guide.*); target: the object to mark with the light beam (or null)
//
// The guide never makes a choice for the child: optional work (lab, greenhouse,
// Earth's soil test) is offered as a question, and the child decides.
import { modules } from './missions.js';
import { available, choices, rockCounts } from './simulation.js';

export function nextStep(m, s, selected, ctx) {
  const near = (id) => !!ctx.near?.(id);
  const go = (id, walkKey, pressKey) => ({ key: near(id) ? pressKey : walkKey, target: id });
  if (s.status !== 'active') return { key: 'guide.openResult', target: null };
  const now = choices(m, s);
  const toConsole = (decideKey) => (near('console') ? { key: 'guide.consolePress', target: 'console' } : { key: decideKey ?? 'guide.console', target: 'console' });

  if (m.id === 'earth') {
    if (s.shift === 0) {
      if (!ctx.readBattery) return go('battery', 'guide.earthBattery', 'guide.earthRead');
      return toConsole('guide.earthDecide');
    }
    if (!selected.has('pump') && now.includes('pump')) return go('pump', 'guide.pump', 'guide.pumpPress');
    return toConsole();
  }

  // Space missions (Moon, Mars)
  if (s.carrying) return go('lab', 'guide.carryRock', 'guide.dropRock');
  const shelterNow = s.shift === m.shelterShift;
  if (shelterNow && !selected.has('shelter')) return go('shelter', 'guide.shelter', 'guide.shelterPress');
  const rc = rockCounts(s);
  const stillNeeded = (m.labTarget ?? 0) - s.samples - rc.tray;
  if (m.rocks && stillNeeded > 0 && rc.ground > 0 && !shelterNow) {
    // nearest rock still on the ground
    const ids = m.rocks.filter((id) => s.rocks[id] === 'ground');
    const id = ids.sort((a, b) => (ctx.rockDist?.(a) ?? 0) - (ctx.rockDist?.(b) ?? 0))[0];
    return go(`rock:${id}`, 'guide.findRock', 'guide.pickRock');
  }
  if (!selected.has('crew') && now.includes('crew') && available(m, s) >= modules.crew.cost) return go('crew', 'guide.crew', 'guide.crewPress');

  // Optional work: a question, not an order.
  const lab = now.includes('lab') && !selected.has('lab') && s.samples < (m.labTarget ?? 0);
  const plants = m.id === 'mars' && now.includes('greenhouse') && !selected.has('greenhouse') && s.crops < (m.cropTarget ?? 0);
  if (lab && plants) return toConsole('guide.decideBoth');
  if (lab) return toConsole('guide.decideLab');
  if (plants) return toConsole('guide.decidePlants');
  return toConsole();
}
