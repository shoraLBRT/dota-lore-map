// Замер плавности (#185, ARCHITECTURE A14): `npm run perf [-- --no-build] [--headed] [--size 1440x900] [--runs 3] [--query <флаг>=…]`.
// Боевая сборка (`vite build` + `vite preview`), Chromium с GPU; кадры считает requestAnimationFrame в странице.
// Шаги: вход («Начать» → мир), колесо внутрь ×12, перетаскивание, колесо наружу до мира, клик по региону.
// На телефоне (ширина < 768) свободной камеры в мире нет — только вход и регион из списка.
// Первая отрисовка (#186): `npm run perf -- --load [--net 4g] [--url <адрес>] [--runs 3]` — FCP, LCP, CLS и `load`
// на холодном кэше (новый контекст на прогон); `--net 4g` — «Fast 4G» DevTools, `--url` — чужой адрес без сборки.
// В `npm run check` не входит: цифры зависят от машины. Бюджет — в A14.
/* global window, document, requestAnimationFrame -- функции для page.evaluate выполняются в браузере */
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const sizeArg = opt('--size', '1440x900');
const size = /^(\d+)x(\d+)$/.exec(sizeArg);
if (!size) {
  console.error(`Размер — ШxВ, например 1440x900; получено: ${sizeArg}`);
  process.exit(2);
}
const [width, height] = [Number(size[1]), Number(size[2])];
const mobile = width < 768;
const runs = Math.max(1, Number(opt('--runs', '1')) || 1);
const PORT = 4185;
const loadMode = flag('--load');
const external = opt('--url', '');
const BASE = external || `http://localhost:${PORT}/dota-lore-map/`;
/** Строка запроса до `#` (флаги прототипов для сравнения): `--query <флаг>=<значение>`. */
const QUERY = opt('--query', '') ? `?${opt('--query', '')}` : '';
const net4g = opt('--net', '') === '4g';
/** «Fast 4G» DevTools: 9 Мбит/с вниз, 1.5 вверх, задержка 60 мс × 2.75 (как в Chrome). */
const FAST_4G = { offline: false, latency: 165, downloadThroughput: (9e6 / 8) * 0.9, uploadThroughput: (1.5e6 / 8) * 0.9 };
/** Бюджет первой отрисовки (A14), мс: без троттлинга — FCP и LCP, на «Fast 4G» — FCP. */
const LOAD_BUDGET = net4g ? { fcp: 2000, lcp: Infinity, cls: 0.01 } : { fcp: 1000, lcp: 1500, cls: 0.01 };

/** Бюджет A14: средний темп, p95 и худший кадр; телефон (эмуляция) — только средний темп. */
const BUDGET = mobile ? { fps: 50, p95: Infinity, worst: Infinity } : { fps: 57, p95: 20, worst: 50 };

if (!flag('--no-build') && !external) {
  const r = spawnSync('npm', ['run', 'build', '--silent'], { stdio: ['ignore', 'ignore', 'inherit'], shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function up() {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
}
const server = external ? null : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true });
const until = Date.now() + 60_000;
while (!(await up())) {
  if (Date.now() > until) {
    console.error('vite preview не поднялся за 60 с');
    stop();
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 300));
}

function stop() {
  if (!server) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
  else server.kill();
}

/** Счётчик кадров в странице: интервалы между rAF и длинные задачи. */
const RECORDER = () => {
  const w = window;
  w.__perf = {
    start() {
      const s = { frames: [], longest: 0, running: true, last: 0 };
      w.__perfRun = s;
      const tick = (t) => {
        if (!s.running) return;
        if (s.last) s.frames.push(t - s.last);
        s.last = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    stop() {
      const s = w.__perfRun;
      s.running = false;
      return { frames: s.frames, longest: s.longest };
    },
  };
  try {
    new PerformanceObserver((list) => {
      const s = w.__perfRun;
      if (!s || !s.running) return;
      for (const e of list.getEntries()) s.longest = Math.max(s.longest, e.duration);
    }).observe({ type: 'longtask', buffered: false });
  } catch {
    /* нет longtask — не беда */
  }
};

function stats(name, { frames, longest }) {
  const sorted = [...frames].sort((a, b) => a - b);
  const total = frames.reduce((a, b) => a + b, 0);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
  const worst = sorted[sorted.length - 1] ?? 0;
  const fps = total ? (frames.length * 1000) / total : 0;
  const ok = fps >= BUDGET.fps && p95 <= BUDGET.p95 && worst <= BUDGET.worst;
  return { name, fps, p95, worst, over34: frames.filter((f) => f > 34).length, longest, ok };
}

/** LCP и CLS из буферизованных записей; FCP — paint timing, `load` — Navigation Timing. */
const VITALS = () => {
  const w = window;
  w.__vitals = { lcp: 0, lcpEl: '', cls: 0 };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        w.__vitals.lcp = e.startTime;
        const el = e.element;
        w.__vitals.lcpEl = el ? `${el.tagName.toLowerCase()}${e.url ? ' ' + e.url.split('/').pop() : el.className ? '.' + String(el.className).split(' ')[0] : ''}` : '?';
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) w.__vitals.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    /* нет наблюдателей — числа будут нулями */
  }
};

