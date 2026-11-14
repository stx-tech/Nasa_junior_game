import { missions, modules } from './missions.js';
import { available, choices, estimate, runShift, start, preview, progress } from './simulation.js';
import { mountScene } from './scene.js';
import { createTabletUI } from './fp/tablet-ui.js';
import {
  t, LANGUAGES, getLanguage, setLanguage, onLanguageChange, missionText, moduleText, feedbackText,
} from './i18n.js';
import './style.css';

// ---------------------------------------------------------------------------
// Game state (rules and scoring unchanged)
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
let predictionOpen = false; // the optional prediction panel stays open across re-renders
let hints = 0;
let retries = 0;
let earthHintShift = -1;
const precheck = { plan: null, why: null };
let freshReport = false; // the tablet shows "What changed" right after Run Shift
// Battery prediction for the current shift: null = not set (optional), 0..10.
// Lives in game state so it survives closing the tablet, settings and language changes.
const prediction = { key: '', value: null };

let view = null; // 3D controller from mountScene
let tablet = null; // HTML layer on the 3D tablet screen
let settingsOpen = false;
let settingsReturn = null; // where focus goes back after Settings closes

const mission = () => missions[missionIndex];
const shownShift = () => Math.min(state.shift, mission().generation.length - 1);
const predictionKey = () => `${missionIndex}:${state.shift}:${retries}`;

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
    <div class="hud-actions">
      <button class="settings-toggle" type="button" aria-haspopup="dialog" aria-controls="settings-menu" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>
      </button>
      <button class="tablet-toggle" type="button" aria-controls="mission-tablet" aria-expanded="false" hidden>
        <span class="tablet-icon" aria-hidden="true"></span> <span class="tablet-toggle-text"></span> <kbd>T</kbd>
      </button>
    </div>
    <section class="settings-menu" id="settings-menu" role="dialog" aria-modal="true" aria-labelledby="settings-title" hidden>
      <header><h2 id="settings-title"></h2><button type="button" class="settings-close"></button></header>
      <fieldset class="lang-choices"><legend class="settings-lang-legend"></legend></fieldset>
    </section>
    <p class="hud-help" hidden></p>
    <section class="intro-card" aria-labelledby="intro-title">
      <h1 id="intro-title"></h1>
      <p class="intro-tagline"></p>
      <button type="button" class="intro-start"></button>
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
  actions: viewEl.querySelector('.hud-actions'),
  toggle: viewEl.querySelector('.tablet-toggle'),
  toggleText: viewEl.querySelector('.tablet-toggle-text'),
  gear: viewEl.querySelector('.settings-toggle'),
  settings: viewEl.querySelector('.settings-menu'),
  intro: viewEl.querySelector('.intro-card'),
  introTitle: viewEl.querySelector('#intro-title'),
  introTagline: viewEl.querySelector('.intro-tagline'),
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
    t,
  });
  // HUD must stay above the canvas: move overlays after it in DOM order.
  viewEl.append(hud.root, hud.actions, hud.help, hud.intro, hud.settings);
  view.setTexts(t);
  if (!view.viewmodel) { tablet = null; return; }
  tablet = createTabletUI(viewEl, view.viewmodel, { onClosed: afterClose, label: t('tablet.label') });
  tablet.panel.id = 'mission-tablet';
  viewEl.append(hud.settings); // settings menu above the tablet screen
  view.viewmodel.on('state', updateInput);
  updateInput();
  renderTablet();
}

function updateInput() {
  if (!view) return;
  const open = view.viewmodel?.isOpen ?? false;
  view.setInputEnabled(stage !== 'intro' && !open && !settingsOpen);
  hud.toggle.setAttribute('aria-expanded', String(open));
  viewEl.classList.toggle('tablet-open', open);
}

function afterClose() {
  updateInput();
  if (stage === 'intro') hud.intro.hidden = false;
  if (!settingsOpen) view.focus();
}

function openTablet() {
  if (!tablet) return;
  hud.intro.hidden = true;
  if (!tablet.isOpen) renderTablet(); // always open on fresh data
  tablet.open();
  updateInput();
}

