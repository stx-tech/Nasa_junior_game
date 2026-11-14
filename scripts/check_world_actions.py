# Headless checks for actions in the 3D world (Chrome + SwiftShader).
#   npm run build && npx vite preview --port 4175 &
#   python3 scripts/check_world_actions.py http://localhost:4175/ shots
# The tablet stays DOWN during play: every action happens in the world (E or a short click)
# and the shift runs at the command console. The tablet opens only for results.
# The player is placed next to each object (pose) instead of walking there in real time;
# walking routes are measured separately on the real colliders.
import sys, math, json
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4175/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'shots'
CHROME = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
results = []

def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))

# (stand at) -> (look at, height). Same coordinates as the layouts.
MOON = {'rock1': ((-2.6, 8.9), (-2.6, 7.4, 0.1)), 'rock1far': ((-2.6, 10.6), (-2.6, 7.4, 0.1)), 'rock2': ((-1.6, 2.1), (-1.6, 0.6, 0.1)),
        'lab': ((3.3, 0.6), (3.3, -1.0, 0.95)), 'crew': ((-5.5, 4.4), (-5.5, 0.5, 1.2)), 'console': ((3.4, 9.3), (3.4, 7.6, 0.9))}
MARS = {'rock1': ((-2.6, 2.9), (-2.6, 1.4, 0.1)), 'rock2': ((2.4, 1.9), (2.4, 0.4, 0.1)), 'lab': ((3.9, -0.6), (3.9, -2.2, 0.95)),
        'crew': ((-7, 3.4), (-7, 0.5, 1.2)), 'greenhouse': ((-1.2, -3.9), (-1.2, -6.2, 1.2)), 'shelter': ((6.0, 5.2), (8.3, 5.2, 1.2)),
        'greenhouse_frame': ((0.3, -3.6), (-1.2, -6.6, 1.3)),
        'console': ((-2.8, 11.1), (-2.8, 9.4, 0.9))}
EARTH = {'battery': ((-5.5, 4.2), (-6.4, 2.6, 1.0)), 'pump': ((2.6, -1.9), (2.6, -3.6, 0.6)), 'lab': ((4.4, 3.4), (4.4, 1.6, 1.0)),
         'console': ((1.9, 7.3), (1.9, 5.6, 0.9))}
# Walk routes measured from the console (seconds at walking speed 3.8 m/s)
DOORS = {'moon': {'rock1': (-2.6, 8.9), 'rock2': (-1.6, 2.1), 'lab tray': (3.3, 0.6), 'Life Support': (-5.5, 4.4)},
         'mars': {'rock1': (-2.6, 2.9), 'rock2': (2.4, 1.9), 'lab tray': (3.9, -0.6), 'Life Support': (-7, 3.4), 'Greenhouse': (-1.2, -3.9), 'Shelter': (6.0, 5.2)},
         'earth': {'battery': (-5.5, 4.2), 'pump': (2.6, -1.9), 'soil test': (4.4, 3.4)}}
CONSOLE_STAND = {'moon': (3.4, 9.3), 'mars': (-2.8, 11.1), 'earth': (1.9, 7.3)}

