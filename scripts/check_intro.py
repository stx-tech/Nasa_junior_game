# Headless check of the intro -> tablet -> Moon mission flow (Chrome + SwiftShader WebGL).
#   npm run build && npx vite preview --port 4174 &
#   python3 scripts/check_intro.py http://localhost:4174/ shots
# Software WebGL runs at ~2-3 fps, so waits are generous; on a real GPU it is instant.
import sys, os, json, math, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from world_helpers import deliver_rocks
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4174/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'shots'
CHROME = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
results = []

def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))

def run(p, width=1280, height=800, reduced=False, full=True):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=CHROME)
    ctx = b.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce' if reduced else 'no-preference')
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    pg.goto(URL)
    pg.wait_for_function('window.__game && window.__game.view && window.__game.view.canvas')
    pg.wait_for_timeout(1500)

    pose = lambda: pg.evaluate('({...window.__game.pose})')
    vm_state = lambda: pg.evaluate('window.__game.view.viewmodel.state')
    def wait_vm(s, timeout=20000):
        pg.wait_for_function(f'window.__game.view.viewmodel.state === "{s}"', timeout=timeout)
        pg.wait_for_timeout(500)
    def shot(name):
        pg.wait_for_timeout(500)
        pg.screenshot(path=f'{OUT}/{name}.png')
    def screen_of(x, y, z):
        return pg.evaluate('''([x,y,z]) => { const v = window.__game.view; const r = v.canvas.getBoundingClientRect();
            const p = v.camera.position.clone().set(x,y,z).project(v.camera);
            return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; }''', [x, y, z])
    return b, pg, errors, pose, vm_state, wait_vm, shot, screen_of