// ---------------------------------------------------------------------------
// Settings (gear left of the Tablet button)
// ---------------------------------------------------------------------------
function renderSettings() {
  hud.settings.querySelector('#settings-title').textContent = t('settings.title');
  hud.settings.querySelector('.settings-close').textContent = t('settings.close');
  const fs = hud.settings.querySelector('.lang-choices');
  fs.querySelector('legend').textContent = t('settings.language');
  fs.querySelectorAll('label').forEach((n) => n.remove());
  for (const { code, label } of LANGUAGES) {
    const input = el('input', { type: 'radio', name: 'language', value: code, lang: code });
    input.checked = getLanguage() === code;
    input.addEventListener('change', () => setLanguage(code));
    fs.append(el('label', { class: 'choice', lang: code }, input, el('span', { text: label })));
  }
}

function openSettings() {
  if (settingsOpen) return;
  settingsOpen = true;
  settingsReturn = tablet?.isOpen ? (tablet.panel.contains(document.activeElement) ? document.activeElement : null) : null;
  renderSettings();
  hud.settings.hidden = false;
  hud.gear.setAttribute('aria-expanded', 'true');
  updateInput();
  (hud.settings.querySelector('input:checked') || hud.settings.querySelector('input')).focus({ preventScroll: true });
}

function closeSettings() {
  if (!settingsOpen) return;
  settingsOpen = false;
  hud.settings.hidden = true;
  hud.gear.setAttribute('aria-expanded', 'false');
  updateInput();
  // Back to where Settings was opened from: the tablet (if it is up) or the scene.
  if (tablet?.isOpen) {
    if (settingsReturn?.isConnected) settingsReturn.focus({ preventScroll: true });
    else tablet.refocusIfLost();
  } else if (stage === 'intro' && !hud.intro.hidden) {
    hud.start.focus({ preventScroll: true });
  } else view?.focus();
  settingsReturn = null;
}

hud.gear.addEventListener('click', () => (settingsOpen ? closeSettings() : openSettings()));
hud.settings.querySelector('.settings-close').addEventListener('click', closeSettings);
hud.settings.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const items = [...hud.settings.querySelectorAll('input:checked, button')];
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// T toggles the tablet; Esc closes Settings first, then the tablet.
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.code === 'Escape') {
    if (settingsOpen) { event.preventDefault(); event.stopPropagation(); closeSettings(); return; }
    if (tablet?.isOpen) { event.preventDefault(); tablet.close(); }
    return;
  }
  if (settingsOpen || !tablet) return;
  const typing = event.target instanceof HTMLElement && event.target.closest('input:not([type="range"]):not([type="radio"]), select, textarea, [contenteditable]');
  if (event.code === 'KeyT' && !event.repeat && !typing) {
    if (stage === 'intro' && !tablet.isOpen && hud.intro.hidden === false) return; // press Start Training first
    event.preventDefault();
    if (tablet.isOpen) tablet.close(); else openTablet();
  }
}, true);
hud.toggle.addEventListener('click', () => { if (tablet.isOpen) tablet.close(); else openTablet(); });
hud.start.addEventListener('click', () => openTablet());

// ---------------------------------------------------------------------------
// Module selection (from 3D clicks or tablet buttons)
// ---------------------------------------------------------------------------
let hudNoticeTimer = 0;
function hudNotice(text) {
  hud.selection.hidden = false;
  hud.selection.textContent = text;
  clearTimeout(hudNoticeTimer);
  hudNoticeTimer = setTimeout(updateHUD, 3000);
}

function toggleModule(key) {
  if (stage !== 'mission' || state.status !== 'active') return;
  if (!choices(mission(), state).includes(key)) {
    if (mission().modules.includes(key)) hudNotice(t('hud.unavailable', { name: moduleText(modules, key, 'name') }));
    return;
  }
  if (selected.has(key)) selected.delete(key); else selected.add(key);
  updateHUD();
  renderTablet({ keepFocus: tablet?.isOpen }); // keep the tablet page in sync even while it is down
}

