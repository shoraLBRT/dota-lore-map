// Картинка превью для соцсетей (#116): `node scripts/og-image.mjs` → public/og.png, 1200×630.
// `node scripts/og-image.mjs --check` (часть `npm run check`, после сборки) — разбор dist/index.html: все поля карточки на месте.
// Полоса растрового арта мира (map/art/world.jpg, оба материка) и название проекта поверх затемнения снизу.
// Шрифт — системный с засечками (librsvg в sharp не читает woff2 из public/fonts); результат коммитится.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SRC = fileURLToPath(new URL('../map/art/world.jpg', import.meta.url));
const OUT = fileURLToPath(new URL('../public/og.png', import.meta.url));
export const OG_W = 1200;
export const OG_H = 630;
export const SITE = 'https://shoralbrt.github.io/dota-lore-map/';

/** Метатеги страницы: `property` и `name` → `content` (как их видит валидатор Open Graph). */
export function metaTags(html) {
  const tags = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/g)) {
    const key = /\s(?:property|name)="([^"]+)"/.exec(tag)?.[1];
    const content = /\scontent="([^"]*)"/.exec(tag)?.[1];
    if (key && content !== undefined) tags[key] = content;
  }
  return tags;
}

/** Ошибки карточки превью: пустой список — всё на месте. */
export function cardProblems(html) {
  const tags = metaTags(html);
  const want = {
    'og:url': SITE,
    'og:image': `${SITE}og.png`,
    'og:image:width': String(OG_W),
    'og:image:height': String(OG_H),
    'twitter:card': 'summary_large_image',
    'twitter:image': `${SITE}og.png`,
  };
  const problems = [];
  for (const key of ['og:type', 'og:title', 'og:description', 'twitter:title', 'twitter:description', 'theme-color']) {
    if (!tags[key]) problems.push(`нет ${key}`);
  }
  for (const [key, value] of Object.entries(want)) {
    if (tags[key] !== value) problems.push(`${key}: ждём ${value}, есть ${tags[key] ?? '—'}`);
  }
  if (!/<noscript>[\s\S]*lang="ru"[\s\S]*lang="en"[\s\S]*<\/noscript>/.test(html)) problems.push('нет <noscript> на ru и en');
  return problems;
}

/** Полоса мира с пропорцией превью: на всю ширину, по вертикали — вокруг материков (центр на 0.49 высоты). */
export function cropBox(size, center = 0.49) {
  const height = Math.round((size * OG_H) / OG_W);
  const top = Math.min(size - height, Math.max(0, Math.round(size * center - height / 2)));
  return { left: 0, top, width: size, height };
}

const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.45" stop-color="#0b0d11" stop-opacity="0"/>
      <stop offset="1" stop-color="#0b0d11" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#shade)"/>
  <g font-family="Georgia, 'Times New Roman', serif" fill="#e8dcc0" text-anchor="middle">
    <text x="600" y="520" font-size="68" font-weight="700" letter-spacing="3">Мир Dota 2 · Dota 2 World</text>
    <text x="600" y="580" font-size="28" fill="#c9bfa8" letter-spacing="1">Интерактивная карта лора · Interactive lore map</text>
  </g>
</svg>`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === '--check') {
  const problems = cardProblems(readFileSync(fileURLToPath(new URL('../dist/index.html', import.meta.url)), 'utf8'));
  if (problems.length) {
    console.error(`dist/index.html, карточка превью:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log('dist/index.html: карточка превью на месте');
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { width } = await sharp(SRC).metadata();
  await sharp(SRC)
    .extract(cropBox(width))
    .resize(OG_W, OG_H)
    .composite([{ input: Buffer.from(overlay) }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(OUT);
  console.log(`og.png ${OG_W}×${OG_H} → ${OUT}`);
}
