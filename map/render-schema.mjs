// Рисует схему мира docs/map/schema.svg из map/layout.json и research/e1/regions.json.
// Запуск из корня репозитория: node map/render-schema.mjs   (Node 22, без зависимостей)
// Схема — для согласования географии; это не финальный арт.
// Заодно пишет docs/map/schema-base.svg — основу для генерации арта (img2img / контур):
// без текста и маркеров, регионы залиты цветом среды, без фиксированного размера (масштабируется под окно).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/map/schema.svg');
const OUT_BASE = join(ROOT, 'docs/map/schema-base.svg');
const layout = JSON.parse(readFileSync(join(ROOT, 'map/layout.json'), 'utf8'));
const { regions } = JSON.parse(readFileSync(join(ROOT, 'research/e1/regions.json'), 'utf8'));

const W = 1600, H = 1000;
const X = (x) => (x * W).toFixed(1), Y = (y) => (y * H).toFixed(1);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// условные цвета: по ярусу, затем по стороне
const STYLE = {
  upper: { fill: '#c9d3ef', stroke: '#eef2ff', opacity: 0.22 },
  abyss: { fill: '#c2410c', stroke: '#fb923c', opacity: 0.35 },
  radiant: { fill: '#6b8f3a', stroke: '#b5d67a', opacity: 0.85 },
  dire: { fill: '#8e3324', stroke: '#e07a5f', opacity: 0.85 },
  neutral: { fill: '#6e7f90', stroke: '#b9c7d4', opacity: 0.85 },
  fog: { fill: '#9aa3ab', stroke: '#d5dbe0', opacity: 0.55 },
};
const styleOf = (r) => (r.tier !== 'continent' ? STYLE[r.tier] : r.id === 'uncharted' ? STYLE.fog : STYLE[r.side]);
const UNDERWATER = new Set(['the-deep']);

// цвета среды — только для основы арта (описания сред — в docs/map/ART-PROMPTS.md)
const BIOME = {
  heavens: '#3b4f8f', planes: '#4a2f7a', icewrack: '#dfe9f2', 'radiant-lands': '#7fa05a', nightsilver: '#3f6a6e',
  stonehall: '#9aa86a', 'free-cities': '#a9a777', quoidge: '#8d8a5e', hazhadal: '#9c8a6a', druud: '#a2553a',
  scintillant: '#d9b56a', 'wailing-mountains': '#5b5450', shadeshore: '#4c6a5e', 'the-deep': '#0f2a44', cladd: '#6f9a5a',
  'tropic-isles': '#4fa35a', 'western-forests': '#2f5e34', 'slom-elze': '#8a9a5e', hoven: '#2c3a2a', fellstrath: '#2f7a3c',
  tomokan: '#55705f', 'empire-of-bone': '#cfc6b0', 'middle-kingdoms': '#96a46a', uncharted: '#b8bec4', underdark: '#2a3d2a', hells: '#a3300f',
};
const pts = (poly) => poly.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
{
  const base = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`, `<rect width="${W}" height="${H}" fill="#1d3550"/>`];
  for (const r of regions) {
    const L = layout.regions[r.id];
    const c = BIOME[r.id] || '#808080';
    if (L) base.push(`<polygon points="${pts(L.polygon)}" fill="${c}" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`);
  }
  base.push('</svg>');
  mkdirSync(dirname(OUT_BASE), { recursive: true });
  writeFileSync(OUT_BASE, base.join('\n') + '\n');
}

const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, 'Times New Roman', serif">`);
out.push(`<defs>
  <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#16263a"/><stop offset="0.5" stop-color="#1d3550"/><stop offset="1" stop-color="#16263a"/>
  </linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0b0f24"/><stop offset="1" stop-color="#2a3566"/>
  </linearGradient>
  <linearGradient id="fire" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3a0d06"/><stop offset="1" stop-color="#120403"/>
  </linearGradient>
  <pattern id="waves" width="40" height="16" patternUnits="userSpaceOnUse">
    <path d="M0 8 q10 -6 20 0 t20 0" fill="none" stroke="#3b5a7a" stroke-width="1" opacity="0.35"/>
  </pattern>
  <pattern id="deep" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="10" stroke="#e07a5f" stroke-width="2" opacity="0.35"/>
  </pattern>
</defs>`);
out.push(`<rect width="${W}" height="${H}" fill="url(#sea)"/><rect width="${W}" height="${H}" fill="url(#waves)"/>`);
const [, u1] = layout.bands.upper, [a0] = layout.bands.abyss;
out.push(`<rect width="${W}" height="${Y(u1)}" fill="url(#sky)"/>`);
out.push(`<rect y="${Y(a0)}" width="${W}" height="${(H - a0 * H).toFixed(1)}" fill="url(#fire)"/>`);
// экватор — граница правила В10
out.push(`<line x1="0" y1="${Y(0.5)}" x2="${W}" y2="${Y(0.5)}" stroke="#f0e6d2" stroke-width="1" stroke-dasharray="6 8" opacity="0.35"/>`);
out.push(`<text x="${X(0.995)}" y="${Y(0.494)}" font-size="12" fill="#f0e6d2" opacity="0.6" text-anchor="end">экватор</text>`);
out.push(`<text x="${X(0.995)}" y="${Y(0.47)}" font-size="12" fill="#b5d67a" opacity="0.8" text-anchor="end">▲ RADIANT</text>`);
out.push(`<text x="${X(0.995)}" y="${Y(0.535)}" font-size="12" fill="#e07a5f" opacity="0.8" text-anchor="end">▼ DIRE</text>`);