// ---------------------------------------------------------------------------
// HUD + static texts
// ---------------------------------------------------------------------------
function updateWorld() {
  if (!view?.setStatus) return;
  const items = progress(mission(), state);
  const air = items.find((i) => i.key === 'air');
  const rocks = items.find((i) => i.key === 'rocks');
  const harvest = items.find((i) => i.key === 'harvest');
  const m = mission();
  let shelter = null;
  if (m.shelterShift !== undefined && state.shift === m.shelterShift && state.status === 'active') shelter = { text: t('world.radiation'), warn: true };
  else if (m.shelterShift !== undefined && state.shift > m.shelterShift && !/Shelter/.test(state.failReason ?? '')) shelter = { text: t('world.radiationPassed'), done: true };
  view.setStatus({
    crew: air ? { text: t('world.air', { v: air.value, t: air.target }), warn: air.value === 0 } : null,
    lab: rocks ? { text: t('world.rocks', { v: rocks.value, t: rocks.target }), done: rocks.done } : null,
    greenhouse: harvest ? {
      text: harvest.done ? t('world.harvested', { v: harvest.value, t: harvest.target }) : t('world.harvest', { v: harvest.value, t: harvest.target, g: harvest.growth }),
      done: harvest.done, stage: harvest.growth, harvested: harvest.value > 0,
    } : null,
    shelter,
  });
}

function updateHUD() {
  updateWorld();
  const m = mission();
  const intro = stage === 'intro';
  hud.root.hidden = intro;
  hud.toggle.hidden = intro;
  hud.help.hidden = intro;
  hud.help.textContent = m.id !== 'earth' ? t('hud.helpMoon') : t('hud.help'); // jump on the Moon and Mars
  if (stage === 'complete') {
    hud.title.textContent = t('hud.trainingComplete');
    hud.shift.textContent = '';
    hud.alert.textContent = t('hud.openFinal');
  } else {
    hud.title.textContent = missionText(m, 'title');
    if (state.status === 'active') {
      hud.shift.textContent = t('hud.shift', { n: state.shift + 1, total: m.generation.length });
      hud.alert.textContent = missionText(m, 'forecast', state.shift);
    } else {
      hud.shift.textContent = state.status === 'won' ? t('hud.complete') : t('hud.review');
      hud.alert.textContent = t('hud.openResults');
    }
  }
  const names = [...selected].map((k) => moduleText(modules, k, 'name'));
  hud.selection.hidden = !names.length || stage !== 'mission';
  hud.selection.textContent = names.length ? t('hud.selected', { list: names.join(', ') }) : '';
}

function renderStaticTexts() {
  document.title = t('app.title');
  hud.introTitle.textContent = t('app.title');
  hud.introTagline.textContent = t('intro.tagline');
  hud.start.textContent = t('intro.start');
  hud.toggleText.textContent = t('hud.tablet');
  hud.toggle.setAttribute('aria-label', t('hud.tabletLabel'));
  hud.gear.setAttribute('aria-label', t('hud.settings'));
  hud.gear.title = t('hud.settings');
  tablet?.panel.setAttribute('aria-label', t('tablet.label'));
  view?.setTexts(t);
}

// ---------------------------------------------------------------------------
// Tablet pages
// ---------------------------------------------------------------------------
function header(title, sub, { back = true } = {}) {
  return el('header', { class: 't-head' },
    el('div', {}, el('h2', { text: title }), sub ? el('p', { class: 't-sub', text: sub }) : null),
    back ? el('button', { type: 'button', class: 't-back', text: t('tablet.back'), onclick: () => tablet.close() }) : null);
}

function feedbackList(items) {
  const ul = el('ul', { class: 't-feedback' });
  for (const message of items) ul.append(el('li', { text: feedbackText(message) }));
  return ul;
}

