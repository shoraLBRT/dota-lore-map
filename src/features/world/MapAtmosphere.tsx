import { useEffect, useRef, type RefObject } from 'react';
import { cssDuration } from '../../app/motion';
import {
  cloudsFor,
  DEPTH_ALPHA,
  drift,
  FOG_PATCHES,
  GLOWS,
  project,
  pulse,
  sizeFade,
  strength,
  visible,
  zoomOf,
  type Box,
  type PatchKind,
  type WorldRect,
} from './atmosphere';
import { MOBILE_QUERY, prefersReducedMotion } from './camera';
import styles from './MapAtmosphere.module.css';

/** Пропорция спрайта облака (ширина к высоте), как у прежних CSS-облаков. */
const CLOUD_ASPECT = 2.4;
/** Разрешение холста к CSS-px: облака и туман мягкие, полное разрешение им не нужно. */
const RESOLUTION = { full: 0.75, lite: 0.5 } as const;
/** Базовая прозрачность пятен по виду. */
const PATCH_ALPHA: Record<PatchKind, number> = { fog: 0.75, haze: 0.5, star: 0.55, lava: 0.6 };
/** Цвета — токены из tokens.css (ARCHITECTURE A8). */
const PATCH_TOKEN: Record<PatchKind, string> = {
  fog: '--atmo-fog',
  haze: '--atmo-haze',
  star: '--atmo-star',
  lava: '--atmo-lava',
};

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function matches(query: string): boolean {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  return ctx ? [c, ctx] : null;
}

