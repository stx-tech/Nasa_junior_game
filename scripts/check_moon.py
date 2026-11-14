# Headless playthrough + screenshots of the Moon map (Chrome + SwiftShader WebGL).
# Usage: npm run build && npx vite preview --port 4173 &  then
#        python3 scripts/check_moon.py [url] [outdir]
import sys, json, time, math
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'shots'
results = []

def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
            args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': 1280, 'height': 900})
        errors = []
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text and '404' not in m.text else None)
        pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
        t0 = time.time()
        pg.goto(URL)
        pg.wait_for_function('window.__game && window.__game.stage()')
        pg.wait_for_timeout(2000)
        print('loaded in', round(time.time() - t0, 1), 's (software WebGL)')
        view = pg.locator('#view')

        def shot(name):
            pg.wait_for_timeout(600)
            view.screenshot(path=f'{OUT}/{name}.png')

        def set_pose(x, z, bearing, pitch=-0.06):
            pg.evaluate(f'window.__game.setPose({{x:{x}, z:{z}, yaw:{-math.radians(bearing)}, pitch:{pitch}}})')
            pg.wait_for_timeout(1500)  # software WebGL renders ~2 fps; let the camera catch up

        def pose():
            return pg.evaluate('({...window.__game.pose})')

        def screen_of(x, y, z):
            # project a world point to page coordinates using the stage camera
            return pg.evaluate('''([x,y,z]) => {
                const st = window.__game.stage(); const cam = st.camera; const r = st.canvas.getBoundingClientRect();
                const v = cam.position.clone(); v.set(x,y,z); v.project(cam);
                return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, z: v.z };
            }''', [x, y, z])

        def fps(seconds=2.0):
            return pg.evaluate(f'''() => new Promise(res => {{ let n = 0; const t0 = performance.now();
                function f() {{ n++; if (performance.now() - t0 < {seconds * 1000}) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }}
                requestAnimationFrame(f); }})''')

        # --- 1. Spawn view with Earth (shift 1)
        shot('01_spawn_earth_shift1')
        p0 = pose()
        check('spawn pose', abs(p0['x']) < 0.01 and abs(p0['z'] - 11) < 0.01, json.dumps(p0))
        print('fps (software renderer, indicative only):', round(fps(), 1))
        info = pg.evaluate('''() => { const r = window.__game.stage().renderer; return { calls: r.info.render.calls, triangles: r.info.render.triangles, geometries: r.info.memory.geometries, textures: r.info.memory.textures }; }''')
        print('renderer.info (main pass, last frame):', json.dumps(info))
        top = pg.evaluate('''() => { const out = []; window.__game.stage().env.root.traverse(o => {
            if (!o.isMesh || !o.geometry) return; const g = o.geometry; const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
            const n = o.isInstancedMesh ? o.count : 1; out.push([o.name || o.parent?.name || o.type, Math.round(tris * n), o.castShadow]); });
            out.sort((a, b) => b[1] - a[1]); return out.slice(0, 8); }''')
        print('largest meshes [name, triangles, castShadow]:', json.dumps(top))

        # --- 2. Walk forward with W for 2 s: moves north, camera above ground
        pg.locator('#view canvas').click(position={'x': 640, 'y': 600})  # focus (ground click, no module)
        pg.keyboard.down('w'); pg.wait_for_timeout(2000); pg.keyboard.up('w'); pg.wait_for_timeout(600)
        p1 = pose()
        check('W walks forward', p1['z'] < p0['z'] - 2, json.dumps(p1))
        cam_ok = pg.evaluate('''() => { const st = window.__game.stage(); const c = st.camera.position;
            return c.y - st.env.heightAt(c.x, c.z); }''')
        check('eye height above terrain', 1.3 < cam_ok < 1.9, f'{cam_ok:.2f} m')

        # --- 3. Collision: walk straight into Life Support from the south
        set_pose(-5.5, 6, 0)
        pg.keyboard.down('w'); pg.wait_for_timeout(4500); pg.keyboard.up('w')
        p2 = pose()
        check('cannot walk through Life Support airlock', p2['z'] > 2.4, json.dumps(p2))
        set_pose(5, 3, 0)
        pg.keyboard.down('w'); pg.wait_for_timeout(4500); pg.keyboard.up('w')
        p3 = pose()
        check('cannot walk through Science Lab', p3['z'] > -2.6 + 0.3, json.dumps(p3))
        # Edge: walk east into the ridge
        set_pose(12, -12.5, 60)
        pg.keyboard.down('w'); pg.wait_for_timeout(5000); pg.keyboard.up('w')
        p4 = pose()
        check('ridge / play-area edge stops the player', p4['x'] < 17, json.dumps(p4))

        # --- 4. Near-modules views
        set_pose(3.2, 3.6, 10, -0.04)
        shot('02b_near_science_lab')
        set_pose(-3.4, 7.2, 348, -0.02)
        shot('02a_near_life_support')

        # --- 5. Click Life Support in 3D (projected sign position) -> selected; pose unchanged
        before = pose()
        sp = screen_of(-5.5, 2.55, 3.0 + 1.6 - 0.35 - 2.5)  # LS sign (world)
        pg.mouse.move(sp['x'], sp['y']); pg.wait_for_timeout(200)
        pg.mouse.down(); pg.wait_for_timeout(50); pg.mouse.up()
        pg.wait_for_timeout(600)
        pressed = pg.get_attribute('#btn-crew', 'aria-pressed')
        check('click on Life Support in 3D selects crew', pressed == 'true', f'screen {sp}')
        after = pose()
        check('pose kept after click', abs(after['x'] - before['x']) < 1e-6 and abs(after['yaw'] - before['yaw']) < 1e-6)
        shot('03_selected_life_support')

        # --- 6. Shift 1 -> Run
        pg.click('#run'); pg.wait_for_timeout(500)
        st = pg.evaluate('window.__game.state')
        check('shift 1 ran', st['shift'] == 1, f"battery {st['battery']}")
        after2 = pose()
        check('pose kept after Run Shift', abs(after2['x'] - after['x']) < 1e-6 and abs(after2['z'] - after['z']) < 1e-6)

        # --- 7. Shift 2: panels in shadow. Same viewpoint as shift-1 comparison shot.
        solar_text = pg.inner_text('#solar')
        check('UI shows Solar output: 0 on shift 2', 'Solar output: 0' in solar_text, solar_text)
        set_pose(7.2, 0.6, 52, -0.08)
        shot('04_panels_shift2_shadow')
        # use the button (keyboard path) for Life Support
        pg.click('#btn-crew'); pg.click('#run'); pg.wait_for_timeout(400)
        # --- 8. Shift 3: lit again, same viewpoint
        shot('05_panels_shift3_lit')
        pg.click('#btn-crew'); pg.click('#btn-lab'); pg.click('#run'); pg.wait_for_timeout(300)
        pg.click('#btn-crew'); pg.click('#btn-lab'); pg.click('#run'); pg.wait_for_timeout(300)
        st = pg.evaluate('window.__game.state')
        check('Moon mission complete with LS, LS, LS+Lab, LS+Lab', st['done'] and not st['failed'], json.dumps({k: st[k] for k in ('battery', 'science', 'failed')}))
        # shift-1 comparison from the same viewpoint: restart later; take spawn shot of shift 4 lighting too
        set_pose(0, 11, 12)
        shot('06_spawn_shift4')

        # --- 9. Transition to Mars
        label = pg.inner_text('#run')
        pg.click('#run'); pg.wait_for_timeout(1500)
        check('Next mission goes to Mars', pg.evaluate('window.__game.missionId') == 'mars', label)
        shot('07_mars_placeholder')

        # --- 10. Back to Moon (wraps after Mars) to grab the shift-1 comparison shot
        pg.evaluate('''() => { const s = window.__game.state; }''')
        b.close()

        # --- 11. Fresh page: shift 1 from the panel viewpoint (pair with 04) + narrow window
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
            args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': 1280, 'height': 900})
        pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
        pg.goto(URL); pg.wait_for_function('window.__game && window.__game.stage()'); pg.wait_for_timeout(1500)
        view = pg.locator('#view')
        pg.evaluate(f'window.__game.setPose({{x:7.2, z:0.6, yaw:{-math.radians(52)}, pitch:-0.08}})')
        pg.wait_for_timeout(800)
        view.screenshot(path=f'{OUT}/08_panels_shift1_lit.png')
        pg.set_viewport_size({'width': 480, 'height': 900})
        pg.evaluate('window.__game.setPose({x:0, z:11, yaw:-0.21, pitch:-0.06})')
        pg.wait_for_timeout(1200)
        pg.screenshot(path=f'{OUT}/09_narrow_480.png', full_page=True)
        b.close()

        check('no page errors', not errors, '; '.join(errors[:5]))
        failed = [r for r in results if not r[1]]
        print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')

main()
