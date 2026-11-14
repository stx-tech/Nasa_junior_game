# Headless checks for the Mars map (Chrome + SwiftShader).
#   npm run build && npx vite preview --port 4175 &
#   python3 scripts/check_mars.py http://localhost:4175/ shots
# Plays the Moon on the tablet, then checks Mars: doors reachable, picking every module,
# collisions, the Mars jump, dust per shift, the radiation shift, Ukrainian signs. Saves frames.
import sys, math, json
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4175/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'shots'
CHROME = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
results = []

def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))

# Same numbers as src/scenes/mars/layout.js (outside every collider, in front of each door).
DOORS = {'crew': (-7, 2.6), 'greenhouse': (-1.2, -4.6), 'lab': (7.2, -1.2), 'shelter': (6.3, 5.2), 'solar readout': (9.0, -3.4)}
CENTRES = {'crew': (-7, -3, 1.4), 'greenhouse': (-1.2, -10, 1.0), 'lab': (6, -5, 2.0), 'shelter': (10.8, 5.2, 1.2)}

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=CHROME)
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
        pg.goto(URL)
        pg.wait_for_function('window.__game && window.__game.view'); pg.wait_for_timeout(800)
        ev = pg.evaluate
        def wait_vm(s):
            pg.wait_for_function(f'window.__game.view.viewmodel.state === "{s}"', timeout=30000); pg.wait_for_timeout(400)
        def pose(x, z, bearing, pitch=-0.06, wait=1200):
            ev(f'Object.assign(window.__game.pose, {{x:{x}, z:{z}, yaw:{-math.radians(bearing)}, pitch:{pitch}}})'); pg.wait_for_timeout(wait)
        def shot(name):
            pg.screenshot(path=f'{OUT}/{name}.png')
        def run(mods):
            pg.click('.tablet-toggle'); wait_vm('up')
            for k in mods: pg.click(f'[data-module="{k}"]')
            pg.click('.tablet-run'); pg.wait_for_timeout(250)
            pg.click('.tablet-toggle'); wait_vm('down')

        pg.click('.intro-start'); wait_vm('up')
        pg.click('label.choice:has(input[value="save"])'); pg.click('label.choice:has(input[value="later"])'); pg.click('.t-primary'); wait_vm('down')
        pg.click('.tablet-toggle'); wait_vm('up')
        for mods in (['crew'], ['crew'], ['crew', 'lab'], ['crew', 'lab']):
            for k in mods: pg.click(f'[data-module="{k}"]')
            pg.click('.tablet-run'); pg.wait_for_timeout(200)
        pg.click('.t-actions .t-primary'); pg.wait_for_timeout(1500)
        pg.click('.tablet-toggle'); wait_vm('down')

        check('Mars uses the detailed map (not the placeholder)', ev('window.__game.view.debug.envId') == 'mars')
        sp = ev('({...window.__game.pose})')
        check('spawn is inside the walk area and not blocked', not ev(f'window.__game.view.debug.isBlocked({sp["x"]}, {sp["z"]})'), json.dumps({k: round(v, 2) for k, v in sp.items()}))
        shot('mars_01_spawn')

        # --- Every door is reachable on foot from spawn (grid search over the real colliders) ---
        reach = ev('''(([sx, sz, doors]) => {
            const d = window.__game.view.debug, step = 0.25, seen = new Set(), key = (i, j) => i + ',' + j;
            const q = [[Math.round(sx / step), Math.round(sz / step)]]; seen.add(key(...q[0]));
            while (q.length) { const [i, j] = q.shift();
              for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ni = i + di, nj = j + dj, k = key(ni, nj);
                if (seen.has(k) || d.isBlocked(ni * step, nj * step)) continue; seen.add(k); q.push([ni, nj]); } }
            const out = {}; for (const [name, [x, z]] of Object.entries(doors)) out[name] = !d.isBlocked(x, z) && seen.has(key(Math.round(x / step), Math.round(z / step)));
            return out; })''', [sp['x'], sp['z'], DOORS])
        check('every module door is reachable from spawn', all(reach.values()), json.dumps(reach))

        # --- Picking: aim at each module from its door -> the right key ---
        picked = {}
        for key, (cx, cz, cy) in CENTRES.items():
            dx_, dz_ = DOORS[key]
            bearing = math.degrees(math.atan2(cx - dx_, -(cz - dz_)))
            dist = math.hypot(cx - dx_, cz - dz_)
            ground = ev(f'window.__game.view.debug.groundY') if False else 0
            pose(dx_, dz_, bearing, math.atan2(cy - 1.6, dist), 900)
            picked[key] = ev('window.__game.view.debug.pickAt(0, 0)')
        check('looking at each module picks that module', all(picked[k] == k for k in CENTRES), json.dumps(picked))
        # E selects the module in the centre (same toggle as the tablet)
        dx_, dz_ = DOORS['greenhouse']
        pose(dx_, dz_, 0, -0.05, 900)
        ev('window.__game.view.focus()'); pg.keyboard.press('e'); pg.wait_for_timeout(500)
        check('E selects the greenhouse from its door', 'greenhouse' in ev('window.__game.selected'), json.dumps(ev('window.__game.selected')))
        shot('mars_02_greenhouse_selected')
        pg.keyboard.press('e'); pg.wait_for_timeout(300)

        # --- Collision: walking north into the greenhouse airlock stops at the wall ---
        pose(-1.2, -4.0, 0, 0, 600)
        ev('window.__game.view.focus()')
        pg.keyboard.down('w'); pg.wait_for_timeout(2500); pg.keyboard.up('w'); pg.wait_for_timeout(300)
        z = ev('window.__game.pose.z')
        check('cannot walk through the greenhouse', z > -5.4, f'stopped at z = {z:.2f}')
        pose(4.0, 5.2, 90, 0, 600)
        pg.keyboard.down('w'); pg.wait_for_timeout(3500); pg.keyboard.up('w'); pg.wait_for_timeout(300)
        x = ev('window.__game.pose.x')
        check('cannot walk into the Shelter berm (stops at the door)', 5.0 < x < 7.0, f'stopped at x = {x:.2f}')

        # --- Mars jump: shorter and lower than the Moon (1.3–1.6 s) ---
        pose(0, 9, 0, 0, 600)
        ev('window.__game.view.focus()')
        pg.keyboard.press('Space')
        pg.wait_for_function('!window.__game.view.debug.grounded', timeout=20000)
        t0 = ev('window.__game.view.debug.simTime'); peak = 0
        while not ev('window.__game.view.debug.grounded'):
            d = ev('({y: window.__game.view.debug.feetY, g: window.__game.view.debug.groundY})'); peak = max(peak, d['y'] - d['g']); pg.wait_for_timeout(80)
        air = ev('window.__game.view.debug.simTime') - t0
        check('Mars jump: 0.8–1.1 s in the air, apex below the Moon jump (≈1 m)', 0.8 <= air <= 1.1 and peak < 0.85, f'{air:.2f} s, apex ≈ {peak:.2f} m')

        # --- Dust per shift: clear -> storm -> storm + radiation -> clearing ---
        fog = [ev('window.__game.view.debug.fogDensity')]
        pose(0, 11, 8); shot('mars_03_shift1_clear')
        pose(-1.5, 11.5, 300); shot('mars_04_rover')
        pose(6, 4, 30, -0.02); shot('mars_05_lab_array')
        run(['crew', 'greenhouse', 'lab']); fog.append(ev('window.__game.view.debug.fogDensity'))
        pose(0, 11, 8); shot('mars_06_shift2_storm')
        run(['crew', 'greenhouse']); fog.append(ev('window.__game.view.debug.fogDensity'))
        pose(3, 8.5, 75); shot('mars_07_shift3_radiation_shelter')
        run(['crew', 'shelter']); fog.append(ev('window.__game.view.debug.fogDensity'))
        pose(0, 11, 8); shot('mars_08_shift4_clearing')
        check('dust haze follows the solar output (clear < clearing < storm)', fog[0] < fog[3] < fog[1] <= fog[2], json.dumps([round(f, 4) for f in fog]))

        # --- Ukrainian signs ---
        pg.click('.settings-toggle'); pg.click('label.choice[lang="uk"]'); pg.wait_for_timeout(600); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        pose(0, 11, 8); shot('mars_09_uk_signs')
        pose(3, 8.5, 75); shot('mars_10_uk_shelter')
        check('no page errors', not errors, '; '.join(errors[:3]))
        b.close()

if __name__ == '__main__':
    main()
    failed = [n for n, ok in results if not ok]
    print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')
    sys.exit(1 if failed else 0)