/** Эллиптическое пятно: радиальный градиент, растянутый по осям. */
function puff(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

/** Облако рисуется заранее один раз — те же три клуба и тень снизу, что у CSS-облаков (A9). */
function cloudSprite(light: string, shade: string): HTMLCanvasElement | null {
  const w = 384;
  const h = Math.round(w / CLOUD_ASPECT);
  const made = canvasOf(w, h);
  if (!made) return null;
  const [c, ctx] = made;
  ctx.filter = 'blur(4px)';
  puff(ctx, w * 0.5, h * 0.8, w * 0.44, h * 0.24, shade);
  puff(ctx, w * 0.24, h * 0.6, w * 0.22, h * 0.34, light);
  puff(ctx, w * 0.46, h * 0.38, w * 0.25, h * 0.42, light);
  puff(ctx, w * 0.74, h * 0.55, w * 0.22, h * 0.36, light);
  return c;
}

/** Пятно тумана или свечения: круглый градиент, растягивается по полуосям при рисовании. */
function patchSprite(color: string, glow: boolean): HTMLCanvasElement | null {
  const made = canvasOf(128, 128);
  if (!made) return null;
  const [c, ctx] = made;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  // Свечение — яркое ядро и долгий хвост (блум), туман — ровное пятно.
  if (glow) g.addColorStop(0.35, color.replace(/\/\s*[\d.]+\s*\)/, '/ 0.25)'));
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

interface Props {
  /** Слой карты под камерой: его положение на экране — положение мира. */
  layerRef: RefObject<HTMLDivElement | null>;
  /** Открытый регион: его туман реже, облака тоньше. */
  activeId?: string;
}

/**
 * Постэффекты поверх арта мира (#167, ARCHITECTURE A9): облака на трёх высотах с параллаксом от камеры,
 * туман и дымка, свечение ярусов на canvas и зерно CSS-слоем. Сила — от приближения (`strength`).
 * Положение мира каждый кадр берётся из `getBoundingClientRect` слоя — так эффекты идут и за жестами,
 * и за анимацией перелёта камеры. Телефон — облегчённый вариант; reduced motion — без дрейфа, пульса и параллакса.
 */
export function MapAtmosphere({ layerRef, activeId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const active = useRef(activeId);
  const dirty = useRef(true);

  useEffect(() => {
    active.current = activeId;
    dirty.current = true;
  }, [activeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const lite = matches(MOBILE_QUERY);
    const reduced = prefersReducedMotion();
    const res = lite ? RESOLUTION.lite : RESOLUTION.full;
    const clouds = cloudsFor(lite);
    const cloud = cloudSprite(token('--atmo-cloud', 'rgb(170 182 200 / 0.85)'), token('--atmo-cloud-shade', 'rgb(30 40 56 / 0.5)'));
    const sprites = Object.fromEntries(
      (Object.keys(PATCH_TOKEN) as PatchKind[]).map((k) => [
        k,
        patchSprite(token(PATCH_TOKEN[k], 'rgb(160 170 186 / 0.5)'), k === 'star' || k === 'lava'),
      ]),
    ) as Record<PatchKind, HTMLCanvasElement | null>;
    const breathe = (cssDuration('--dur-breathe') || 3200) / 1000;

    let box: Box = { width: 0, height: 0 };
    const resize = () => {
      box = { width: canvas.clientWidth, height: canvas.clientHeight };
      canvas.width = Math.max(1, Math.round(box.width * res));
      canvas.height = Math.max(1, Math.round(box.height * res));
      dirty.current = true;
    };
    resize();

    let lastKey = '';
    let lastGrain = -1;
    let skip = 0;
    let frame = 0;
    const t0 = performance.now();

    const draw = (rect: WorldRect, homeSize: number, t: number) => {
      const zoom = zoomOf(rect, homeSize);
      const s = strength(zoom, active.current !== undefined);
      ctx.setTransform(res, 0, 0, res, 0, 0);
      ctx.clearRect(0, 0, box.width, box.height);

      // Туман и дымка лежат на земле: двигаются ровно с картой, медленно колышутся.
      ctx.globalCompositeOperation = 'source-over';
      FOG_PATCHES.forEach((p, i) => {
        const sprite = sprites[p.kind];
        const x = rect.left + (p.x + drift(1, t, i) * 0.6) * rect.size;
        const y = rect.top + p.y * rect.size;
        const rx = p.rx * rect.size;
        const ry = p.ry * rect.size;
        if (!sprite || !visible(x, y, rx, ry, box)) return;
        const own = p.region !== undefined && p.region === active.current ? 0.35 : 1;
        ctx.globalAlpha = s.fog * PATCH_ALPHA[p.kind] * own * (reduced ? 1 : pulse(t, 20, i));
        ctx.drawImage(sprite, x - rx, y - ry, rx * 2, ry * 2);
      });

      // Свечение ярусов складывается со светом картинки (блум).
      ctx.globalCompositeOperation = 'lighter';
      GLOWS.forEach((p, i) => {
        const sprite = sprites[p.kind];
        const x = rect.left + p.x * rect.size;
        const y = rect.top + p.y * rect.size;
        const rx = p.rx * rect.size;
        const ry = p.ry * rect.size;
        if (!sprite || !visible(x, y, rx, ry, box)) return;
        ctx.globalAlpha = s.glow * PATCH_ALPHA[p.kind] * (reduced ? 1 : pulse(t, breathe * (p.kind === 'star' ? 1.6 : 1), i));
        ctx.drawImage(sprite, x - rx, y - ry, rx * 2, ry * 2);
      });

      // Облака над картой: дальние первыми, ближние поверх.
      ctx.globalCompositeOperation = 'source-over';
      if (cloud) {
        for (const depth of [1, 2, 3] as const) {
          clouds.forEach((c, i) => {
            if (c.depth !== depth) return;
            const dx = reduced ? 0 : drift(depth, t, i * 1.7);
            const p = reduced
              ? { x: rect.left + c.x * rect.size, y: rect.top + c.y * rect.size, scale: rect.size }
              : project(c.x + dx, c.y, depth, rect, box, homeSize);
            const w = c.w * p.scale;
            const h = w / CLOUD_ASPECT;
            if (!visible(p.x, p.y, w / 2, h / 2, box)) return;
            const alpha = s.clouds * DEPTH_ALPHA[depth] * sizeFade(w, box);
            if (alpha <= 0.01) return;
            ctx.globalAlpha = alpha;
            if (i % 2) {
              // Каждое второе облако зеркально: один спрайт не повторяется строем.
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.scale(-1, 1);
              ctx.drawImage(cloud, -w / 2, -h / 2, w, h);
              ctx.restore();
            } else {
              ctx.drawImage(cloud, p.x - w / 2, p.y - h / 2, w, h);
            }
          });
        }
      }
      ctx.globalAlpha = 1;

      const grain = Math.round(s.grain * 20) / 20;
      if (grain !== lastGrain) {
        lastGrain = grain;
        grainRef.current?.style.setProperty('--grain', String(grain));
      }
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const layer = layerRef.current;
      if (!layer || box.width === 0) return;
      const lr = layer.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      const rect: WorldRect = { left: lr.left - cr.left, top: lr.top - cr.top, size: lr.width };
      const key = `${Math.round(rect.left * 2)}|${Math.round(rect.top * 2)}|${Math.round(rect.size * 2)}`;
      const moved = key !== lastKey || dirty.current;
      lastKey = key;
      dirty.current = false;
      // Без движения перерисовываем, только когда сдвинулась камера; на телефоне дрейф — 30 кадров в секунду.
      if (!moved && (reduced || (lite && skip++ % 2))) return;
      draw(rect, layer.offsetWidth, reduced ? 0 : (now - t0) / 1000);
    };
    const start = () => {
      if (frame || document.hidden) return;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener('visibilitychange', onVisibility);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, [layerRef]);

  return (
    <div className={styles.atmosphere} aria-hidden="true" data-testid="map-atmosphere">
      <canvas ref={canvasRef} className={styles.canvas} />
      <div ref={grainRef} className={styles.grain} />
    </div>
  );
}
