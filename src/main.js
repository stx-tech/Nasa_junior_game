import { missions, modules } from './missions.js';
import { available, choices, estimate, runShift, start } from './simulation.js';
import { mountScene } from './scene.js';
import './style.css';

const game = document.querySelector('#game');
let missionIndex = 0;
const newPose = () => ({});
let pose = newPose();
let state = start(missions[missionIndex]);
let selected = new Set();
let stopScene = () => {};
let stage = 'intro';
let baseline = 0;
let firstEarthResult = null;
let earthResult = null;
let hints = 0;
let retries = 0;
let earthHintShift = -1;
let tabletOpen = false;

document.addEventListener('keydown', event => {
  if (event.code !== 'KeyT' || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable]')) return;
  game.querySelector('.tablet-toggle')?.click();
});

function button(label, handler, { disabled = false, pressed } = {}) {
  const element = document.createElement('button');
  element.textContent = label;
  element.disabled = disabled;
  if (pressed !== undefined) element.setAttribute('aria-pressed', pressed);
  element.addEventListener('click', handler);
  return element;
}

function writeHeading(title, description) {
  game.innerHTML = '<h1></h1><p class="description"></p>';
  game.querySelector('h1').textContent = title;
  game.querySelector('h1').tabIndex = -1;
  game.querySelector('p').textContent = description;
}

