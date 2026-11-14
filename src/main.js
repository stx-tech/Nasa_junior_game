import { missions, modules } from './missions.js';
import { available, choices, estimate, runShift, start } from './simulation.js';
import { mountScene } from './scene.js';
import { createTabletUI } from './fp/tablet-ui.js';
import './style.css';

// ---------------------------------------------------------------------------
// Game state (rules and scoring unchanged from the previous version)
// ---------------------------------------------------------------------------
const game = document.querySelector('#game');
let missionIndex = 0;
const newPose = () => ({});
let pose = newPose();
let state = start(missions[missionIndex]);
const selected = new Set();
let stage = 'intro'; // 'intro' -> 'mission' -> 'complete'
let baseline = 0;
let firstEarthResult = null;
let earthResult = null;
let hints = 0;
let retries = 0;
let earthHintShift = -1;
const precheck = { plan: null, why: null };
let freshReport = false; // the tablet shows "What changed" right after Run Shift

let view = null; // 3D controller from mountScene
let tablet = null; // HTML layer on the 3D tablet screen

const mission = () => missions[missionIndex];
const shownShift = () => Math.min(state.shift, mission().generation.length - 1);

// ---------------------------------------------------------------------------
// Shell: full-window 3D view with a compact HUD on top
// ---------------------------------------------------------------------------
game.innerHTML = `
  <div class="view" id="view">
    <header class="hud" aria-live="polite">
      <p class="hud-mission"><span class="hud-title"></span><span class="hud-shift"></span></p>
      <p class="hud-alert"></p>
      <p class="hud-selection" hidden></p>
    </header>
    <button class="tablet-toggle" type="button" aria-controls="mission-tablet" aria-expanded="false" hidden>
      <span class="tablet-icon" aria-hidden="true"></span> Tablet <kbd>T</kbd>
    </button>
    <p class="hud-help" hidden>WASD to move · Hold LMB to look · Click a module to pick it · T for tablet</p>
    <section class="intro-card" aria-labelledby="intro-title">
      <h1 id="intro-title">Junior Astronaut Mission Trainer</h1>
      <p>Train on the Moon and Mars. Bring your skills back to Earth.</p>
      <button type="button" class="intro-start">Start Training</button>
    </section>
  </div>`;
const viewEl = game.querySelector('#view');
const hud = {
  root: viewEl.querySelector('.hud'),
  title: viewEl.querySelector('.hud-title'),
  shift: viewEl.querySelector('.hud-shift'),
  alert: viewEl.querySelector('.hud-alert'),
  selection: viewEl.querySelector('.hud-selection'),
  help: viewEl.querySelector('.hud-help'),
  toggle: viewEl.querySelector('.tablet-toggle'),
  intro: viewEl.querySelector('.intro-card'),
  start: viewEl.querySelector('.intro-start'),
};

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  node.append(...children.filter(Boolean));
  return node;
}

// ---------------------------------------------------------------------------
// 3D view + tablet lifetime (one mount per mission, reused across shifts)
// ---------------------------------------------------------------------------
function mountMission() {
  view?.stop();
  tablet?.dispose();
  view = mountScene(viewEl, mission(), shownShift(), selected, toggleModule, pose, {
    onFrame: () => tablet?.sync(),
  });
  // HUD must stay above the canvas: move overlays after it in DOM order.
  viewEl.append(hud.root, hud.toggle, hud.help, hud.intro);
  if (!view.viewmodel) { tablet = null; return; }
  tablet = createTabletUI(viewEl, view.viewmodel, { onClosed: afterClose });
  tablet.panel.id = 'mission-tablet';
  view.viewmodel.on('state', updateInput);
  updateInput();
  renderTablet();
}

function updateInput() {
  if (!view) return;
  const open = view.viewmodel?.isOpen ?? false;
  view.setInputEnabled(stage !== 'intro' && !open);
  hud.toggle.setAttribute('aria-expanded', String(open));
  viewEl.classList.toggle('tablet-open', open);
}

