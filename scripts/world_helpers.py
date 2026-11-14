# Shared helpers for the browser checks: actions in the 3D world.
# The player is placed next to an object and presses E (same rules as a real walk).
import math, json

SPOTS = {
    'moon': {'rock1': ((-2.6, 8.9), (-2.6, 7.4, 0.1)), 'rock2': ((-1.6, 2.1), (-1.6, 0.6, 0.1)), 'lab': ((3.3, 0.6), (3.3, -1.0, 0.95)),
             'crew': ((-5.5, 4.4), (-5.5, 0.5, 1.2)), 'console': ((3.4, 9.3), (3.4, 7.6, 0.9))},
    'mars': {'rock1': ((-2.6, 2.9), (-2.6, 1.4, 0.1)), 'rock2': ((2.4, 1.9), (2.4, 0.4, 0.1)), 'lab': ((3.9, -0.6), (3.9, -2.2, 0.95)),
             'crew': ((-7, 3.4), (-7, 0.5, 1.2)), 'greenhouse': ((-1.2, -3.9), (-1.2, -6.2, 1.2)), 'shelter': ((6.0, 5.2), (8.3, 5.2, 1.2)),
             'console': ((-2.8, 11.1), (-2.8, 9.4, 0.9))},
}

def stand(pg, mission, key, wait=650):
    (x, z), (tx, tz, ty) = SPOTS[mission][key]
    d = math.hypot(tx - x, tz - z)
    pg.evaluate(f'Object.assign(window.__game.pose, {{x:{x}, z:{z}, yaw:{math.atan2(-(tx - x), -(tz - z))}, pitch:{math.atan2(ty - 1.6, d)}}})')
    pg.evaluate('window.__game.view.focus()')
    pg.wait_for_timeout(wait)

def deliver_rocks(pg):
    """Carry both sample rocks to the lab tray (tablet down), then put the camera back."""
    mission = pg.evaluate('window.__game.view.debug.envId')
    if pg.evaluate('window.__game.view.viewmodel.isOpen'):
        pg.keyboard.press('Escape')
        pg.wait_for_function('window.__game.view.viewmodel.state === "down"', timeout=30000)
        pg.wait_for_timeout(300)
    saved = pg.evaluate('({...window.__game.pose})')
    for rock in ('rock1', 'rock2'):
        if pg.evaluate(f'window.__game.state.rocks.{rock}') != 'ground':
            continue
        stand(pg, mission, rock); pg.keyboard.press('e'); pg.wait_for_timeout(350)
        stand(pg, mission, 'lab'); pg.keyboard.press('e'); pg.wait_for_timeout(350)
    pg.evaluate(f'Object.assign(window.__game.pose, {json.dumps(saved)})')
    pg.wait_for_timeout(300)
    return pg.evaluate('window.__game.state.rocks')