// "What you did -> what changed -> why" for the last shift (same data for tablet and result page).
function shiftResultCard(m, { focus = false } = {}) {
  if (!state.cause && !state.lastPlan.length && !state.feedback.length) return null;
  const did = state.lastPlan.length
    ? t('report.did', { list: state.lastPlan.map((k) => moduleText(modules, k, 'name')).join(', ') })
    : t('report.didNothing');
  const changes = state.feedback.filter((msg) => !msg.startsWith('You predicted ') && !msg.startsWith('The crew ate '));
  const prediction = state.feedback.find((msg) => msg.startsWith('You predicted '));
  const card = el('section', { class: `t-result${focus ? ' fresh' : ''}` },
    el('h3', { text: t('report.title', { n: state.shift }), tabindex: '-1', 'data-autofocus': focus ? true : null }),
    el('p', { class: 'r-did' }, el('span', { class: 'r-label', text: '1' }), did),
    el('div', { class: 'r-changed' }, el('span', { class: 'r-label', text: '2' }),
      el('div', {}, el('strong', { text: t('report.changed') }), feedbackList(changes.slice(0, 3)))),
    state.cause ? el('p', { class: 'r-why' }, el('span', { class: 'r-label', text: '3' }),
      el('span', {}, el('strong', { text: `${t('report.why')}: ` }), feedbackText(state.cause))) : null,
    prediction ? el('p', { class: 'r-prediction', text: feedbackText(prediction) }) : null);
  if (state.feedback.length > 3) {
    card.append(el('details', { class: 't-details' }, el('summary', { text: t('report.all') }), feedbackList(state.feedback)));
  }
  return card;
}

function goalsList(m) {
  const items = progress(m, state);
  const list = el('ul', { class: 't-goals', 'aria-label': t('progress.title') });
  for (const it of items) {
    let text;
    if (it.key === 'rocks') text = t('progress.rocks', { v: it.value, t: it.target });
    else if (it.key === 'harvest') text = `${t('progress.harvest', { v: it.value, t: it.target })}${it.done ? '' : ` (${t('progress.growth', { g: it.growth })})`}`;
    else if (it.key === 'air') text = t('progress.air', { v: it.value, t: it.target });
    else if (it.key === 'food') text = t('progress.food', { v: it.value });
    else text = t('progress.watered', { v: it.value, t: it.target });
    const warn = (it.key === 'air' && it.value === 0) || (it.key === 'food' && it.value <= 1);
    list.append(el('li', { class: it.done ? 'done' : (warn ? 'warn' : '') }, it.done ? '✓ ' : '', text));
  }
  return list;
}

function precheckPage() {
  const choice = (name, value, key) => {
    const input = el('input', { type: 'radio', name, value });
    input.checked = precheck[name] === value;
    input.addEventListener('change', () => { precheck[name] = value; begin.disabled = !(precheck.plan && precheck.why); });
    return el('label', { class: 'choice' }, input, el('span', { text: t(key) }));
  };
  const begin = el('button', { type: 'button', class: 't-primary', text: t('warmup.begin'), onclick: () => {
    baseline = Number(precheck.plan === 'save') + Number(precheck.why === 'later');
    stage = 'mission';
    tablet.close();
    updateHUD();
    renderTablet();
  } });
  begin.disabled = !(precheck.plan && precheck.why);
  return [
    header(t('warmup.title'), t('warmup.sub'), { back: false }),
    el('p', { class: 't-lead', text: t('warmup.lead') }),
    el('div', { class: 't-grid' },
      el('fieldset', { class: 'choices' }, el('legend', { text: t('warmup.q1') }),
        choice('plan', 'save', 'warmup.save'),
        choice('plan', 'spend', 'warmup.spend')),
      el('fieldset', { class: 'choices' }, el('legend', { text: t('warmup.q2') }),
        choice('why', 'later', 'warmup.later'),
        choice('why', 'now', 'warmup.now'))),
    el('div', { class: 't-actions' }, begin),
  ];
}

