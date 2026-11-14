// Every English report in simulation.js (+ the prediction line) has a Ukrainian template,
// and every English UI key has a Ukrainian key. Run: node scripts/i18n_check.mjs
import { readFileSync } from 'node:fs';
globalThis.localStorage = { getItem: () => 'uk', setItem() {} };
const { feedbackText, t, setLanguage } = await import('../src/i18n.js');
const src = readFileSync(new URL('../src/simulation.js', import.meta.url), 'utf8');
const msgs = [...src.matchAll(/(?:note\(|\? |: )\s*['`]([^'`]+)['`]/g)].map((m) => m[1].replace(/\$\{[^}]+\}/g, '3'))
  .filter((m) => /^[A-Z]/.test(m) && m.endsWith('.'));
msgs.push('You predicted 0 energy. Your battery now has 4.', 'You predicted 10 energy. Your battery now has 10.');
let missing = 0;
for (const m of msgs) { const u = feedbackText(m); if (u === m) { missing++; console.log('MISSING', m); } }
console.log(`${msgs.length - missing}/${msgs.length} simulation/report messages translated`);
const i18n = readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');
const block = (name) => i18n.slice(i18n.indexOf(`const ${name} = {`), i18n.indexOf('};', i18n.indexOf(`const ${name} = {`)));
const keys = (b) => new Set([...b.matchAll(/^\s+'([\w.]+)':/gm)].map((m) => m[1]));
const en = keys(block('en')), uk = keys(block('uk'));
const lack = [...en].filter((k) => !uk.has(k));
console.log(`UI keys: en ${en.size}, uk ${uk.size}, missing in uk: ${lack.length ? lack.join(', ') : 'none'}`);
console.log('sample:', feedbackText('You stored 5 energy for the next shift.'), '|', t('hud.shift', { n: 2, total: 4 }));
