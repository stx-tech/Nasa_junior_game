# Headless browser checks for the gameplay logic on the tablet (Chrome + SwiftShader).
#   npm run build && npx vite preview --port 4175 &
#   python3 scripts/check_gameplay.py http://localhost:4175/ shots
# Plays Moon (with one recoverable mistake) -> Mars (one loss + Retry, then plan B) -> Earth (no hint), in a narrow window.
import sys, json
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4175/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'shots'
CHROME = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
results = []

def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))

def run(lang, width, height, shots_prefix):
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=CHROME)
        ctx = b.new_context(viewport={'width': width, 'height': height})
        if lang == 'uk':
            ctx.add_init_script("localStorage.setItem('jamt-language', 'uk')")
        pg = ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
        pg.goto(URL)
        pg.wait_for_function('window.__game && window.__game.view && window.__game.view.canvas')
        pg.wait_for_timeout(1000)
        ev = pg.evaluate
        tag = f'[{lang} {width}px]'
        def wait_vm(s):
            pg.wait_for_function(f'window.__game.view.viewmodel.state === "{s}"', timeout=30000); pg.wait_for_timeout(350)
        def text(sel):
            return pg.inner_text(sel) if pg.query_selector(sel) else ''
        def plan(mods):
            for k in mods: pg.click(f'[data-module="{k}"]')
        def shown_left():
            import re
            return int(re.findall(r'(\d+)', text('.plan-energy'))[-1])
        def run_shift(mods, check_budget=True):
            plan(mods)
            left = shown_left()
            pg.click('.tablet-run'); pg.wait_for_timeout(250)
            if check_budget:
                real = ev('window.__game.state.battery')
                check(f'{tag} shown "charge left" = real battery after shift {ev("window.__game.state.shift")}', left == real, f'{left} vs {real}')
        def fits():
            return ev('''(() => { const r = document.querySelector('.tablet-run').getBoundingClientRect();
                const c = document.querySelector('.t-plan-footer') || document.body;
                return r.bottom <= innerHeight && r.right <= innerWidth && r.left >= 0 && document.documentElement.scrollWidth <= innerWidth; })()''')

        pg.click('.intro-start'); wait_vm('up')
        pg.click('label.choice:has(input[value="save"])'); pg.click('label.choice:has(input[value="later"])')
        pg.click('.t-primary'); wait_vm('down')
        pg.click('.tablet-toggle'); wait_vm('up')

        # ---- Moon shift 1: guide question, goals, footer risk
        q = text('.guide-question')
        check(f'{tag} Moon shift 1 asks the shadow question', ('shadow' in q) if lang == 'en' else ('тіні' in q), q)
        goals = text('.t-goals')
        check(f'{tag} goal chips show rocks and backup air', ('Rocks studied: 0 of 2' in goals and 'Backup air tanks: 1 of 1' in goals) if lang == 'en'
              else ('Досліджено камінців: 0 з 2' in goals and 'Запасні балони повітря: 1 з 1' in goals), goals.replace('\n', ' | '))
        check(f'{tag} Run Shift is visible without scrolling in the narrow window', fits())
        plan(['crew', 'lab'])
        risk = text('.t-risks')
        check(f'{tag} warning before the shift explains the shadow risk', ('only 2 energy' in risk) if lang == 'en' else ('лише 2' in risk), risk)
        pg.screenshot(path=f'{OUT}/{shots_prefix}_1_moon_plan.png')
        pg.click('.tablet-run'); pg.wait_for_timeout(250)
        check(f'{tag} shown "charge left" = real battery after shift 1', ev('window.__game.state.battery') == 2)

        # ---- Result card: did -> changed -> why
        card = text('.t-result')
        check(f'{tag} result card has did / changed / why', all(s in card for s in (['You turned on', 'What changed', 'Why'] if lang == 'en' else ['Увімкнено', 'Що змінилося', 'Чому'])), card.replace('\n', ' | ')[:200])
        check(f'{tag} goal chip updated: rocks 1 of 2', ('Rocks studied: 1 of 2' if lang == 'en' else 'Досліджено камінців: 1 з 2') in text('.t-goals'))

        # ---- Shift 2 (shadow): cannot afford Life Support -> backup air (recoverable mistake)
        pg.click('[data-module="crew"]')
        short = ev("({ warn: !document.querySelector('.t-warning').hidden, text: document.querySelector('.t-warning').textContent, run: document.querySelector('.tablet-run').disabled })")
        check(f'{tag} in the shadow Life Support does not fit (2 < 3): short-by shown, Run disabled', short['warn'] and short['run'], short['text'])
        pg.click('[data-module="crew"]')
        risk = text('.t-risks')
        check(f'{tag} skipping Life Support is announced as using the backup tank', ('backup air tank (0 left)' in risk) if lang == 'en' else ('запасний балон' in risk), risk)
        pg.click('.tablet-run'); pg.wait_for_timeout(250)
        why = text('.r-why')
        check(f'{tag} "why" names the shadow', ('shadow' in why) if lang == 'en' else ('тіні' in why), why)
        goals = text('.t-goals')
        check(f'{tag} backup air shown as used (0 of 1, warning)', ('Backup air tanks: 0 of 1' if lang == 'en' else 'Запасні балони повітря: 0 з 1') in goals and ev("!!document.querySelector('.t-goals li.warn')"))
        pg.screenshot(path=f'{OUT}/{shots_prefix}_2_moon_recover.png')

        # 3D status plates over the modules (tablet closed, looking at the base)
        pg.click('.tablet-toggle'); wait_vm('down')
        ev('Object.assign(window.__game.pose, {x: 0, z: 9, yaw: 0, pitch: -0.08})'); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{OUT}/{shots_prefix}_2b_world_status.png')
        pg.click('.tablet-toggle'); wait_vm('up')
        run_shift(['crew', 'lab'])
        run_shift(['crew'])
        check(f'{tag} Moon won after a recoverable mistake', ev('window.__game.state.status') == 'won', ev('window.__game.state.failReason') or '')
        pg.screenshot(path=f'{OUT}/{shots_prefix}_3_moon_won.png')
        pg.click('.t-actions .t-primary'); pg.wait_for_timeout(300)

        # ---- Mars: loss (crew outside in radiation) + Retry
        check(f'{tag} Mars starts', ev('window.__game.state.shift') == 0 and 'Mars' in text('.tablet-content h2') or 'Марс' in text('.tablet-content h2'))
        run_shift(['crew', 'lab'])
        run_shift(['crew', 'greenhouse', 'lab'])
        plan(['crew'])
        risk = text('.t-risks')
        check(f'{tag} radiation risk is explained before the shift', ('Radiation' in risk) if lang == 'en' else ('Радіац' in risk or 'радіац' in risk), risk)
        pg.click('.tablet-run'); pg.wait_for_timeout(250)
        reason = text('.fail-reason')
        check(f'{tag} failure names the specific reason', ('Shelter' in reason) if lang == 'en' else ('Укритт' in reason or 'укритт' in reason), reason)
        prim = ev("[...document.querySelectorAll('.t-actions button')].map(b => [b.textContent, b.classList.contains('t-primary')])")
        check(f'{tag} one obvious Retry (single primary button)', len([x for x in prim if x[1]]) == 1 and len(prim) == 1, json.dumps(prim, ensure_ascii=False))
        pg.screenshot(path=f'{OUT}/{shots_prefix}_4_mars_fail.png')
        pg.click('.t-actions .t-primary'); pg.wait_for_timeout(300)
        s = ev('window.__game.state')
        check(f'{tag} Retry resets Mars (shift 0, 6 battery, 3 food, 0 rocks)', s['shift'] == 0 and s['battery'] == 6 and s['food'] == 3 and s['samples'] == 0 and s['status'] == 'active')

        # ---- Mars plan B
        for mods in (['crew', 'greenhouse', 'lab'], ['crew', 'greenhouse'], ['crew', 'shelter'], ['crew', 'lab']):
            run_shift(mods)
        check(f'{tag} Mars won with plan B (plants early, science later)', ev('window.__game.state.status') == 'won')
        pg.screenshot(path=f'{OUT}/{shots_prefix}_5_mars_won.png')
        pg.click('.t-actions .t-primary'); pg.wait_for_timeout(300)

        # ---- Earth without a hint
        check(f'{tag} Earth plan does not show the answer (hint is a button)', ev("!document.querySelector('.t-hint') && !!document.querySelector('.t-plan button:not([data-module])')"))
        run_shift([])
        run_shift(['pump'])
        check(f'{tag} Earth passed without a hint', ev('window.__game.state.status') == 'won' and ev('window.__game.state.watered'))
        pg.click('.t-actions button'); pg.wait_for_timeout(300)
        check(f'{tag} reached the comparison page', ev('window.__game.stage') == 'complete')
        pg.screenshot(path=f'{OUT}/{shots_prefix}_6_complete.png')
        check(f'{tag} no page errors', not errors, '; '.join(errors[:3]))
        b.close()

if __name__ == '__main__':
    run('en', 720, 860, 'gl_en')
    run('uk', 720, 860, 'gl_uk')
    failed = [n for n, ok in results if not ok]
    print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')
    sys.exit(1 if failed else 0)