// Prediction: slider 1–10 + a separate "0 · Empty battery" toggle (mutually exclusive).
function predictionControl() {
  if (prediction.key !== predictionKey()) { prediction.key = predictionKey(); prediction.value = null; }
  const slider = el('input', {
    type: 'range', id: 'predict-slider', min: '1', max: '10', step: '1',
    'aria-describedby': 'predict-help',
  });
  slider.value = String(prediction.value && prediction.value > 0 ? prediction.value : 5);
  const out = el('output', { class: 'predict-value', for: 'predict-slider', 'aria-hidden': 'true' });
  const status = el('span', { class: 'predict-status' });
  const zero = el('button', { type: 'button', class: 'predict-zero', 'aria-pressed': 'false', text: t('predict.zero') });
  const choose = el('button', { type: 'button', class: 'predict-choose' });
  const wrap = el('div', { class: 'predict', role: 'group', 'aria-labelledby': 'predict-label' },
    el('div', { class: 'predict-head' },
      el('label', { id: 'predict-label', for: 'predict-slider', text: t('predict.label') }),
      el('span', { class: 'predict-readout' }, out, status)),
    el('div', { class: 'predict-track' },
      el('span', { class: 'predict-end', 'aria-hidden': 'true', text: '1' }),
      slider,
      el('span', { class: 'predict-end', 'aria-hidden': 'true', text: '10' })),
    el('div', { class: 'predict-extra' }, zero, choose,
      el('span', { id: 'predict-help', class: 'predict-help', text: t('predict.help') })));

  function paint() {
    const v = prediction.value;
    const unset = v === null;
    wrap.classList.toggle('unset', unset || v === 0);
    zero.setAttribute('aria-pressed', String(v === 0));
    out.textContent = unset ? '—' : String(v);
    status.textContent = unset ? `${t('predict.notSet')} · ${t('predict.optional')}` : (v === 0 ? t('predict.emptyUnit') : t('predict.unit'));
    slider.setAttribute('aria-valuetext', unset || v === 0 ? t('predict.notSet') : t('predict.valueText', { n: slider.value }));
    choose.hidden = !unset;
    choose.textContent = t('predict.choose', { n: slider.value });
    slider.style.setProperty('--fill', `${((Number(slider.value) - 1) / 9) * 100}%`);
  }
  slider.addEventListener('input', () => { prediction.value = Number(slider.value); paint(); });
  // Enter/Space on the slider confirms the starting position without moving it.
  slider.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && prediction.value === null) { e.preventDefault(); prediction.value = Number(slider.value); paint(); }
  });
  zero.addEventListener('click', () => { prediction.value = prediction.value === 0 ? null : 0; paint(); });
  choose.addEventListener('click', () => { prediction.value = Number(slider.value); paint(); slider.focus(); });
  paint();
  return wrap;
}