function render() {
  stopScene();
  stopScene = () => {};
  if (stage === 'intro') {
    writeHeading('Junior Astronaut Mission Trainer', 'Train on the Moon and Mars. Bring your skills back to Earth.');
    const form = document.createElement('form');
    form.innerHTML = `
      <h2>Before you launch</h2>
      <p>You have 6 battery units. String lights cost 3 now. Your weather radio needs 4 tonight.</p>
      <label for="plan">What would you do?</label>
      <select id="plan" name="plan" required>
        <option value="">Choose a plan</option>
        <option value="save">Save the battery for tonight</option>
        <option value="spend">Turn on the string lights now</option>
      </select>
      <label for="why">Why?</label>
      <select id="why" name="why" required>
        <option value="">Choose a reason</option>
        <option value="later">The radio needs enough energy later</option>
        <option value="now">The lights can use the energy right now</option>
      </select>
      <button type="submit">Launch to the Moon</button>`;
    form.addEventListener('submit', event => {
      event.preventDefault();
      const answers = new FormData(form);
      baseline = Number(answers.get('plan') === 'save') + Number(answers.get('why') === 'later');
      stage = 'mission';
      render();
    });
    game.append(form);
    return;
  }
  if (stage === 'complete') {
    writeHeading('Training Complete', 'You kept the Earth station running by planning ahead.');
    game.insertAdjacentHTML('beforeend', `
      <p>Before training: ${baseline} / 2 · First Earth attempt: ${firstEarthResult} / 2 · Final Earth attempt: ${earthResult} / 2</p>
      <p>Earth hints: ${hints} · Earth retries: ${retries}</p>
      <h2>Try it at home</h2>
      <p>With a grown-up, make a plan for a power outage. Decide when you would need a flashlight and a charged phone. What should you keep in reserve?</p>`);
    game.append(button('Play Again', () => window.location.reload()));
    return;
  }

  const mission = missions[missionIndex];
  writeHeading(mission.title, mission.objective);
  if (state.status !== 'active') {
    const title = document.createElement('h2');
    title.textContent = state.status === 'won' ? 'Mission Complete' : 'Review Your Plan';
    game.append(title);
    appendFeedback();
    if (mission.id === 'earth' && earthResult === null) {
      game.insertAdjacentHTML('beforeend', '<h3>Why was it important to save energy before sunset?</h3>');
      for (const [label, plannedAhead] of [
        ['The pump would need power after sunset.', true],
        ['The lab needed all of the power right away.', false],
      ]) {
        game.append(button(label, () => {
          earthResult = Number(state.watered) + Number(plannedAhead);
          firstEarthResult ??= earthResult;
          if (state.watered) stage = 'complete';
          render();
        }));
      }
    } else if (state.status === 'won') {
      game.append(button('Next Mission', () => {
        missionIndex += 1;
        state = start(missions[missionIndex]);
        pose = newPose();
        render();
      }));
    }
    if (mission.id !== 'earth' || earthResult !== null) {
      game.append(button('Retry Mission', () => {
        if (mission.id === 'earth') {
          retries += 1;
          earthResult = null;
          earthHintShift = -1;
        }
        state = start(mission);
        pose = newPose();
        render();
      }));
    }
    return;
  }

  const options = choices(mission, state);
  const canSelect = key => options.includes(key);
  function toggle(key) {
    if (!canSelect(key)) return;
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    controls.querySelector(`[data-module="${key}"]`).setAttribute('aria-pressed', selected.has(key));
    updateBudget();
  }

  const forecast = document.createElement('p');
  forecast.className = 'forecast';
  forecast.tabIndex = -1;
  forecast.textContent = `Shift ${state.shift + 1} of ${mission.generation.length} · ${mission.forecast[state.shift]}`;
  game.append(forecast);
  const view = document.createElement('div');
  view.className = 'view';
  game.append(view);
  stopScene = mountScene(view, mission, state.shift, selected, toggle, pose);
  const canvas = view.querySelector('canvas');
  const tablet = document.createElement('dialog');
  tablet.className = 'mission-tablet';
  tablet.setAttribute('aria-labelledby', 'tablet-title');
  tablet.id = 'mission-tablet';
  tablet.innerHTML = '<div class="tablet-bar"><h2 id="tablet-title">Mission Tablet</h2></div><div class="tablet-screen"></div>';
  const panel = tablet.querySelector('.tablet-screen');
  const close = button('Back to Base', () => tablet.close());
  close.autofocus = true;
  tablet.querySelector('.tablet-bar').append(close);
  const open = button('Mission Tablet · T', () => {
    if (tablet.open) {
      tablet.close();
      return;
    }
    showTablet();
  });
  open.className = 'tablet-toggle';
  open.setAttribute('aria-controls', tablet.id);
  open.setAttribute('aria-expanded', 'false');
  view.append(open, tablet);
  tablet.addEventListener('close', () => {
    if (!tablet.isConnected) return;
    tabletOpen = false;
    open.setAttribute('aria-expanded', 'false');
    (canvas ?? open).focus({ preventScroll: true });
  });

  function showTablet() {
    if (canvas && document.pointerLockElement === canvas) document.exitPointerLock();
    tablet.showModal();
    tabletOpen = true;
    open.setAttribute('aria-expanded', 'true');
  }

  if (canvas) {
    game.insertAdjacentHTML('beforeend', '<p class="scene-help">Click the scene to look with the mouse. WASD to walk · E or click to select · T for the tablet · Esc to release the mouse.</p>');
  }

  const stats = document.createElement('p');
  stats.className = 'stats';
  panel.append(stats);

  const controls = document.createElement('div');
  controls.className = 'modules';
  for (const key of mission.modules) {
    const module = modules[key];
    const label = `${module.name} · ${module.cost} energy · ${module.description}`;
    const control = button(canSelect(key) ? label : `${label} Unavailable this shift.`, () => toggle(key),
      { disabled: !canSelect(key), pressed: selected.has(key) });
    control.dataset.module = key;
    controls.append(control);
  }
  panel.append(controls);
  const budgetWarning = document.createElement('p');
  budgetWarning.setAttribute('role', 'status');
  budgetWarning.textContent = 'Your plan needs more energy than you have.';
  panel.append(budgetWarning);

  const prediction = document.createElement('label');
  prediction.textContent = 'Predict the battery after this shift.';
  const guess = document.createElement('input');
  guess.type = 'number';
  guess.min = '0';
  guess.max = '10';
  guess.placeholder = '0–10 energy';
  prediction.append(guess);
  const run = button('Run Shift', () => {
    state = runShift(mission, state, selected);
    if (guess.value !== '') {
      state.feedback.unshift(`You predicted ${guess.value} energy. Your battery now has ${state.battery}.`);
    }
    selected.clear();
    tabletOpen = state.status === 'active';
    render();
    if (!tabletOpen) game.querySelector('h1').focus();
  });
  run.className = 'tablet-run';
  panel.append(prediction, run);
  updateBudget();

  function updateBudget() {
    const budget = estimate(mission, state, [...selected]);
    stats.textContent = `Energy: ${available(mission, state)} · Planned: ${budget.cost} · Battery after shift: ${Math.max(0, budget.stored)}`
      + (mission.id === 'earth' ? '' : ` · Air: ${state.air} · Water: ${state.water} · Samples: ${state.samples}`)
      + (mission.id === 'mars' ? ` · Food: ${state.food} · Crop growth: ${state.growth}/2 · Harvests: ${state.crops}` : '');
    budgetWarning.hidden = budget.remaining >= 0;
    run.disabled = budget.remaining < 0;
  }
  if (mission.id === 'earth') {
    const hint = document.createElement('p');
    hint.textContent = 'The pump needs 5 energy after sunset. Check how much you can keep in the battery.';
    if (earthHintShift === state.shift) panel.append(hint);
    else panel.append(button('Get a Hint', event => {
      earthHintShift = state.shift;
      hints += 1;
      event.currentTarget.replaceWith(hint);
    }));
  }
  appendFeedback(panel);
  if (mission.science) {
    const source = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'How NASA data shapes this mission';
    const description = document.createElement('p');
    description.textContent = mission.science.description;
    const link = document.createElement('a');
    link.href = mission.science.url;
    link.textContent = 'Read the NASA/JPL mission update';
    link.target = '_blank';
    link.rel = 'noopener';
    source.append(summary, description, link);
    panel.append(source);
  }
  if (tabletOpen) showTablet();
}

function appendFeedback(container = game) {
  if (!state.feedback.length) return;
  const list = document.createElement('ul');
  for (const message of state.feedback) {
    const item = document.createElement('li');
    item.textContent = message;
    list.append(item);
  }
  container.append(list);
}

render();