async function runLoad(browser) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'ru-RU', isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
  await context.addInitScript(VITALS);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (net4g) await cdp.send('Network.emulateNetworkConditions', FAST_4G);
  let loadOk = true;
  await page.goto(BASE + QUERY + '#/', { waitUntil: 'load', timeout: 30_000 }).catch(() => (loadOk = false));
  // LCP пишется, пока нет ввода: ждём, пока полная картинка мира проявится (или 3 с), чтобы она попала в замер.
  await page.waitForSelector('[data-world-art] img[data-ready]', { timeout: 3000 }).catch(() => undefined);
  await pause(page, 500);
  const v = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
    const nav = performance.getEntriesByType('navigation')[0];
    const art = performance.getEntriesByType('resource').find((e) => e.name.includes('world-4096'));
    return { fcp, lcp: window.__vitals.lcp, lcpEl: window.__vitals.lcpEl, cls: window.__vitals.cls, load: nav?.loadEventEnd || 0, art: art ? art.responseEnd : -1 };
  });
  await context.close();
  // Ноль — замер не состоялся (нет записи paint или LCP), а не быстрая страница.
  const ok = loadOk && v.fcp > 0 && v.lcp > 0 && v.fcp <= LOAD_BUDGET.fcp && v.lcp <= LOAD_BUDGET.lcp && v.cls <= LOAD_BUDGET.cls;
  return { ...v, loadOk, ok };
}

async function loadReport(browser, gpu) {
  const lcp = Number.isFinite(LOAD_BUDGET.lcp) ? `, LCP ≤ ${LOAD_BUDGET.lcp} мс` : '';
  console.log(`${BASE} ${width}x${height}${net4g ? ', Fast 4G' : ''}, GPU: ${gpu}; бюджет: FCP ≤ ${LOAD_BUDGET.fcp} мс${lcp}, CLS ≤ ${LOAD_BUDGET.cls}`);
  let failed = false;
  for (let r = 0; r < runs; r++) {
    const s = await runLoad(browser);
    if (!s.ok) failed = true;
    const load = s.loadOk ? `${s.load.toFixed(0)} мс` : 'нет за 30 с';
    const art = s.art < 0 ? '—' : `${s.art.toFixed(0)} мс`;
    console.log(`${s.ok ? 'ok  ' : 'FAIL'} FCP ${s.fcp.toFixed(0).padStart(5)} мс  LCP ${s.lcp.toFixed(0).padStart(5)} мс (${s.lcpEl})  CLS ${s.cls.toFixed(3)}  load ${load}  world-4096 ${art}`);
  }
  return failed;
}

const pause = (page, ms) => page.waitForTimeout(ms);

async function measure(page, name, action) {
  await page.evaluate(() => window.__perf.start());
  await action();
  return stats(name, await page.evaluate(() => window.__perf.stop()));
}

async function run(browser) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'ru-RU', isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
  await context.addInitScript(RECORDER);
  const page = await context.newPage();
  await page.goto(BASE + QUERY + '#/', { waitUntil: 'load' });
  const start = page.getByRole('button', { name: 'Начать' });
  await start.waitFor();
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Начать');
    return b && !b.disabled;
  });
  await pause(page, 1000);
  const cx = Math.round(width * 0.45);
  const cy = Math.round(height * 0.5);
  const out = [];

  out.push(
    await measure(page, 'вход', async () => {
      await start.click();
      await pause(page, 4000);
    }),
  );

  if (!mobile) {
    await page.mouse.move(cx, cy);
    out.push(
      await measure(page, 'колесо ×12', async () => {
        for (let i = 0; i < 12; i++) {
          await page.mouse.wheel(0, -100);
          await pause(page, 120);
        }
        await pause(page, 600);
      }),
    );
    out.push(
      await measure(page, 'перетаскивание', async () => {
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        for (let i = 1; i <= 40; i++) {
          await page.mouse.move(cx - i * 8, cy - i * 4);
          await pause(page, 16);
        }
        await page.mouse.up();
        await pause(page, 800);
      }),
    );
    out.push(
      await measure(page, 'колесо наружу', async () => {
        await page.mouse.move(cx, cy);
        for (let i = 0; i < 16; i++) {
          await page.mouse.wheel(0, 100);
          await pause(page, 120);
        }
        await pause(page, 600);
      }),
    );
  }

  out.push(
    await measure(page, 'клик по региону', async () => {
      if (mobile) await page.locator('[data-region-list] button').first().click();
      else await page.locator('polygon[data-region="icewrack"], path[data-region="icewrack"], [data-region="icewrack"]').last().click({ force: true });
      await pause(page, 1500);
    }),
  );
  await context.close();
  return out;
}

const launchArgs = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const headless = !flag('--headed');
const browser = await chromium
  .launch({ headless, args: launchArgs })
  .catch(() => chromium.launch({ channel: 'chrome', headless, args: launchArgs }));
let failed = false;
try {
  const gpu = await (async () => {
    const p = await browser.newPage();
    const r = await p.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'нет WebGL';
    });
    await p.close();
    return r;
  })();
  if (loadMode) failed = await loadReport(browser, gpu);
  else {
    console.log(`${width}x${height}${mobile ? ' (телефон)' : ''}, GPU: ${gpu}; бюджет: ≥ ${BUDGET.fps} к/с${mobile ? '' : `, p95 ≤ ${BUDGET.p95} мс, худший ≤ ${BUDGET.worst} мс`}`);
    for (let r = 0; r < runs; r++) {
      if (runs > 1) console.log(`— прогон ${r + 1}`);
      for (const s of await run(browser)) {
        if (!s.ok) failed = true;
        console.log(
          `${s.ok ? 'ok  ' : 'FAIL'} ${s.name.padEnd(16)} ${s.fps.toFixed(1).padStart(5)} к/с  p95 ${s.p95.toFixed(0).padStart(4)} мс  худший ${s.worst.toFixed(0).padStart(4)} мс  >34 мс: ${String(s.over34).padStart(3)}  длинная задача ${s.longest.toFixed(0)} мс`,
        );
      }
    }
  }
} finally {
  await browser.close();
  stop();
}
process.exitCode = failed ? 1 : 0;