function planPage() {
  const m = mission();
  const options = choices(m, state);
  const budget = estimate(m, state, [...selected]);
  const energy = [
    t('plan.energy', { n: available(m, state) }),
    t('plan.planned', { n: budget.cost }),
    t('plan.batteryAfter', { n: Math.max(0, budget.stored) }),
  ];
  const parts = [];
  // Air and rocks are shown in the goal chips (backup tanks), so the supplies line has only water.
  if (m.id !== 'earth') parts.push(t('plan.water', { n: state.water }));
  if (m.id === 'mars') parts.push(t('plan.food', { n: state.food }), t('plan.growth', { n: state.growth }), t('plan.harvests', { n: state.crops }));

  const info = el('section', { class: 't-col t-info' },
    el('p', { class: 't-objective', text: missionText(m, 'objective') }),
    el('p', { class: 't-forecast', text: missionText(m, 'forecast', state.shift) }));
  const resultCard = state.shift > 0 ? shiftResultCard(m, { focus: freshReport }) : null;
  if (resultCard) info.prepend(resultCard);
  if (m.science) {
    info.append(el('details', {},
      el('summary', { text: t('science.summary') }),
      el('p', { text: missionText(m, 'science') }),
      el('a', { href: m.science.url, target: '_blank', rel: 'noopener', text: t('science.link') })));
  }

  const moduleButtons = el('div', { class: 'modules' });
  for (const key of m.modules) {
    const can = options.includes(key);
    const on = selected.has(key);
    const btn = el('button', {
      type: 'button', 'aria-pressed': String(on), 'data-module': key,
      onclick: () => toggleModule(key),
    },
    el('strong', {}, moduleText(modules, key, 'name'), on ? el('span', { class: 'mod-selected', text: ` ✓ ${t('plan.selected')}` }) : null),
    el('span', { text: `${t('plan.cost', { n: modules[key].cost })} · ${moduleText(modules, key, 'description')}${can ? '' : ` ${t('plan.unavailable')}`}` }));
    btn.disabled = !can;
    moduleButtons.append(btn);
  }
  const warning = el('p', { role: 'status', class: 't-warning', text: t('plan.shortBy', { n: -budget.remaining }) });
  warning.hidden = budget.remaining >= 0;
  // Critical risks explained BEFORE the shift (same rules as runShift).
  const risks = preview(m, state, [...selected]);
  const riskList = el('ul', { class: 't-risks', 'aria-label': t('warn.title') });
  for (const r of risks.slice(0, 2)) riskList.append(el('li', { class: r.level }, r.level === 'danger' ? '⚠ ' : '• ', feedbackText(r.text)));
  riskList.hidden = !risks.length;
  const run = el('button', { type: 'button', class: 'tablet-run', text: t('plan.run'), onclick: () => {
    const predicted = prediction.value;
    state = runShift(m, state, selected);
    // English source string; feedbackText() translates it for display.
    if (predicted !== null) state.feedback.unshift(`You predicted ${predicted} energy. Your battery now has ${state.battery}.`);
    selected.clear();
    freshReport = true;
    view.setShift(shownShift());
    updateHUD();
    renderTablet();
  } });
  run.disabled = budget.remaining < 0;

  const plan = el('section', { class: 't-col t-plan' },
    el('p', { class: 'stats plan-energy', text: energy.join(' · ') }),
    moduleButtons);
  if (parts.length) plan.append(el('details', { class: 't-details' },
    el('summary', { text: t('plan.supplies') }),
    el('p', { class: 'stats', text: parts.join(' · ') })));
  const predictBox = el('details', { class: 't-details t-predict' },
    el('summary', { text: prediction.key === predictionKey() && prediction.value !== null
      ? t('predict.valueText', { n: prediction.value }) : t('plan.optionalPrediction') }),
    predictionControl());
  predictBox.open = predictionOpen;
  predictBox.addEventListener('toggle', () => { predictionOpen = predictBox.open; });
  plan.append(predictBox);
  if (m.id === 'earth') {
    const hint = el('p', { class: 't-hint', text: t('plan.hint') });
    if (earthHintShift === state.shift) plan.append(hint);
    else {
      const hintBtn = el('button', { type: 'button', text: t('plan.hintButton'), onclick: () => {
        earthHintShift = state.shift;
        hints += 1;
        hintBtn.replaceWith(hint);
      } });
      plan.append(hintBtn);
    }
  }
  const guide = el('aside', { class: 't-guide' },
    el('span', { class: 'guide-face', 'aria-hidden': 'true', text: '👩‍🚀' }),
    el('div', {}, el('strong', { text: t('plan.guide') }),
      el('p', { text: t(selected.size ? 'plan.guideSelected' : 'plan.guideStart') }),
      // First Moon shift: one question to think about (the child decides alone).
      m.id === 'moon' && state.shift === 0 ? el('p', { class: 'guide-question', text: t('plan.guideQuestionMoon') }) : null));
  return [header(missionText(m, 'title'), t('plan.shiftOf', { n: state.shift + 1, total: m.generation.length })),
    el('div', { class: 't-plan-scroll' }, guide, goalsList(m), el('div', { class: 't-grid' }, info, plan)),
    el('footer', { class: 't-plan-footer' }, warning, riskList, run)];
}