function afterClose() {
  updateInput();
  if (stage === 'intro') hud.intro.hidden = false;
  view.focus();
}

function openTablet() {
  if (!tablet) return;
  hud.intro.hidden = true;
  if (!tablet.isOpen) renderTablet(); // always open on fresh data
  tablet.open();
  updateInput();
}

// T toggles the tablet, Esc closes it (also while it is still moving).
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey || !tablet) return;
  const typing = event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable]');
  if (event.code === 'KeyT' && !event.repeat && !typing) {
    if (stage === 'intro' && !tablet.isOpen && hud.intro.hidden === false) return; // press Start Training first
    event.preventDefault();
    if (tablet.isOpen) tablet.close(); else openTablet();
  } else if (event.code === 'Escape' && tablet.isOpen) {
    event.preventDefault();
    tablet.close();
  }
});
hud.toggle.addEventListener('click', () => { if (tablet.isOpen) tablet.close(); else openTablet(); });
hud.start.addEventListener('click', () => openTablet());

// ---------------------------------------------------------------------------
// Module selection (from 3D clicks or tablet buttons)
// ---------------------------------------------------------------------------
function toggleModule(key) {
  if (stage !== 'mission' || state.status !== 'active') return;
  if (!choices(mission(), state).includes(key)) return;
  if (selected.has(key)) selected.delete(key); else selected.add(key);
  updateHUD();
  renderTablet({ keepFocus: tablet?.isOpen }); // keep the tablet page in sync even while it is down
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function updateHUD() {
  const m = mission();
  const intro = stage === 'intro';
  hud.root.hidden = intro;
  hud.toggle.hidden = intro;
  hud.help.hidden = intro;
  if (stage === 'complete') {
    hud.title.textContent = 'Training Complete';
    hud.shift.textContent = '';
    hud.alert.textContent = 'Open the tablet to see your results.';
  } else {
    hud.title.textContent = m.title;
    if (state.status === 'active') {
      hud.shift.textContent = `Shift ${state.shift + 1} / ${m.generation.length}`;
      hud.alert.textContent = m.forecast[state.shift];
    } else {
      hud.shift.textContent = state.status === 'won' ? 'Complete' : 'Review';
      hud.alert.textContent = 'Open the tablet to see what happened.';
    }
  }
  const names = [...selected].map((k) => modules[k].name);
  hud.selection.hidden = !names.length || stage !== 'mission';
  hud.selection.textContent = names.length ? `Selected: ${names.join(', ')} · open the tablet to run the shift` : '';
}

// ---------------------------------------------------------------------------
// Tablet pages
// ---------------------------------------------------------------------------
function header(title, sub, { back = true } = {}) {
  return el('header', { class: 't-head' },
    el('div', {}, el('h2', { text: title }), sub ? el('p', { class: 't-sub', text: sub }) : null),
    back ? el('button', { type: 'button', class: 't-back', text: 'Back to Base', onclick: () => tablet.close() }) : null);
}

function feedbackList(items) {
  const ul = el('ul', { class: 't-feedback' });
  for (const message of items) ul.append(el('li', { text: message }));
  return ul;
}

function precheckPage() {
  const choice = (name, value, label) => {
    const input = el('input', { type: 'radio', name, value });
    input.checked = precheck[name] === value;
    input.addEventListener('change', () => { precheck[name] = value; begin.disabled = !(precheck.plan && precheck.why); });
    return el('label', { class: 'choice' }, input, el('span', { text: label }));
  };
  const begin = el('button', { type: 'button', class: 't-primary', text: 'Begin Moon Mission', onclick: () => {
    baseline = Number(precheck.plan === 'save') + Number(precheck.why === 'later');
    stage = 'mission';
    tablet.close();
    updateHUD();
    renderTablet();
  } });
  begin.disabled = !(precheck.plan && precheck.why);
  return [
    header('Before you launch', 'Warm-up · no hints, just your best plan', { back: false }),
    el('p', { class: 't-lead', text: 'You have 6 battery units. String lights cost 3 now. Your weather radio needs 4 tonight.' }),
    el('div', { class: 't-grid' },
      el('fieldset', { class: 'choices' }, el('legend', { text: 'What would you do?' }),
        choice('plan', 'save', 'Save the battery for tonight'),
        choice('plan', 'spend', 'Turn on the string lights now')),
      el('fieldset', { class: 'choices' }, el('legend', { text: 'Why?' }),
        choice('why', 'later', 'The radio needs enough energy later'),
        choice('why', 'now', 'The lights can use the energy right now'))),
    el('div', { class: 't-actions' }, begin),
  ];
}

function planPage() {
  const m = mission();
  const options = choices(m, state);
  const budget = estimate(m, state, [...selected]);
  const stats = `Energy: ${available(m, state)} · Planned: ${budget.cost} · Battery after shift: ${Math.max(0, budget.stored)}`
    + (m.id === 'earth' ? '' : ` · Air: ${state.air} · Water: ${state.water} · Samples: ${state.samples}`)
    + (m.id === 'mars' ? ` · Food: ${state.food} · Crop growth: ${state.growth}/2 · Harvests: ${state.crops}` : '');

  const info = el('section', { class: 't-col t-info' },
    el('p', { class: 't-objective', text: m.objective }),
    el('p', { class: 't-forecast', text: m.forecast[state.shift] }));
  if (state.feedback.length) {
    info.append(el('section', { class: `t-report${freshReport ? ' fresh' : ''}` },
      el('h3', { text: 'What changed last shift', tabindex: '-1', 'data-autofocus': freshReport ? true : null }),
      feedbackList(state.feedback)));
  }
  if (m.science) {
    info.append(el('details', {},
      el('summary', { text: 'How NASA data shapes this mission' }),
      el('p', { text: m.science.description }),
      el('a', { href: m.science.url, target: '_blank', rel: 'noopener', text: 'Read the NASA/JPL mission update' })));
  }

  const moduleButtons = el('div', { class: 'modules' });
  for (const key of m.modules) {
    const mod = modules[key];
    const can = options.includes(key);
    const btn = el('button', {
      type: 'button', 'aria-pressed': String(selected.has(key)), 'data-module': key,
      onclick: () => toggleModule(key),
    }, el('strong', { text: mod.name }), el('span', { text: `${mod.cost} energy · ${mod.description}${can ? '' : ' Unavailable this shift.'}` }));
    btn.disabled = !can;
    moduleButtons.append(btn);
  }
  const warning = el('p', { role: 'status', class: 't-warning', text: 'Your plan needs more energy than you have.' });
  warning.hidden = budget.remaining >= 0;
  const guess = el('input', { type: 'number', min: '0', max: '10', placeholder: '0–10' });
  const run = el('button', { type: 'button', class: 'tablet-run', text: 'Run Shift', onclick: () => {
    state = runShift(m, state, selected);
    if (guess.value !== '') state.feedback.unshift(`You predicted ${guess.value} energy. Your battery now has ${state.battery}.`);
    selected.clear();
    freshReport = true;
    view.setShift(shownShift());
    updateHUD();
    renderTablet();
  } });
  run.disabled = budget.remaining < 0;

  const plan = el('section', { class: 't-col t-plan' },
    el('h3', { text: 'Plan this shift' }),
    el('p', { class: 'stats', text: stats }),
    moduleButtons, warning,
    el('label', { class: 't-predict' }, 'Predict the battery after this shift ', guess));
  if (m.id === 'earth') {
    const hint = el('p', { class: 't-hint', text: 'The pump needs 5 energy after sunset. Check how much you can keep in the battery.' });
    if (earthHintShift === state.shift) plan.append(hint);
    else {
      const hintBtn = el('button', { type: 'button', text: 'Get a Hint', onclick: () => {
        earthHintShift = state.shift;
        hints += 1;
        hintBtn.replaceWith(hint);
      } });
      plan.append(hintBtn);
    }
  }
  plan.append(run);
  return [header(m.title, `Shift ${state.shift + 1} of ${m.generation.length}`), el('div', { class: 't-grid' }, info, plan)];
}

function resultPage() {
  const m = mission();
  const nodes = [header(state.status === 'won' ? 'Mission Complete' : 'Review Your Plan', m.title)];
  nodes.push(el('section', { class: 't-report fresh' },
    el('h3', { text: 'What happened', tabindex: '-1', 'data-autofocus': true }),
    feedbackList(state.feedback)));
  const actions = el('div', { class: 't-actions' });
  if (m.id === 'earth' && earthResult === null) {
    nodes.push(el('h3', { text: 'Why was it important to save energy before sunset?' }));
    for (const [label, plannedAhead] of [
      ['The pump would need power after sunset.', true],
      ['The lab needed all of the power right away.', false],
    ]) {
      actions.append(el('button', { type: 'button', text: label, onclick: () => {
        earthResult = Number(state.watered) + Number(plannedAhead);
        firstEarthResult ??= earthResult;
        if (state.watered) stage = 'complete';
        updateHUD();
        renderTablet();
      } }));
    }
  } else if (state.status === 'won') {
    actions.append(el('button', { type: 'button', class: 't-primary', text: 'Next Mission', onclick: () => {
      missionIndex += 1;
      startMission();
    } }));
  }
  if (m.id !== 'earth' || earthResult !== null) {
    actions.append(el('button', { type: 'button', text: 'Retry Mission', onclick: () => {
      if (m.id === 'earth') {
        retries += 1;
        earthResult = null;
        earthHintShift = -1;
      }
      startMission();
    } }));
  }
  nodes.push(actions);
  return nodes;
}

function completePage() {
  return [
    header('Training Complete', 'You kept the Earth station running by planning ahead.', { back: false }),
    el('p', { 'data-autofocus': true, tabindex: '-1', text: `Before training: ${baseline} / 2 · First Earth attempt: ${firstEarthResult} / 2 · Final Earth attempt: ${earthResult} / 2` }),
    el('p', { text: `Earth hints: ${hints} · Earth retries: ${retries}` }),
    el('h3', { text: 'Try it at home' }),
    el('p', { text: 'With a grown-up, make a plan for a power outage. Decide when you would need a flashlight and a charged phone. What should you keep in reserve?' }),
    el('div', { class: 't-actions' }, el('button', { type: 'button', class: 't-primary', text: 'Play Again', onclick: () => window.location.reload() })),
  ];
}

function renderTablet({ keepFocus = false } = {}) {
  if (!tablet) return;
  const active = document.activeElement;
  const focusKey = keepFocus && active?.dataset?.module;
  let page;
  if (stage === 'intro') page = precheckPage();
  else if (stage === 'complete') page = completePage();
  else if (state.status === 'active') page = planPage();
  else page = resultPage();
  tablet.content.replaceChildren(...page);
  tablet.content.scrollTop = 0;
  if (focusKey) tablet.content.querySelector(`[data-module="${focusKey}"]`)?.focus();
  else if (tablet.isOpen && view.viewmodel.state === 'up') {
    const auto = tablet.content.querySelector('[data-autofocus]');
    if (auto) auto.focus({ preventScroll: true }); else tablet.refocusIfLost();
  }
  freshReport = false;
}

function startMission() {
  state = start(mission());
  pose = newPose();
  selected.clear();
  freshReport = false;
  mountMission();
  updateHUD();
  openTablet(); // show the new objective right away; Back to Base starts walking
}

// ---------------------------------------------------------------------------
// Boot: the Moon base is visible from the first frame
// ---------------------------------------------------------------------------
mountMission();
updateHUD();
hud.start.focus({ preventScroll: true });

// Debug/test hooks (read-only use in scripts/check_intro.py).
window.__game = {
  get stage() { return stage; },
  get state() { return state; },
  get pose() { return pose; },
  get view() { return view; },
  get tablet() { return tablet; },
  get baseline() { return baseline; },
  get selected() { return [...selected]; },
};
