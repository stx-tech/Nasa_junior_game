# Headless checks: prediction slider, Moon jump, Settings + Ukrainian (Chrome + SwiftShader).
#   npm run build && npx vite preview --port 4175 &
#   python3 scripts/check_slider_jump_lang.py http://localhost:4175/ shots
# Software WebGL is ~3 fps, so jump timing is measured in game time (view.debug.simTime).
import sys, json, math
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4175/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'shots'
CHROME = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
results = []

def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))

def new_page(p, width=1280, height=800, touch=False, storage=None):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=CHROME)
    ctx = b.new_context(viewport={'width': width, 'height': height}, has_touch=touch, storage_state=storage)
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    pg.goto(URL)
    pg.wait_for_function('window.__game && window.__game.view && window.__game.view.canvas')
    pg.wait_for_timeout(1200)
    return b, ctx, pg, errors

def helpers(pg):
    ev = pg.evaluate
    def wait_vm(s):
        pg.wait_for_function(f'window.__game.view.viewmodel.state === "{s}"', timeout=30000); pg.wait_for_timeout(400)
    def start_mission():
        pg.click('.intro-start'); wait_vm('up')
        pg.click('label.choice:has(input[value="save"])'); pg.click('label.choice:has(input[value="later"])')
        pg.click('.t-primary'); wait_vm('down')
    def dbg():
        return ev('({ g: window.__game.view.debug.grounded, y: window.__game.view.debug.feetY, gy: window.__game.view.debug.groundY, t: window.__game.view.debug.simTime, ...window.__game.pose })')
    def set_pose(x, z, bearing):
        ev(f'Object.assign(window.__game.pose, {{x:{x}, z:{z}, yaw:{-math.radians(bearing)}, pitch:-0.05}})')
        pg.wait_for_timeout(900)
    def wait_landed(timeout=60000):
        pg.wait_for_function('window.__game.view.debug.grounded', timeout=timeout)
    def wait_air():
        pg.wait_for_function('!window.__game.view.debug.grounded', timeout=20000)
    return ev, wait_vm, start_mission, dbg, set_pose, wait_landed, wait_air

