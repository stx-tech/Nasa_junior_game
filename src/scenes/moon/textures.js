import * as THREE from 'three';
import { createSimplex2D, fbm, mulberry32 } from './noise.js';

function canvasTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Simple pictograms drawn with canvas paths (no external assets).
function drawIcon(ctx, kind, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.09;
  ctx.lineCap = 'round';
  if (kind === 'air') {
    // Three wind lines with curls = "air".
    for (let i = 0; i < 3; i++) {
      const y = cy - s * 0.28 + i * s * 0.28;
      const w = s * (0.8 - i * 0.15);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.45, y);
      ctx.lineTo(cx - s * 0.45 + w * 0.75, y);
      ctx.arc(cx - s * 0.45 + w * 0.75, y - s * 0.1, s * 0.1, Math.PI / 2, -Math.PI * 0.9, true);
      ctx.stroke();
    }
  } else if (kind === 'sample') {
    // Rock under a magnifier.
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.42, cy + s * 0.3);
    ctx.lineTo(cx - s * 0.3, cy + s * 0.02);
    ctx.lineTo(cx - s * 0.05, cy - s * 0.08);
    ctx.lineTo(cx + s * 0.12, cy + s * 0.1);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.18, cy - s * 0.2, s * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.33, cy - s * 0.05);
    ctx.lineTo(cx + s * 0.48, cy + s * 0.12);
    ctx.stroke();
  } else if (kind === 'sun') {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * s * 0.3, cy + Math.sin(a) * s * 0.3);
      ctx.lineTo(cx + Math.cos(a) * s * 0.45, cy + Math.sin(a) * s * 0.45);
      ctx.stroke();
    }
  } else if (kind === 'arrowL' || kind === 'arrowR' || kind === 'arrowUR' || kind === 'arrowUp') {
    const ang = { arrowL: Math.PI, arrowR: 0, arrowUR: -Math.PI / 4, arrowUp: -Math.PI / 2 }[kind];
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, 0);
    ctx.lineTo(s * 0.3, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.45, 0);
    ctx.lineTo(s * 0.15, -s * 0.22);
    ctx.lineTo(s * 0.15, s * 0.22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Module name sign: dark plate, bright text, icon on the left.
// Returned textures can be redrawn: tex.userData.setText('NEW TEXT') (language switch).
export function makeSignTexture({ text, icon, bg = '#1d2430', fg = '#f4f1e8', accent = '#f2a23a', w = 1024, h = 256 }) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const tex = canvasTexture(c);
  tex.userData.setText = (s) => { draw(s); tex.needsUpdate = true; };
  draw(text);
  return tex;
  function draw(text) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = accent;
  ctx.fillRect(0, h - 18, w, 18);
  let x = 40;
  if (icon) {
    drawIcon(ctx, icon, h * 0.5, h * 0.46, h * 0.62, accent);
    x = h * 0.95;
  }
  ctx.fillStyle = fg;
  let size = Math.floor(h * 0.42);
  ctx.font = `700 ${size}px "Segoe UI", Arial, sans-serif`;
  while (ctx.measureText(text).width > w - x - 30 && size > 20) {
    size -= 4;
    ctx.font = `700 ${size}px "Segoe UI", Arial, sans-serif`;
  }
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, h * 0.46);
  }
}

// Readout panel for the solar array ("Solar output: 7"). Redrawn per shift.
export function createReadout() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  const tex = canvasTexture(c);
  const fit = (text, weight, size, maxW) => {
    ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
    while (ctx.measureText(text).width > maxW && size > 18) {
      size -= 2;
      ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
    }
  };
  let labels = { output: 'Solar output', sunlight: 'In sunlight', shadow: 'In shadow' };
  let last = [0, false];
  function draw(value, lit, newLabels) {
    if (newLabels) labels = newLabels;
    last = [value, lit];
    ctx.fillStyle = '#10151d';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = lit ? '#58c27d' : '#e0533d';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 240);
    drawIcon(ctx, 'sun', 92, 128, 140, lit ? '#ffd166' : '#5b6170');
    ctx.fillStyle = '#f4f1e8';
    ctx.textBaseline = 'middle';
    fit(labels.output, 600, 50, 312);
    ctx.fillText(labels.output, 180, 88);
    ctx.font = '800 96px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = lit ? '#7ee2a0' : '#ff7a63';
    ctx.fillText(String(value), 180, 176);
    ctx.fillStyle = '#c9ced6';
    const state = lit ? labels.sunlight : labels.shadow;
    fit(state, 600, 40, 200);
    ctx.fillText(state, 290, 184);
    tex.needsUpdate = true;
  }
  draw(0, false);
  return { texture: tex, draw, setLabels(l) { draw(last[0], last[1], l); } };
}