def main():
    with sync_playwright() as p:
        b, pg, errors, pose, vm_state, wait_vm, shot, screen_of = run(p)
        tag = 'desktop'

        # 1. First frame: world fills the window, compact Start Training
        layout = pg.evaluate('''() => { const c = window.__game.view.canvas.getBoundingClientRect();
            return { cw: c.width, ch: c.height, iw: innerWidth, ih: innerHeight,
                     scroll: document.scrollingElement.scrollHeight - innerHeight,
                     intro: !document.querySelector('.intro-card').hidden,
                     hud: !document.querySelector('.hud').hidden }; }''')
        check('3D view fills the window, no page scroll', layout['cw'] == layout['iw'] and layout['ch'] == layout['ih'] and layout['scroll'] <= 0, json.dumps(layout))
        check('first state: Start Training visible, HUD hidden', layout['intro'] and not layout['hud'])
        p0 = pose()
        shot('01_start')
        pg.keyboard.press('w'); pg.wait_for_timeout(300)
        check('no walking before the mission starts', pose() == p0)

        # 2. Start Training raises the tablet with the warm-up question
        pg.click('.intro-start')
        check('tablet starts raising', vm_state() in ('raising', 'up'))
        wait_vm('up')
        rects = pg.evaluate('''() => { const r = window.__game.view.viewmodel.screenRect(); const e = document.querySelector('.tablet-ui').getBoundingClientRect();
            return { r: [r.left, r.top, r.width, r.height].map(Math.round), e: [e.left, e.top, e.width, e.height].map(Math.round) }; }''')
        aligned = all(abs(a - b) <= 2 for a, b in zip(rects['r'], rects['e']))
        check('HTML screen is aligned with the 3D screen', aligned, json.dumps(rects))
        check('Begin is disabled until both answers are chosen', pg.is_disabled('.t-primary'))
        shot('02_tablet_warmup_gloves')
        pg.click('label.choice:has(input[value="save"])')
        pg.click('label.choice:has(input[value="later"])')
        check('Begin enabled after two answers', not pg.is_disabled('.t-primary'))
        pg.click('.t-primary')
        wait_vm('down')
        g = pg.evaluate('({ stage: window.__game.stage, baseline: window.__game.baseline })')
        check('Begin Moon Mission lowers the tablet and starts the mission', g['stage'] == 'mission', json.dumps(g))
        check('warm-up scored 0-2 (save + later = 2)', g['baseline'] == 2)
        check('camera stayed at spawn', pose() == p0)
        check('focus returned to the scene', pg.evaluate('document.activeElement === window.__game.view.canvas'))
        shot('03_mission_hud')

        # 3. Look only while LMB is held
        cx, cy = 700, 420
        pg.mouse.move(cx, cy)
        y0 = pose()['yaw']
        pg.mouse.move(cx + 80, cy, steps=4); pg.wait_for_timeout(300)
        check('moving the mouse without a button does not turn the camera', abs(pose()['yaw'] - y0) < 1e-9)
        pg.mouse.down(); pg.mouse.move(cx + 140, cy + 10, steps=6); pg.wait_for_timeout(200)
        y1 = pose()['yaw']
        check('holding LMB and dragging turns the camera', abs(y1 - y0) > 0.1, f'yaw {y0:.3f} -> {y1:.3f}')
        pg.mouse.up(); pg.mouse.move(cx + 300, cy + 40, steps=5); pg.wait_for_timeout(300)
        check('releasing LMB stops the camera', abs(pose()['yaw'] - y1) < 1e-9)
        # restore view to spawn yaw
        pg.evaluate(f'Object.assign(window.__game.pose, {json.dumps(p0)})'); pg.wait_for_timeout(1200)

        # 4. Short click selects a module; a drag that starts on it does not.
        # Actions need the player close to the object (same rule for click and E): stand at the airlock.
        pg.evaluate('Object.assign(window.__game.pose, {x: -5.5, z: 3.6, yaw: 0, pitch: 0.1})'); pg.wait_for_timeout(1200)
        p0 = pose()
        sp = screen_of(-5.5, 2.55, 1.75)  # Life Support sign
        pg.mouse.move(sp['x'], sp['y']); pg.mouse.down(); pg.mouse.move(sp['x'] + 3, sp['y'] + 2); pg.mouse.up()
        pg.wait_for_timeout(500)
        sel = pg.evaluate('document.querySelector(".hud-selection").textContent')
        check('short click (< 6 px) on Life Support selects it', 'Life Support' in sel, sel)
        check('short click does not turn the camera', abs(pose()['yaw'] - p0['yaw']) < 1e-9)
        pg.mouse.move(sp['x'], sp['y']); pg.mouse.down(); pg.mouse.move(sp['x'] + 60, sp['y'], steps=5); pg.mouse.up()
        pg.wait_for_timeout(400)
        sel2 = pg.evaluate('document.querySelector(".hud-selection").textContent')
        check('dragging from a module turns the view and does not toggle it', 'Life Support' in sel2 and abs(pose()['yaw'] - p0['yaw']) > 0.05)
        pg.evaluate(f'Object.assign(window.__game.pose, {json.dumps(p0)})'); pg.wait_for_timeout(1200)
        pg.evaluate('Object.assign(window.__game.pose, {x: 0, z: 11, yaw: -0.21, pitch: -0.06})'); pg.wait_for_timeout(800)
        p0 = pose()

        # 5. WASD walks; T pauses walking; Esc closes; fast presses settle
        pg.evaluate('window.__game.view.focus()')
        pg.keyboard.down('w'); pg.wait_for_timeout(1500); pg.keyboard.up('w'); pg.wait_for_timeout(400)
        p1 = pose()
        check('W walks forward', p1['z'] < p0['z'] - 0.5, json.dumps(p1))
        pg.keyboard.press('t')
        wait_vm('up')
        pg.keyboard.down('w'); pg.wait_for_timeout(1000); pg.keyboard.up('w')
        check('walking paused while the tablet is up', pose() == p1)
        check('Run Shift lives on the tablet', pg.is_visible('.tablet-run'))
        shot('04_tablet_plan_shift1')
        pg.keyboard.press('Escape'); wait_vm('down')
        check('Esc lowers the tablet; camera kept', pose() == p1)
        for _ in range(3): pg.keyboard.press('t'); pg.wait_for_timeout(40)
        wait_vm('up')
        check('3 fast T presses end with the tablet up (no stuck state)', vm_state() == 'up' and pg.is_visible('.tablet-ui'))
        pg.keyboard.press('t'); pg.wait_for_timeout(40); pg.keyboard.press('t'); pg.wait_for_timeout(40); pg.keyboard.press('t')
        wait_vm('down')
        check('3 more fast presses end with the tablet down', vm_state() == 'down')

        # 6. Run shifts on the tablet: canvas is not rebuilt, pose kept, report visible
        # (the lab studies rocks from its tray: carry both samples there first, in the world)
        deliver_rocks(pg)
        canvas_id = pg.evaluate('window.__canvasRef = window.__game.view.canvas, 1')
        pg.click('.tablet-toggle'); wait_vm('up')
        check('module picked in 3D shows as Selected on the tablet', pg.get_attribute('[data-module="crew"]', 'aria-pressed') == 'true')
        plan = [['crew'], ['crew'], ['crew', 'lab'], ['crew', 'lab']]
        for i, mods in enumerate(plan):
            for m in mods:
                if pg.get_attribute(f'[data-module="{m}"]', 'aria-pressed') != 'true':
                    pg.click(f'[data-module="{m}"]')
            pg.click('.tablet-run'); pg.wait_for_timeout(700)
            if i == 0:
                check('after Run Shift the tablet shows what changed', pg.is_visible('.t-result.fresh'))
                check('same canvas after Run Shift (no remount)', pg.evaluate('window.__canvasRef === window.__game.view.canvas'))
                check('camera position kept after Run Shift', pose() == p1)
                shot('05_tablet_after_shift1')
        st = pg.evaluate('window.__game.state')
        check('Moon mission won (LS, LS, LS+Lab, LS+Lab)', st['status'] == 'won', json.dumps({k: st[k] for k in ('status', 'battery', 'samples')}))
        shot('06_mission_complete')
        pg.click('text=Next Mission')
        pg.wait_for_timeout(1500)
        check('Next Mission mounts Mars; the tablet stays down and the guide shows the first step', pg.evaluate('window.__game.state.shift === 0') and pg.evaluate("document.querySelector('.hud-title').textContent.startsWith('Mars')") and vm_state() == 'down' and pg.is_visible('.guide-bar'))
        pg.click('.tablet-toggle'); wait_vm('up')
        pg.click('.t-back'); wait_vm('down')
        check('Back to Base closes and returns focus', pg.evaluate('document.activeElement === window.__game.view.canvas'))

        # 7. Blur resets held keys
        pg.keyboard.down('w'); pg.wait_for_timeout(400)
        pg.evaluate("window.dispatchEvent(new Event('blur'))")
        pa = pose(); pg.wait_for_timeout(800); pb = pose()
        pg.keyboard.up('w')
        check('window blur releases held keys', pa == pb)
        check('no page errors (desktop)', not errors, '; '.join(errors[:3]))
        b.close()

        # 8. Narrow window: portrait tablet, readable
        b, pg, errors, pose, vm_state, wait_vm, shot, screen_of = run(p, width=420, height=860)
        shot('07_narrow_start')
        pg.click('.intro-start'); wait_vm('up')
        r = pg.evaluate("(() => { const e = document.querySelector('.tablet-ui').getBoundingClientRect(); return [e.width, e.height]; })()")
        check('narrow: tablet turns portrait and screen is >= 300 px wide', r[1] > r[0] and r[0] >= 300, json.dumps(r))
        shot('08_narrow_tablet_warmup')
        check('no page errors (narrow)', not errors, '; '.join(errors[:3]))
        b.close()

        # 9. Reduced motion
        b, pg, errors, pose, vm_state, wait_vm, shot, screen_of = run(p, reduced=True)
        check('prefers-reduced-motion detected', pg.evaluate('window.__game.view.viewmodel.reducedMotion'))
        b.close()

        failed = [n for n, ok in results if not ok]
        print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')

main()
