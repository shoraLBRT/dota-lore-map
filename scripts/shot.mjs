// Снимок экрана одной командой (#105): `npm run shot -- r/icewrack [1440x900]` (или "#/r/icewrack").
// Берёт уже запущенный dev-сервер (порт 5183, .claude/launch.json), иначе поднимает его сам на время снимка.
// Файл — e2e/shots/<адрес>-<Ш>x<В>.png (в .gitignore). Сеть не глушится: шрифты и портреты настоящие.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 5183;
const BASE = `http://localhost:${PORT}/dota-lore-map/`;

const [hashArg = '#/', sizeArg = '1440x900'] = process.argv.slice(2);
const size = /^(\d+)x(\d+)$/.exec(sizeArg);
if (!size) {
  console.error(`Размер — ШxВ, например 1440x900; получено: ${sizeArg}`);
  process.exit(2);
}
const [width, height] = [Number(size[1]), Number(size[2])];
// "#/r/icewrack", "/r/icewrack" и "r/icewrack" — одно и то же (в Git Bash пишите без ведущего "/": он портит пути).
const hash = `#/${hashArg.replace(/^#?\/?/, '')}`;

async function up() {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
}

let server;
if (!(await up())) {
  server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true });
  const until = Date.now() + 60_000;
  while (!(await up())) {
    if (Date.now() > until) {
      console.error('Dev-сервер не поднялся за 60 с');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

const slug = hash.replace(/^#\/?/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'intro';
const file = `e2e/shots/${slug}-${width}x${height}.png`;
mkdirSync('e2e/shots', { recursive: true });

// Chromium Playwright (`npx playwright install chromium`), а если его нет — установленный Google Chrome.
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
try {
  const mobile = width < 768;
  const page = await browser.newPage({ viewport: { width, height }, locale: 'ru-RU', isMobile: mobile, hasTouch: mobile });
  await page.goto(BASE + hash, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // посадка камеры (A4)
  await page.screenshot({ path: file });
  console.log(file);
} finally {
  await browser.close();
  if (server) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
    else server.kill();
  }
}