def session(p, lang, width, height, tag):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=CHROME)
    ctx = b.new_context(viewport={'width': width, 'height': height})
    if lang == 'uk':
        ctx.add_init_script("localStorage.setItem('jamt-language', 'uk')")
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    pg.goto(URL)
    pg.wait_for_function('window.__game && window.__game.view'); pg.wait_for_timeout(800)
    ev = pg.evaluate
    def wait_vm(s):
        pg.wait_for_function(f'window.__game.view.viewmodel.state === "{s}"', timeout=30000); pg.wait_for_timeout(400)
    def stand(M, key, wait=650):
        (x, z), (tx, tz, ty) = M[key]
        d = math.hypot(tx - x, tz - z)
        ev(f'Object.assign(window.__game.pose, {{x:{x}, z:{z}, yaw:{math.atan2(-(tx - x), -(tz - z))}, pitch:{math.atan2(ty - 1.6, d)}}})')
        ev('window.__game.view.focus()'); pg.wait_for_timeout(wait)
    def E():
        pg.keyboard.press('e'); pg.wait_for_timeout(350)
    def use(M, key):
        stand(M, key); E()
    def st():
        return ev('window.__game.state')
    def prompt():
        return pg.inner_text('.aim-prompt') if pg.is_visible('.aim-prompt') else ''
    def guide():
        return pg.inner_text('.guide-text')
    def run_at_console(M):
        shift = st()['shift']
        stand(M, 'console'); E()
        if st()['shift'] == shift and st()['status'] == 'active':
            warn = prompt()
            E()  # the first press showed the warning, the second runs
            return warn
        return ''
    def start_training():
        pg.click('.intro-start'); wait_vm('up')
        pg.click('label.choice:has(input[value="save"])'); pg.click('label.choice:has(input[value="later"])')
        pg.click('.t-primary'); wait_vm('down')
    def walk_times(mission):
        sx, sz = CONSOLE_STAND[mission]
        return ev('''(([sx, sz, doors]) => {
            const d = window.__game.view.debug, step = 0.25, key = (i, j) => i + ',' + j;
            const dist = new Map(); const q = [[Math.round(sx / step), Math.round(sz / step)]]; dist.set(key(...q[0]), 0);
            for (let h = 0; h < q.length; h++) { const [i, j] = q[h]; const d0 = dist.get(key(i, j));
              for (const [di, dj, c] of [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]]) {
                const ni = i + di, nj = j + dj, k = key(ni, nj);
                if (dist.has(k) || d.isBlocked(ni * step, nj * step)) continue; dist.set(k, d0 + c); q.push([ni, nj]); } }
            const out = {}; for (const [n, [x, z]] of Object.entries(doors)) { const v = dist.get(key(Math.round(x / step), Math.round(z / step))); out[n] = v === undefined ? null : +(v * step / 3.8).toFixed(1); }
            return out; })''', [sx, sz, DOORS[mission]])
    return b, pg, ev, errors, dict(stand=stand, E=E, use=use, st=st, prompt=prompt, guide=guide, run=run_at_console, start=start_training, wait_vm=wait_vm, walk=walk_times)