for (const r of regions) {
  const L = layout.regions[r.id];
  if (!L) continue;
  const s = styleOf(r);
  const dash = r.id === 'uncharted' || UNDERWATER.has(r.id) ? ' stroke-dasharray="8 5"' : '';
  const fillOpacity = UNDERWATER.has(r.id) ? 0.3 : s.opacity;
  out.push(`<polygon id="${r.id}" points="${pts(L.polygon)}" fill="${s.fill}" fill-opacity="${fillOpacity}" stroke="${s.stroke}" stroke-width="1.6" stroke-linejoin="round"${dash}/>`);
  if (UNDERWATER.has(r.id)) out.push(`<polygon points="${pts(L.polygon)}" fill="url(#deep)" stroke="none"/>`);
}

// места
const capitals = new Set(regions.flatMap((r) => r.locations.filter((l) => l.capital).map((l) => l.name)));
for (const [name, { pos }] of Object.entries(layout.places)) {
  const [x, y] = [pos[0] * W, pos[1] * H];
  if (capitals.has(name)) {
    out.push(`<path d="M${x.toFixed(1)} ${(y - 5).toFixed(1)} l5 5 l-5 5 l-5 -5 z" fill="#ffd98a" stroke="#2a1a08" stroke-width="1"/>`);
  } else {
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#f5e9c8" stroke="#2a1a08" stroke-width="0.8"/>`);
  }
  out.push(`<text x="${(x + 6).toFixed(1)}" y="${(y + 2.5).toFixed(1)}" font-size="7.5" fill="#f5ecd6" stroke="#10151c" stroke-width="2" paint-order="stroke" opacity="0.9">${esc(name)}</text>`);
}

// подписи регионов (RU), длинные — в две строки
for (const r of regions) {
  const L = layout.regions[r.id];
  if (!L) continue;
  const name = r.ru.toUpperCase();
  const words = name.split(' ');
  let lines = [name];
  if (name.length > 14 && words.length > 1) {
    let best = 1, bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  const [x, y] = [L.label[0] * W, L.label[1] * H];
  const size = r.tier === 'continent' ? 14 : 16;
  lines.forEach((line, i) => {
    const dy = (i - (lines.length - 1) / 2) * (size + 2) + size * 0.35;
    out.push(`<text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" font-size="${size}" font-weight="bold" letter-spacing="1.5" text-anchor="middle" fill="#fff4dc" stroke="#0c1016" stroke-width="3.5" paint-order="stroke">${esc(line)}</text>`);
  });
}

out.push('</svg>');
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out.join('\n') + '\n');
console.log(`схема: ${OUT.slice(ROOT.length + 1)}, основа арта: ${OUT_BASE.slice(ROOT.length + 1)}`);
