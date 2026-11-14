import './style.css';
import { mountScene } from './scene.js';
import { MISSIONS } from './missions.js';
import { startMission, runShift, plannedCost, COSTS } from './simulation.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="topbar">
    <h1 id="title"></h1>
    <div class="stats" aria-live="polite">
      <span id="shift"></span>
      <span id="battery"></span>
      <span id="solar"></span>
    </div>
  </header>
  <main>
    <div id="view" class="view"></div>
    <p class="help">Walk: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · Look: arrow keys or drag · Click a module to select it</p>
    <section class="controls" aria-label="Plan this shift">
      <button id="btn-crew" class="module" aria-pressed="false" data-key="crew"><span class="ico" aria-hidden="true">≋</span> Life Support <small>needs ${COSTS.crew}</small></button>
      <button id="btn-lab" class="module" aria-pressed="false" data-key="lab"><span class="ico" aria-hidden="true">◆</span> Science Lab <small>needs ${COSTS.lab}</small></button>
      <span id="budget" class="budget"></span>
      <button id="run" class="run">Run Shift</button>
    </section>
    <section id="report" class="report" aria-live="polite"></section>
  </main>
`;

const view = document.querySelector('#view');
const ui = {
  title: document.querySelector('#title'),
  shift: document.querySelector('#shift'),
  battery: document.querySelector('#battery'),
  solar: document.querySelector('#solar'),
  budget: document.querySelector('#budget'),
  run: document.querySelector('#run'),
  report: document.querySelector('#report'),
  buttons: [...document.querySelectorAll('button.module')],
};

const game = {
  missionIndex: 0,
  state: null,
  selected: [],
  pose: {},
};

function mission() { return MISSIONS[game.missionIndex]; }

function toggle(key) {
  if (game.state.done) return;
  game.selected = game.selected.includes(key) ? game.selected.filter((k) => k !== key) : [...game.selected, key];
  render();
}

function render() {
  const m = mission();
  const s = game.state;
  const shown = Math.min(s.shift, m.generation.length - 1);
  const gen = m.generation[shown];
  ui.title.textContent = m.title;
  ui.shift.textContent = `Shift ${Math.min(s.shift + 1, m.generation.length)} of ${m.generation.length}`;
  ui.battery.textContent = `Battery ${s.battery}/10`;
  ui.solar.textContent = `Solar output: ${gen}${gen === 0 ? ' (shadow)' : ''}`;
  ui.solar.className = gen === 0 ? 'warn' : '';
  const cost = plannedCost(game.selected);
  const available = s.battery + gen;
  ui.budget.textContent = s.done ? '' : `Available ${available} · Planned ${cost} · Saved ${Math.max(0, available - cost)}`;
  for (const b of ui.buttons) {
    const on = game.selected.includes(b.dataset.key);
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('small').textContent = on ? 'Selected' : `needs ${COSTS[b.dataset.key]}`;
    b.disabled = s.done;
  }
  ui.run.disabled = !s.done && cost > available;
  ui.run.textContent = s.done ? (s.failed ? 'Try Again' : (game.missionIndex < MISSIONS.length - 1 ? `Next: ${MISSIONS[game.missionIndex + 1].title.split(' ·')[0]}` : 'Play again')) : (cost > available ? 'Not enough energy' : 'Run Shift');
  mountScene(view, m, shown, game.selected, toggle, game.pose);
}

function report(lines, cls = '') {
  ui.report.className = `report ${cls}`;
  ui.report.innerHTML = lines.map((l) => `<p>${l}</p>`).join('');
}

function start(index) {
  game.missionIndex = index;
  game.state = startMission(mission());
  game.selected = [];
  report([mission().briefing]);
  render();
}

ui.buttons.forEach((b) => b.addEventListener('click', () => toggle(b.dataset.key)));
ui.run.addEventListener('click', () => {
  const s = game.state;
  if (s.done) {
    if (s.failed) start(game.missionIndex);
    else start((game.missionIndex + 1) % MISSIONS.length);
    return;
  }
  const next = runShift(s, game.selected, mission());
  if (next.error) { report([next.error], 'warn'); return; }
  game.state = next;
  const lines = [...next.lastReasons];
  if (next.done) lines.push(next.failed ? 'Mission failed. Look at what happened and try again.' : 'Mission complete! The crew is safe and the samples are analyzed.');
  report(lines, next.done ? (next.failed ? 'warn' : 'good') : '');
  game.selected = [];
  render();
});

start(0);

// Test hooks (used by scripts/check-moon.mjs). Harmless in production.
window.__game = {
  get state() { return game.state; },
  get pose() { return game.pose; },
  get missionId() { return mission().id; },
  setPose(p) { Object.assign(game.pose, p); },
  stage() { return view.__stage; },
};
