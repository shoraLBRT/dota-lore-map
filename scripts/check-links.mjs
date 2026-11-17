// Проверка внешних ссылок на картинки и видео (#109, ARCHITECTURE A7).
// Опрашивает только CDN Valve и YouTube oEmbed; Liquipedia, страницы dota2.com (sourceUrl)
// и прочие сайты не трогает. В `npm run check` не входит — нужна сеть; запускается
// еженедельно из .github/workflows/links.yml и вручную: `node scripts/check-links.mjs`.
// Вывод — только сломанные адреса и итог одной строкой; код выхода 1, если есть сломанные.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const USER_AGENT = 'DotaLoreMapLinkCheck/0.1 (non-commercial fan project)';
const CONCURRENCY = 4;
const TIMEOUT_MS = 15_000;

// Те же адреса, что строят heroPortrait / heroCrop / heroRender в src/data/world.ts (A6).
const HERO_BASE = 'https://cdn.cloudflare.steamstatic.com/apps/dota2';
export const heroImages = (key) => [
  `${HERO_BASE}/images/dota_react/heroes/${key}.png`,
  `${HERO_BASE}/images/dota_react/heroes/crops/${key}.png`,
  `${HERO_BASE}/videos/dota_react/heroes/renders/${key}.png`,
];

/** Разрешённые для опроса хосты: CDN Valve (*.steamstatic.com) и YouTube. */
export function isAllowedHost(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return host === 'steamstatic.com' || host.endsWith('.steamstatic.com') || host === 'www.youtube.com';
}

const oembed = (id) =>
  `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;

function srcValues(src) {
  if (!src) return [];
  return typeof src === 'string' ? [src] : Object.values(src).filter((v) => typeof v === 'string');
}

/**
 * Все проверяемые адреса из world.generated.json: [{ url, where }], без повторов.
 * Относительные пути (ассеты сборки) и чужие хосты отбрасываются.
 */
export function collectUrls(world) {
  const out = new Map();
  const add = (url, where) => {
    if (/^https:\/\//.test(url) && isAllowedHost(url) && !out.has(url)) out.set(url, where);
  };
  for (const h of world.heroes ?? []) {
    for (const u of heroImages(h.key)) add(u, `hero ${h.key}`);
    for (const u of h.profile?.art ?? []) add(u, `hero ${h.key} profile.art`);
  }
  for (const m of world.media ?? []) {
    if (m.type === 'youtube' && m.youtubeId) add(oembed(m.youtubeId), `media ${m.id}`);
    for (const u of srcValues(m.src)) add(u, `media ${m.id}`);
  }
  for (const r of world.regions ?? []) {
    for (const u of srcValues(r.art)) add(u, `region ${r.id} art`);
    for (const p of r.places ?? []) for (const u of srcValues(p.art)) add(u, `place ${r.id}/${p.slug} art`);
  }
  return [...out].map(([url, where]) => ({ url, where }));
}

async function request(fetchFn, url, method) {
  const headers = { 'User-Agent': USER_AGENT };
  if (method === 'GET') headers.Range = 'bytes=0-0';
  const res = await fetchFn(url, { method, headers, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  // Тело не нужно: на GET с Range это один байт, освобождаем соединение.
  await res.body?.cancel?.().catch(() => {});
  return res.status;
}

// Паузы перед повторами: CDN Valve временами отвечает раннерам GitHub 503 на HEAD.
export const RETRY_DELAYS_MS = [2_000, 6_000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * HEAD (для oEmbed — GET); на HEAD с ответом 405, 429 или 5xx — сразу GET с Range.
 * 5xx, 429 и ошибки сети повторяются с паузами RETRY_DELAYS_MS, 4xx — нет.
 * Возвращает null или описание ошибки.
 */
export async function checkUrl(url, fetchFn = fetch, delays = RETRY_DELAYS_MS) {
  const firstMethod = url.startsWith('https://www.youtube.com/oembed') ? 'GET' : 'HEAD';
  let last = '';
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0 && delays[attempt - 1] > 0) await sleep(delays[attempt - 1]);
    try {
      let status = await request(fetchFn, url, firstMethod);
      if (firstMethod === 'HEAD' && (status === 405 || status === 429 || status >= 500)) {
        status = await request(fetchFn, url, 'GET');
      }
      if (status >= 200 && status < 300) return null;
      last = `HTTP ${status}`;
      if (status < 500 && status !== 429) break; // 4xx не повторяем: адрес сломан
    } catch (e) {
      last = e?.name === 'TimeoutError' ? 'timeout' : String(e?.cause?.code ?? e?.message ?? e);
    }
  }
  return last;
}

/** Проверяет адреса по CONCURRENCY за раз; возвращает сломанные [{ url, where, error }]. */
export async function checkAll(items, fetchFn = fetch, concurrency = CONCURRENCY) {
  const broken = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      const error = await checkUrl(item.url, fetchFn);
      if (error) broken.push({ ...item, error });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return broken.sort((a, b) => a.url.localeCompare(b.url));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = fileURLToPath(new URL('../src/data/world.generated.json', import.meta.url));
  const items = collectUrls(JSON.parse(readFileSync(file, 'utf8')));
  const broken = await checkAll(items);
  for (const b of broken) console.log(`BROKEN ${b.error}  ${b.url}  (${b.where})`);
  console.log(`check-links: ${items.length - broken.length}/${items.length} ok, ${broken.length} broken`);
  process.exitCode = broken.length ? 1 : 0;
}
