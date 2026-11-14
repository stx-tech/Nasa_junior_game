// World interaction layer shared by every map.
// Adds the command console, sample rocks + lab tray and the guide marker to an
// environment, and answers "what is this object and how far is it?".
//
//   const layer = createWorldLayer({ heightAt, consoleAt, rocks, tray, rockColor, shapes });
//   root.add(layer.root); colliders.push(...layer.colliders);
//   layer.distance(id, x, z)  -> metres from the player to the object (same for click and E)
//   layer.markerPos(id)       -> [x, y, z, arrowHeight] for the guide marker
import * as THREE from 'three';
import { buildConsole, buildSamples, buildGuideMarker, shapeDistance } from './objects.js';

export const REACH = 2.2;

// First raycast hit whose object (and every parent) is visible: hidden items such as a
// rock that is already in the player's hands never block or answer a click.
export function firstVisibleHit(hits) {
  for (const h of hits) {
    let o = h.object, ok = true;
    while (o) { if (!o.visible) { ok = false; break; } o = o.parent; }
    if (ok) return h;
  }
  return null;
} // metres: close enough to use an object (mouse and keyboard alike)

export function createWorldLayer({ heightAt, consoleAt, rocks = [], tray = null, rockColor, shapes = {}, markerHeights = {} }) {
  const root = new THREE.Group();
  root.name = 'world-layer';
  const colliders = [];
  const pickables = [];

  const consoleObj = buildConsole(heightAt, consoleAt);
  root.add(consoleObj.group);
  pickables.push(...consoleObj.pickables);
  colliders.push(consoleObj.collider);

  let samples = null;
  if (rocks.length && tray) {
    samples = buildSamples(heightAt, rocks, tray, { color: rockColor });
    root.add(samples.root);
    pickables.push(...samples.pickables);
    colliders.push(samples.trayCollider);
  }

  const marker = buildGuideMarker();
  root.add(marker.group);

  // id -> list of shapes (the lab also counts its tray)
  const shapeList = { console: [consoleObj.shape] };
  for (const [id, s] of Object.entries(shapes)) shapeList[id] = Array.isArray(s) ? s : [s];
  if (samples) {
    shapeList.lab = [...(shapeList.lab ?? []), samples.trayShape];
    for (const it of samples.items) shapeList[`rock:${it.id}`] = [it.shape];
  }
  const heights = { console: consoleObj.markerY, ...markerHeights };

  function distance(id, x, z) {
    const list = shapeList[id];
    if (!list) return Infinity;
    return Math.min(...list.map((s) => shapeDistance(s, x, z)));
  }
  function centre(id) {
    const s = shapeList[id]?.[0];
    if (!s) return null;
    if (s.circle) return [s.circle[0], s.circle[1]];
    return [(s.box[0] + s.box[1]) / 2, (s.box[2] + s.box[3]) / 2];
  }
  function markerPos(id) {
    const c = centre(id);
    if (!c) return null;
    const h = id.startsWith('rock:') ? 1.3 : (heights[id] ?? 3.2);
    return [c[0], heightAt(c[0], c[1]), c[1], h];
  }
  function setMarker(id) {
    const p = id ? markerPos(id) : null;
    if (p) marker.show(p[0], p[1], p[2], p[3]); else marker.hide();
  }

  return {
    root,
    colliders,
    pickables,
    distance,
    markerPos,
    setMarker,
    setRocks: (states) => samples?.setStates(states),
    setConsole: consoleObj.setScreen,
    setTexts(t) {
      consoleObj.setLabel(t('world.consoleName'));
      samples?.setLabels(t('world.trayWaiting'), t('world.trayStudied'));
    },
    ids: () => Object.keys(shapeList),
    update(dt) { consoleObj.update(dt); samples?.update(dt); marker.update(dt); },
  };
}