function resultPage() {
  const m = mission();
  const nodes = [header(state.status === 'won' ? t('result.won') : t('result.review'), missionText(m, 'title'))];
  if (state.failReason) {
    nodes.push(el('section', { class: 't-fail', role: 'alert' },
      el('h3', { text: t('result.whyStopped'), tabindex: '-1', 'data-autofocus': true }),
      el('p', { class: 'fail-reason', text: feedbackText(state.failReason) })));
  }
  const card = shiftResultCard(m, { focus: !state.failReason });
  if (card) nodes.push(card);
  nodes.push(goalsList(m));
  const actions = el('div', { class: 't-actions' });
  if (m.id === 'earth' && earthResult === null) {
    nodes.push(el('h3', { text: t('earth.question') }));
    for (const [key, plannedAhead] of [['earth.answerPump', true], ['earth.answerLab', false]]) {
      actions.append(el('button', { type: 'button', text: t(key), onclick: () => {
        earthResult = Number(state.watered) + Number(plannedAhead);
        firstEarthResult ??= earthResult;
        if (state.watered) stage = 'complete';
        updateHUD();
        renderTablet();
      } }));
    }
  } else if (state.status === 'won') {
    actions.append(el('button', { type: 'button', class: 't-primary', text: t('result.next'), onclick: () => {
      missionIndex += 1;
      startMission();
    } }));
  }
  if (m.id !== 'earth' || earthResult !== null) {
    const failed = state.status === 'failed';
    if (failed) nodes.push(el('p', { class: 't-sub', text: t('result.tryAgainHint') }));
    actions.append(el('button', { type: 'button', class: failed ? 't-primary' : null, text: t('result.retry'), onclick: () => {
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
    header(t('complete.title'), t('complete.sub'), { back: false }),
    el('p', { 'data-autofocus': true, tabindex: '-1', text: t('complete.scores', { b: baseline, f: firstEarthResult, e: earthResult }) }),
    el('p', { text: t('complete.hints', { h: hints, r: retries }) }),
    el('h3', { text: t('complete.home') }),
    el('p', { text: t('complete.homeText') }),
    el('div', { class: 't-actions' }, el('button', { type: 'button', class: 't-primary', text: t('complete.again'), onclick: () => window.location.reload() })),
  ];
}

function renderTablet({ keepFocus = false, quiet = false } = {}) {
  if (!tablet) return;
  const active = document.activeElement;
  const focusKey = keepFocus && active?.dataset?.module;
  const previousScroll = tablet.content.querySelector('.t-plan-scroll') ?? tablet.content;
  const scroll = previousScroll.scrollTop;
  let page;
  if (stage === 'intro') page = precheckPage();
  else if (stage === 'complete') page = completePage();
  else if (state.status === 'active') page = planPage();
  else page = resultPage();
  tablet.content.classList.toggle('planning', stage === 'mission' && state.status === 'active');
  tablet.content.replaceChildren(...page);
  if (quiet || focusKey) (tablet.content.querySelector('.t-plan-scroll') ?? tablet.content).scrollTop = scroll;
  if (quiet) return;
  tablet.content.scrollTop = 0;
  if (focusKey) tablet.content.querySelector(`[data-module="${focusKey}"]`)?.focus();
  else if (tablet.isOpen && view.viewmodel.state === 'up' && !settingsOpen) {
    const auto = tablet.content.querySelector('[data-autofocus]');
    if (auto) auto.focus({ preventScroll: true }); else tablet.refocusIfLost();
  }
  freshReport = false;
}

function startMission() {
  prediction.key = '';
  state = start(mission());
  pose = newPose();
  selected.clear();
  freshReport = false;
  mountMission();
  updateHUD();
  openTablet(); // show the new objective right away; Back to Base starts walking
}

// Language switch: everything re-renders in place (mission, shift, pose, tablet, answers kept).
onLanguageChange(() => {
  renderStaticTexts();
  updateHUD();
  const wasFresh = freshReport;
  renderTablet({ quiet: true });
  freshReport = wasFresh;
  renderSettings();
  hud.settings.querySelector('input:checked')?.focus({ preventScroll: true });
});

// ---------------------------------------------------------------------------
// Boot: the Moon base is visible from the first frame
// ---------------------------------------------------------------------------
mountMission();
renderStaticTexts();
updateHUD();
hud.start.focus({ preventScroll: true });

// Debug/test hooks (read-only use in scripts/check_*.py).
window.__game = {
  get stage() { return stage; },
  get state() { return state; },
  get pose() { return pose; },
  get view() { return view; },
  get tablet() { return tablet; },
  get baseline() { return baseline; },
  get selected() { return [...selected]; },
  get prediction() { return prediction.value; },
  get settingsOpen() { return settingsOpen; },
};
