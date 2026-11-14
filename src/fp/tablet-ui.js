// HTML layer that sits exactly on the 3D tablet screen while the tablet is up.
// Keeps real buttons (keyboard focus, normal hit areas) instead of drawing UI into a texture.
//
//   const ui = createTabletUI(viewElement, viewmodel, { onClosed });
//   ui.content            // element to fill with tablet pages (game logic stays in main.js)
//   ui.open() / ui.close() / ui.toggle()
//   ui.sync()             // call every frame after vm.update() (scene.js does this via onFrame)
//
// Esc closes. Tab/Shift+Tab stay inside the tablet while it is open.
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"]), summary';

export function createTabletUI(view, vm, { onOpened, onClosed, label = 'Mission Tablet' } = {}) {
  const panel = document.createElement('section');
  panel.className = 'tablet-ui';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', label);
  panel.hidden = true;
  panel.inert = true;
  const content = document.createElement('div');
  content.className = 'tablet-content';
  panel.append(content);
  view.append(panel);

  let lastRect = '';
  let wantFocus = false;

  function place() {
    const r = vm.screenRect();
    const key = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
    if (key === lastRect) return;
    lastRect = key;
    Object.assign(panel.style, {
      left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
      fontSize: `${Math.max(13, Math.min(18, r.width / 34))}px`,
    });
    panel.classList.toggle('wide', r.width >= 620);
  }

  function sync() {
    const up = vm.state === 'up';
    if (up && panel.hidden) {
      panel.hidden = false;
      panel.inert = false;
      lastRect = '';
      place();
      requestAnimationFrame(() => panel.classList.add('shown'));
      if (wantFocus) focusFirst();
      onOpened?.();
    } else if (!up && !panel.hidden) {
      panel.classList.remove('shown');
      panel.hidden = true;
      panel.inert = true;
    }
    if (up) place();
  }

  function focusFirst() {
    wantFocus = false;
    const auto = content.querySelector('[data-autofocus]') || content.querySelector(FOCUSABLE);
    (auto || content).focus({ preventScroll: true });
  }

  function open({ focus = true } = {}) {
    wantFocus = focus;
    vm.open();
    if (vm.state === 'up') focusFirst();
  }
  function close() {
    if (!vm.isOpen) return;
    vm.close();
    onClosed?.();
  }
  function toggle() { if (vm.isOpen) close(); else open(); }

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // If content changes while open (e.g. after Run Shift), keep focus inside.
  function refocusIfLost() {
    if (!panel.hidden && !panel.contains(document.activeElement)) focusFirst();
  }

  return {
    panel, content, open, close, toggle, sync, refocusIfLost,
    get isOpen() { return vm.isOpen; },
    dispose() { panel.remove(); },
  };
}