// "Selected" floating tag.
export function makeTagTexture(text = 'Selected') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const ctx = c.getContext('2d');
  const tex = canvasTexture(c);
  tex.userData.setText = (s) => { draw(s); tex.needsUpdate = true; };
  draw(text);
  return tex;
  function draw(text) {
  ctx.clearRect(0, 0, 512, 160);
  ctx.fillStyle = 'rgba(12, 20, 32, 0.88)';
  const r = 40;
  ctx.beginPath();
  ctx.moveTo(r, 8); ctx.lineTo(512 - r, 8); ctx.quadraticCurveTo(504, 8, 504, r + 8);
  ctx.lineTo(504, 152 - r); ctx.quadraticCurveTo(504, 152, 512 - r, 152);
  ctx.lineTo(r, 152); ctx.quadraticCurveTo(8, 152, 8, 152 - r);
  ctx.lineTo(8, r + 8); ctx.quadraticCurveTo(8, 8, r, 8);
  ctx.fill();
  ctx.strokeStyle = '#5ee1ff';
  ctx.lineWidth = 8;
  ctx.stroke();
  // check mark
  ctx.strokeStyle = '#5ee1ff';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(60, 82); ctx.lineTo(95, 115); ctx.lineTo(150, 48);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  let size = 70;
  ctx.font = `700 ${size}px "Segoe UI", Arial, sans-serif`;
  while (ctx.measureText(text).width > 300 && size > 30) { size -= 2; ctx.font = `700 ${size}px "Segoe UI", Arial, sans-serif`; }
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 180, 84);
  }
}

// Solar cell grid on a dark blue panel.
export function makeSolarCellTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a2c52';
  ctx.fillRect(0, 0, 256, 160);
  const cols = 8, rows = 5;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const g = ctx.createLinearGradient(0, y * 32, 0, y * 32 + 30);
      g.addColorStop(0, '#2c4a86');
      g.addColorStop(1, '#203a6c');
      ctx.fillStyle = g;
      ctx.fillRect(x * 32 + 2, y * 32 + 2, 28, 28);
      ctx.fillStyle = 'rgba(200,215,240,0.25)';
      ctx.fillRect(x * 32 + 2, y * 32 + 15, 28, 1); // busbar
    }
  }
  return canvasTexture(c);
}

// Procedural Earth: oceans, continents, clouds, ice caps (equirectangular).
export function makeEarthTexture(seed) {
  const w = 512, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const land = createSimplex2D(seed + 301);
  const cloud = createSimplex2D(seed + 302);
  const rand = mulberry32(seed + 303);
  for (let y = 0; y < h; y++) {
    const lat = (y / h) * Math.PI - Math.PI / 2;
    for (let x = 0; x < w; x++) {
      const lon = (x / w) * Math.PI * 2;
      const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
      const l = fbm(land, px * 1.6 + pz * 0.7 + 3, py * 1.8 - pz * 0.9, 5);
      const cl = fbm(cloud, px * 2.4 - pz * 1.1 + 9, py * 4 + pz * 0.8, 4);
      let r, g, b;
      if (l > 0.08) { // land
        const t = Math.min(1, (l - 0.08) * 3);
        r = 70 + 90 * t; g = 110 + 40 * t; b = 60 + 20 * t;
        if (Math.abs(lat) < 0.45 && t > 0.4) { r = 180; g = 150; b = 100; } // desert belt
      } else {
        const d = Math.min(1, (0.08 - l) * 2.5);
        r = 25 - 10 * d; g = 80 - 25 * d; b = 170 - 20 * d;
      }
      if (Math.abs(lat) > 1.25) { r = g = b = 235; } // ice caps
      const cloudA = Math.max(0, Math.min(1, (cl - 0.05) * 2.2)) * 0.9;
      r = r * (1 - cloudA) + 245 * cloudA;
      g = g * (1 - cloudA) + 248 * cloudA;
      b = b * (1 - cloudA) + 252 * cloudA;
      const i = (y * w + x) * 4;
      const jitter = (rand() - 0.5) * 6;
      img.data[i] = r + jitter; img.data[i + 1] = g + jitter; img.data[i + 2] = b + jitter; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(c);
}