def main():
    with sync_playwright() as p:
        # ===================== EN, wide window: Moon (full loop), Mars plan B, Earth without a hint =====================
        b, pg, ev, errors, h = session(p, 'en', 1280, 720, 'en')
        stand, E, use, st, prompt, guide, run = h['stand'], h['E'], h['use'], h['st'], h['prompt'], h['guide'], h['run']
        h['start']()
        check('[en] tablet is down when the mission starts; guide gives one step', not ev('window.__game.view.viewmodel.isOpen') and guide() == 'Walk to the rock with the light marker.', guide())
        check('[en] HUD shows goal and compact budget', 'Goal:' in pg.inner_text('.hud-goals') and pg.inner_text('.hud-budget') == 'You have 8 · Use 0 · Left 8', pg.inner_text('.hud-budget'))
        print('walk (s) moon:', json.dumps(h['walk']('moon')))
        wt = h['walk']('moon')
        check('[en] Moon: every object is a short walk from the console (1–6 s)', all(v is not None and 1 <= v <= 6 for v in wt.values()), json.dumps(wt))

        # Lab cannot study without a sample
        stand(MOON, 'lab')
        p1 = prompt()
        E()
        check('[en] no study without a sample: lab prompt explains, E does nothing', 'Bring a rock to the lab tray first.' in p1 and 'lab' not in ev('window.__game.selected'), p1.replace('\n', ' / '))

        # Far: "Walk closer" for E and for a click (same distance rule)
        stand(MOON, 'rock1far')
        far = prompt()
        E(); pg.mouse.click(640, 360 if True else 0); pg.wait_for_timeout(300)
        check('[en] far from the rock: prompt says Walk closer; E and click do nothing', 'Walk closer' in far and st()['rocks']['rock1'] == 'ground', far.replace('\n', ' / '))
        # Near: drag looks around and does not pick up; a short click picks up
        stand(MOON, 'rock1')
        near = prompt()
        yaw0 = ev('window.__game.pose.yaw')
        pg.mouse.move(640, 400); pg.mouse.down(); pg.mouse.move(700, 400, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
        check('[en] drag = look (yaw changed), no pickup', abs(ev('window.__game.pose.yaw') - yaw0) > 0.05 and st()['rocks']['rock1'] == 'ground')
        stand(MOON, 'rock1')
        pg.mouse.move(640, 400); pg.wait_for_timeout(300)  # mouse aims with the cursor now
        aimed = prompt()
        pg.mouse.click(640, 400); pg.wait_for_timeout(400)
        check('[en] near: prompt names the action; short click picks the rock up', 'Pick up the rock' in near and 'Pick up the rock' in aimed and st()['carrying'] == 'rock1', near.replace('\n', ' / '))
        pg.screenshot(path=f'{OUT}/world_01_pickup_moon.png')
        E(); pg.mouse.click(640, 400); pg.wait_for_timeout(300)
        s = st()
        check('[en] click + E again cannot collect twice', s['rocks'] == {'rock1': 'carried', 'rock2': 'ground'} and s['carrying'] == 'rock1')
        check('[en] carrying: rock in the glove + HUD "Carrying a rock"', ev('window.__game.view.debug.carrying') and 'Carrying a rock' in pg.inner_text('.hud-carry'))
        check('[en] guide reacts: carry to the lab', guide() == 'Carry the rock to the Science Lab.', guide())
        pg.mouse.move(5, 700)  # leave the scene: aim with the reticle again
        ev('window.__game.view.focus()'); pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(100)
        stand(MOON, 'lab')
        check('[en] at the lab: "Put the rock in the tray"', 'Put the rock in the tray' in prompt(), prompt().replace('\n', ' / '))
        E()
        check('[en] delivered: waiting in the lab (free, battery unchanged)', st()['rocks']['rock1'] == 'tray' and st()['battery'] == 1 and '1 waiting in lab' in pg.inner_text('.hud-goals'), pg.inner_text('.hud-goals'))
        pg.screenshot(path=f'{OUT}/world_02_tray_moon.png')
        use(MOON, 'rock2'); use(MOON, 'lab')
        check('[en] second rock collected and delivered (2 in the tray)', st()['rocks'] == {'rock1': 'tray', 'rock2': 'tray'})

        # Shift 1: Life Support at the module, run at the console; the samples wait in the tray
        stand(MOON, 'crew')
        crew_prompt = prompt()
        E()
        check('[en] Life Support at the module: "it gives astronauts air"', 'air' in crew_prompt and 'crew' in ev('window.__game.selected'), crew_prompt.replace('\n', ' / '))
        stand(MOON, 'console')
        cprompt = prompt()
        check('[en] console shows what turns on and what stays in the battery', 'Life Support' in cprompt and 'Left 5' in cprompt, cprompt.replace('\n', ' / '))
        pg.screenshot(path=f'{OUT}/world_03_console_moon.png')
        run(MOON)
        check('[en] shift ran from the console; short result in the HUD', st()['shift'] == 1 and 'Shift 1 done' in pg.inner_text('.hud-toast'), pg.inner_text('.hud-toast'))
        check('[en] samples stay in the tray between shifts', st()['rocks'] == {'rock1': 'tray', 'rock2': 'tray'} and st()['samples'] == 0)
        # Shift 2 (shadow): the console explains where the energy comes from
        use(MOON, 'crew')
        w2 = run(MOON)
        check('[en] shadow shift ran; solar panels in shadow explained', st()['shift'] == 2 and 'shadow' in (st()['cause'] or ''), st()['cause'])
        for plan in (['crew', 'lab'], ['crew', 'lab']):
            for k in plan: use(MOON, k)
            run(MOON)
        s = st()
        check('[en] Moon won; studied only after the shifts with the lab', s['status'] == 'won' and s['rocks'] == {'rock1': 'studied', 'rock2': 'studied'})
        check('[en] the result opens on the tablet', ev('window.__game.view.viewmodel.isOpen'))
        pg.wait_for_timeout(600)
        pg.click('.t-actions .t-primary'); pg.wait_for_timeout(1500)

        # ===================== Mars: plan B (plants early, science later) =====================
        check('[en] Mars starts with the tablet down', ev('window.__game.view.debug.envId') == 'mars' and not ev('window.__game.view.viewmodel.isOpen'))
        print('walk (s) mars:', json.dumps(h['walk']('mars')))
        wt = h['walk']('mars')
        check('[en] Mars: every object is a short walk from the console (1–7 s)', all(v is not None and 1 <= v <= 7 for v in wt.values()), json.dumps(wt))
        stand(MARS, 'shelter')
        sp = prompt()
        check('[en] Shelter outside the warning: "needed only during a radiation warning"', 'radiation warning' in sp, sp.replace('\n', ' / '))
        use(MARS, 'rock1'); use(MARS, 'lab'); use(MARS, 'rock2'); use(MARS, 'lab')
        for i, plan in enumerate((['crew', 'greenhouse', 'lab'], ['crew', 'greenhouse'], ['crew', 'shelter'], ['crew', 'lab'])):
            if i == 2:
                check('[en] radiation shift: guide sends the child to the Shelter', 'Shelter' in guide(), guide())
            for k in plan:
                if i == 0 and k == 'greenhouse':
                    stand(MARS, 'greenhouse_frame', 900)
                    check('[en] greenhouse prompt: water the plants (2)', 'Water the plants' in prompt(), prompt().replace('\n', ' / '))
                    pg.screenshot(path=f'{OUT}/world_04_greenhouse_mars.png')
                    E()
                else:
                    use(MARS, k)
            if i == 2:
                stand(MARS, 'shelter'); pg.wait_for_timeout(300)
            run(MARS)
        s = st()
        check('[en] Mars plan B won through the world', s['status'] == 'won', s['failReason'])
        pg.click('.t-actions .t-primary'); pg.wait_for_timeout(1500)

        # ===================== Earth without a hint =====================
        check('[en] Earth field station is a 3D map', ev('window.__game.view.debug.envId') == 'earth')
        print('walk (s) earth:', json.dumps(h['walk']('earth')))
        stand(EARTH, 'battery')
        bp = prompt()
        check('[en] Earth: battery rules read on the spot (7, pump 5, test 3)', '7 energy now' in bp and 'pump needs 5' in bp and '3' in bp, bp.replace('\n', ' / '))
        check('[en] Earth guide does not give the answer', 'You decide' in guide() or 'Decide' in guide(), guide())
        run(EARTH)
        stand(EARTH, 'pump')
        pp = prompt()
        pg.screenshot(path=f'{OUT}/world_05_pump_earth.png')
        E()
        check('[en] after sunset: turn on the pump at the pump', 'Turn on the pump' in pp and 'pump' in ev('window.__game.selected'), pp.replace('\n', ' / '))
        run(EARTH)
        check('[en] Earth won without a hint', st()['status'] == 'won' and st()['watered'] and 'Hint' not in ''.join([]))
        # visible result: water in the pipe, green plants
        ev('window.__game.view.viewmodel.isOpen') and ev('window.__game.tablet.close()')
        pg.wait_for_timeout(900)
        ev("Object.assign(window.__game.pose, {x: 0.6, z: -0.6, yaw: 0.9, pitch: -0.3})"); pg.wait_for_timeout(1200)
        pg.screenshot(path=f'{OUT}/world_06_water_earth.png')
        pg.click('.tablet-toggle'); h['wait_vm']('up')
        pg.locator('.t-actions button').first.click(); pg.wait_for_timeout(500)
        txt = pg.inner_text('.tablet-content')
        check('[en] complete page: comparison + home exercise without equipment', 'Before training' in txt and 'Draw 10 boxes' in txt and 'grown-up' in txt, txt[:160].replace('\n', ' / '))
        check('[en] no page errors', not errors, '; '.join(errors[:3]))
        b.close()

        # ===================== UK, narrow window: retry resets rocks, Mars plan A, Earth fail + retry =====================
        b, pg, ev, errors, h = session(p, 'uk', 700, 860, 'uk')
        stand, E, use, st, prompt, guide, run = h['stand'], h['E'], h['use'], h['st'], h['prompt'], h['guide'], h['run']
        h['start']()
        check('[uk] guide in Ukrainian', guide() == 'Підійди до камінця зі світловою міткою.', guide())
        use(MOON, 'rock1')
        check('[uk] carrying chip in Ukrainian', 'Несеш камінець' in pg.inner_text('.hud-carry'))
        use(MOON, 'lab')
        fits = ev('''(() => { const g = document.querySelector('.guide-bar').getBoundingClientRect(); return g.left >= 0 && g.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth; })()''')
        stand(MOON, 'lab')
        pr = prompt()
        check('[uk] narrow window: prompt + guide fit, Ukrainian prompt', fits and 'Дослідити камінець' in pr, pr.replace('\n', ' / '))
        pg.screenshot(path=f'{OUT}/world_07_uk_narrow.png')
        # Lose on purpose: Life Support off twice -> warning before, reason after, Retry resets
        warn1 = run(MOON)
        check('[uk] console explains the risk before the shift (second press runs)', 'запасний балон' in warn1 or 'повітря' in warn1, warn1.replace('\n', ' / ')[:160])
        run(MOON)
        s = st()
        check('[uk] lost with a specific reason; tablet opens with one Retry', s['status'] == 'failed' and 'air ran out' in s['failReason'] and ev('window.__game.view.viewmodel.isOpen'), s['failReason'])
        pg.wait_for_timeout(500)
        pg.click('.t-actions .t-primary'); pg.wait_for_timeout(1200)
        s = st()
        check('[uk] Retry puts the rocks back and empties the hands', s['rocks'] == {'rock1': 'ground', 'rock2': 'ground'} and s['carrying'] is None and s['shift'] == 0 and not ev('window.__game.view.debug.carrying'))
        # finish the Moon quickly (safe plan) to reach Mars
        use(MOON, 'rock1'); use(MOON, 'lab'); use(MOON, 'rock2'); use(MOON, 'lab')
        for plan in (['crew'], ['crew'], ['crew', 'lab'], ['crew', 'lab']):
            for k in plan: use(MOON, k)
            run(MOON)
        check('[uk] Moon won after a retry', st()['status'] == 'won')
        pg.click('.t-actions .t-primary'); pg.wait_for_timeout(1500)
        # Mars plan A: science first, harvest last
        use(MARS, 'rock1'); use(MARS, 'lab'); use(MARS, 'rock2'); use(MARS, 'lab')
        for plan in (['crew', 'lab'], ['crew', 'greenhouse', 'lab'], ['crew', 'shelter'], ['crew', 'greenhouse']):
            for k in plan: use(MARS, k)
            run(MARS)
        check('[uk] Mars plan A won through the world', st()['status'] == 'won', st()['failReason'])
        pg.click('.t-actions .t-primary'); pg.wait_for_timeout(1500)
        # Earth: soil test first -> stop with numbers -> Retry -> pass
        use(EARTH, 'lab')
        run(EARTH)
        s = st()
        check('[uk] Earth: battery too low -> explained with numbers', s['status'] == 'failed' and '5' in s['failReason'] and '4' in s['failReason'], s['failReason'])
        txt = pg.inner_text('.tablet-content')
        check('[uk] failure text in Ukrainian on the tablet', 'насосу' in txt, txt[:120].replace('\n', ' / '))
        pg.locator('.t-actions button').first.click(); pg.wait_for_timeout(400)  # answer the question
        pg.locator('.t-actions .t-primary').click(); pg.wait_for_timeout(1500)  # Retry
        use(EARTH, 'battery')
        run(EARTH); use(EARTH, 'pump'); run(EARTH)
        check('[uk] Earth passed on the retry', st()['status'] == 'won')
        check('[uk] no page errors', not errors, '; '.join(errors[:3]))
        b.close()

if __name__ == '__main__':
    main()
    failed = [n for n, ok in results if not ok]
    print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')
    sys.exit(1 if failed else 0)