def main():
    with sync_playwright() as p:
        b, ctx, pg, errors = new_page(p)
        ev, wait_vm, start_mission, dbg, set_pose, wait_landed, wait_air = helpers(pg)
        check('default language is English', ev('document.documentElement.lang') == 'en' and pg.inner_text('.intro-start') == 'Start Training')
        start_mission()

        # ---------- Settings position ----------
        r = ev('''(() => { const g = document.querySelector('.settings-toggle').getBoundingClientRect(); const t = document.querySelector('.tablet-toggle').getBoundingClientRect();
            return { g: [g.left, g.top, g.right, g.bottom], t: [t.left, t.top, t.right, t.bottom], name: document.querySelector('.settings-toggle').getAttribute('aria-label') }; })()''')
        check('gear sits immediately left of Tablet, top-right', r['g'][2] <= r['t'][0] and r['t'][0] - r['g'][2] <= 12 and abs((r['g'][1] + r['g'][3]) / 2 - (r['t'][1] + r['t'][3]) / 2) < 3 and r['t'][2] >= 1280 - 14, json.dumps(r))
        check('gear has accessible name "Settings"', r['name'] == 'Settings')

        # ---------- Jump (tablet closed, focus in scene) ----------
        ev('window.__game.view.focus()')
        d0 = dbg()
        pg.keyboard.press('Space'); wait_air(); t_take = dbg()['t']
        peak = 0
        while not ev('window.__game.view.debug.grounded'):
            d = dbg(); peak = max(peak, d['y'] - d['gy']); pg.wait_for_timeout(120)
        d1 = dbg()
        air = d1['t'] - t_take
        check('jump on the spot: 1.3–1.6 s in the air (game time)', 1.3 <= air <= 1.6, f'{air:.2f} s, apex ≈ {peak:.2f} m')
        check('lands back on the ground at the same spot', abs(d1['y'] - d1['gy']) < 1e-6 and abs(d1['x'] - d0['x']) < 1e-6 and abs(d1['z'] - d0['z']) < 1e-6)

        # jump with W: carries forward further than the takeoff point
        pg.keyboard.down('w'); pg.wait_for_timeout(300)
        before = dbg(); pg.keyboard.press('Space'); wait_air(); take = dbg()
        wait_landed(); land = dbg(); pg.keyboard.up('w')
        dist = math.hypot(land['x'] - take['x'], land['z'] - take['z'])
        check('jump with W moves forward through the air', dist > 4, f'{dist:.2f} m in {land["t"] - take["t"]:.2f} s')

        # holding Space = one jump; new press after landing = new jump
        set_pose(0, 11, 0); ev('window.__game.view.focus()')
        pg.keyboard.down('Space'); wait_air(); wait_landed()
        t_land = dbg()['t']
        # keep holding for 1.5 s of game time; track whether it ever leaves the ground again
        pg.evaluate('''(t0) => new Promise(res => { window.__airAgain = false; (function f() {
            if (!window.__game.view.debug.grounded) window.__airAgain = true;
            if (window.__game.view.debug.simTime < t0 + 1.5) requestAnimationFrame(f); else res(); })(); })''', t_land)
        again = ev('window.__airAgain')
        pg.keyboard.up('Space')
        check('holding Space gives exactly one jump', not again, f"held {dbg()['t'] - t_land:.2f} s of game time after landing")
        pg.keyboard.press('Space'); wait_air(); wait_landed()
        check('a new press after landing jumps again', True)

        # wall: jump with W into the Life Support airlock
        set_pose(-5.5, 5.0, 0); ev('window.__game.view.focus()')
        pg.keyboard.down('w'); pg.keyboard.press('Space'); wait_air(); wait_landed(); pg.wait_for_timeout(600); pg.keyboard.up('w')
        w = dbg()
        check('jumping into the base does not pass through it', w['z'] > 2.4, json.dumps({k: round(w[k], 2) for k in ('x', 'z')}))

        # map edge: jump toward the south boundary
        set_pose(0, 12.5, 180); ev('window.__game.view.focus()')
        pg.keyboard.down('w'); pg.keyboard.press('Space'); wait_air(); wait_landed(); pg.keyboard.up('w')
        e = dbg()
        check('jumping at the map edge stays inside the walk area', e['z'] <= 13.5 + 1e-6, f"z={e['z']:.2f}")

        # slope: jump down into the crater from its rim
        set_pose(-12, 1.6, 180); ev('window.__game.view.focus()')
        s0 = dbg()
        pg.keyboard.down('w'); pg.keyboard.press('Space'); wait_air(); wait_landed(); pg.keyboard.up('w')
        s1 = dbg()
        check('jump on a slope lands exactly on the terrain', s1['g'] and abs(s1['y'] - s1['gy']) < 1e-6, f"start ground {s0['gy']:.2f} → land ground {s1['gy']:.2f}")

        # tablet mid-air pauses the jump; closing resumes from the same height
        set_pose(0, 11, 0); ev('window.__game.view.focus()')
        pg.keyboard.press('Space'); wait_air(); pg.wait_for_timeout(700)
        pg.keyboard.press('t'); pg.wait_for_function('window.__game.view.viewmodel.isOpen')
        y_open = dbg()['y']; pg.wait_for_timeout(2000); y_later = dbg()['y']
        check('tablet open mid-air: jump paused', abs(y_open - y_later) < 1e-9 and not ev('window.__game.view.debug.grounded'), f'y {y_open:.3f}')
        pg.keyboard.press('Escape'); wait_landed()
        check('after closing the tablet the jump continues and lands', ev('window.__game.view.debug.grounded'))

        # ---------- Slider ----------
        ev('window.__game.view.focus()')
        pg.keyboard.press('t'); wait_vm('up')
        check('prediction starts not set', ev('window.__game.prediction') is None and pg.inner_text('.predict-value') == '—')
        slider = pg.locator('#predict-slider')
        slider.focus(); pg.keyboard.press('End')
        check('slider reaches 10 (End)', ev('window.__game.prediction') == 10 and pg.inner_text('.predict-value') == '10')
        pg.keyboard.press('Home')
        check('slider reaches 1 (Home)', ev('window.__game.prediction') == 1 and pg.inner_text('.predict-value') == '1')
        pg.keyboard.press('ArrowRight')
        check('arrow key changes by 1', ev('window.__game.prediction') == 2, pg.get_attribute('#predict-slider', 'aria-valuetext'))
        box = slider.bounding_box()
        pg.mouse.move(box['x'] + 8, box['y'] + box['height'] / 2); pg.mouse.down()
        pg.mouse.move(box['x'] + box['width'] - 4, box['y'] + box['height'] / 2, steps=8); pg.mouse.up()
        check('mouse drag to the end gives 10', ev('window.__game.prediction') == 10)
        pg.click('.predict-zero')
        check('0 · Empty battery selects 0 and is pressed', ev('window.__game.prediction') == 0 and pg.get_attribute('.predict-zero', 'aria-pressed') == 'true' and pg.inner_text('.predict-value') == '0')
        slider.focus(); pg.keyboard.press('ArrowLeft')
        check('moving the slider turns 0 off (mutually exclusive)', ev('window.__game.prediction') == 9 and pg.get_attribute('.predict-zero', 'aria-pressed') == 'false')
        pg.keyboard.press('Escape'); wait_vm('down'); pg.keyboard.press('t'); wait_vm('up')
        check('prediction kept after closing and reopening the tablet', ev('window.__game.prediction') == 9 and pg.inner_text('.predict-value') == '9')
        pg.screenshot(path=f'{OUT}/slider_tablet_en.png')

        # ---------- Language switch mid-shift ----------
        pg.click('[data-module="crew"]')
        pose_before = ev('({...window.__game.pose})')
        pg.click('.settings-toggle')
        check('Settings open pauses input', ev('window.__game.settingsOpen') and not ev('window.__game.view.inputEnabled'))
        pg.click('label.choice[lang="uk"]')
        pg.wait_for_timeout(500)
        check('lang attribute becomes uk', ev('document.documentElement.lang') == 'uk')
        check('HUD title translated', ev("document.querySelector('.hud-title').textContent") == 'Місяць · Довга тінь')
        text = pg.inner_text('.tablet-content')
        check('tablet translated (plan + slider)', 'Сплануй цю зміну' in text and 'Спрогнозуй заряд' in text and 'Батарея розряджена' in text)
        check('selection, prediction, pose and tablet kept', ev('window.__game.selected') == ['crew'] and ev('window.__game.prediction') == 9
              and ev('({...window.__game.pose})') == pose_before and ev('window.__game.view.viewmodel.isOpen'))
        check('accessible names translated', pg.get_attribute('.settings-toggle', 'aria-label') == 'Налаштування' and 'База від першої особи' in pg.get_attribute('#view canvas', 'aria-label'))
        pg.screenshot(path=f'{OUT}/settings_open_uk.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
        check('Esc closes Settings first, tablet stays up, focus back in the tablet',
              not ev('window.__game.settingsOpen') and ev('window.__game.view.viewmodel.isOpen') and ev("document.querySelector('.tablet-ui').contains(document.activeElement)"))
        pg.click('.tablet-run'); pg.wait_for_timeout(800)
        rep = pg.inner_text('.t-report')
        check('report after Run Shift in Ukrainian with the prediction', 'Твій прогноз: 9 од. енергії' in rep and 'Життєзабезпечення відновило' in rep, rep.replace('\n', ' | ')[:160])
        check('next shift starts with prediction not set', ev('window.__game.prediction') is None)
        pg.click('.predict-zero'); pg.click('[data-module="crew"]'); pg.click('.tablet-run'); pg.wait_for_timeout(800)
        check('prediction 0 reaches the report', 'Твій прогноз: 0 од. енергії' in pg.inner_text('.t-report'))
        pg.screenshot(path=f'{OUT}/tablet_report_uk.png')
        storage = ctx.storage_state()
        check('no page errors', not errors, '; '.join(errors[:3]))
        b.close()

        # ---------- Reload keeps Ukrainian; switch back to English ----------
        b, ctx, pg, errors = new_page(p, storage=storage)
        ev = pg.evaluate
        check('after reload the language is still Ukrainian', ev('document.documentElement.lang') == 'uk' and pg.inner_text('.intro-start') == 'Почати тренування', pg.inner_text('#intro-title'))
        pg.wait_for_timeout(800)
        pg.screenshot(path=f'{OUT}/intro_uk_signs.png')
        pg.click('.settings-toggle'); pg.click('label.choice[lang="en"]'); pg.wait_for_timeout(400)
        check('switch back to English', ev('document.documentElement.lang') == 'en' and pg.inner_text('.intro-start') == 'Start Training')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        check('Esc in the intro returns focus to Start Training', ev("document.activeElement === document.querySelector('.intro-start')"))
        b.close()

        # ---------- Narrow window: gear next to Tablet, HUD title not covered; touch slider ----------
        b, ctx, pg, errors = new_page(p, width=400, height=860, touch=True)
        ev, wait_vm, start_mission, *_ = helpers(pg)
        start_mission()
        r = ev('''(() => { const g = document.querySelector('.settings-toggle').getBoundingClientRect(); const t = document.querySelector('.tablet-toggle').getBoundingClientRect(); const h = document.querySelector('.hud').getBoundingClientRect();
            return { g: [g.left, g.top, g.right, g.bottom], t: [t.left, t.top, t.right, t.bottom], h: [h.left, h.top, h.right, h.bottom] }; })()''')
        overlap = not (r['g'][3] <= r['h'][1] or r['h'][3] <= r['g'][1] or r['g'][2] <= r['h'][0] or r['h'][2] <= r['g'][0])
        check('narrow: gear stays next to Tablet and does not cover the mission title', r['g'][2] <= r['t'][0] and not overlap, json.dumps(r))
        pg.click('.tablet-toggle'); wait_vm('up')
        box = pg.locator('#predict-slider').bounding_box()
        check('narrow: slider touch target ≥ 44 px tall', box['height'] >= 44, f"{box['height']:.0f}px × {box['width']:.0f}px")
        pg.touchscreen.tap(box['x'] + box['width'] * 0.02, box['y'] + box['height'] / 2); pg.wait_for_timeout(300)
        v = ev('window.__game.prediction')
        check('narrow: tapping the slider start picks 1', v == 1, f'value {v}')
        pg.screenshot(path=f'{OUT}/slider_narrow.png')
        b.close()

        failed = [n for n, ok in results if not ok]
        print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')

main()
