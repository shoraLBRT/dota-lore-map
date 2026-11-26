import { useEffect, useRef, type RefObject } from 'react';
import type { Ambient, Point } from '../../data/types';
import { polygonBox, prefersReducedMotion, STAGE_WIDTH } from '../world/camera';
import { flatRect } from '../world/depth';
import { smoothPath } from '../world/stage';
import styles from './AmbientCanvas.module.css';
import { particleCount, spawn, step, twinkle, type Kind, type Particle } from './particles';

/** Цвет частиц — токен из tokens.css (ARCHITECTURE A8). */
const COLOR_TOKEN: Record<Kind, string> = {
  snow: '--particle-snow',
  ash: '--particle-ash',
  embers: '--particle-ember',
  fog: '--particle-fog',
  rain: '--particle-rain',
  sparkles: '--particle-spark',
  stars: '--particle-star',
  leaves: '--particle-leaf',
  sand: '--particle-sand',
};

/** Канвас не нужен: нет частиц у региона или пользователь просит меньше движения (SPEC §7.1). */
export function ambientKind(ambient: Ambient | undefined): Kind | null {
  if (!ambient || ambient.type === 'none' || (ambient.density ?? 0.5) <= 0) return null;
  return ambient.type;
}

/** Пятно тумана рисуется заранее один раз: radial-gradient на каждом кадре дорог. */
function fogSprite(color: string): HTMLCanvasElement | null {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

function draw(ctx: CanvasRenderingContext2D, kind: Kind, ps: Particle[], t: number, sprite: HTMLCanvasElement | null) {
  for (const p of ps) {
    ctx.globalAlpha = kind === 'sparkles' || kind === 'stars' || kind === 'embers' ? p.alpha * twinkle(p, t) : p.alpha;
    switch (kind) {
      case 'fog':
        if (sprite) ctx.drawImage(sprite, p.x - p.size, p.y - p.size * 0.6, p.size * 2, p.size * 1.2);
        break;
      case 'rain': {
        const k = p.size / Math.hypot(p.vx, p.vy);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * k, p.y + p.vy * k);
        ctx.stroke();
        break;
      }
      case 'sand':
        ctx.fillRect(p.x, p.y, p.size * 4, p.size * 0.6);
        break;
      case 'leaves':
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.45, p.phase + t * 1.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'embers':
        // Ореол и ядро: свечение без дорогого shadowBlur.
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.6, 0, Math.PI * 2);
        ctx.globalAlpha *= 0.25;
        ctx.fill();
        ctx.globalAlpha *= 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      default:
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Регион на экране: где сейчас слой карты и форма региона в долях мира. */
export interface AmbientRegion {
  layerRef: RefObject<HTMLElement | null>;
  polygon: Point[];
}

/** Рамка габарита региона на холсте, px. */
interface Area {
  left: number;
  top: number;
  width: number;
  height: number;
  /** px холста на единицу сцены (STAGE_WIDTH). */
  k: number;
}

/**
 * Частицы региона на canvas поверх карты (SPEC §7.3), только в S2/S3. Тип и плотность — `ambient` из данных.
 * С `region` (#192) частицы живут только над регионом: летят в рамке его габарита на экране (она идёт за камерой),
 * обрезаны по его форме, а их число — от площади этой рамки. Без `region` — весь кадр.
 * Не рисуется при prefers-reduced-motion; на скрытой вкладке цикл стоит.
 */
export function AmbientCanvas({
  ambient,
  region,
  paused = false,
}: {
  ambient: Ambient | undefined;
  region?: AmbientRegion;
  /** Карту не видно (#255): цикл кадров стоит, как на скрытой вкладке. */
  paused?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  /** Пуск или остановка цикла по видимости вкладки и `paused` (ставит эффект холста). */
  const sync = useRef(() => {});
  useEffect(() => {
    pausedRef.current = paused;
    sync.current();
  }, [paused]);
  const kind = ambientKind(ambient);
  const density = ambient?.density ?? 0.5;
  const reduced = prefersReducedMotion();
  const layerRef = region?.layerRef;
  const polygon = region?.polygon;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !kind) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue(COLOR_TOKEN[kind]).trim() || '#fff';
    const sprite = kind === 'fog' ? fogSprite(color) : null;
    const box = polygon ? polygonBox(polygon) : null;
    const shape = polygon && typeof Path2D !== 'undefined' ? new Path2D(smoothPath(polygon)) : null;
    let dpr = 1;
    let cw = 0;
    let ch = 0;
    /** Область, где летят частицы: весь холст или рамка региона. */
    let area: Area = { left: 0, top: 0, width: 0, height: 0, k: 1 };
    let particles: Particle[] = [];

    const fill = () => {
      const n = particleCount(kind, density, area.width, area.height);
      particles = particles.slice(0, n);
      while (particles.length < n) particles.push(spawn(kind, area.width, area.height));
    };
    /**
     * Рамка региона на холсте сейчас; камера двигается — частицы растягиваются вместе с ней. Под наклоном (#232) холст
     * и слой карты наклонены одинаково: рамки — плоские (`flatRect`), а наклон рисунку даёт обёртка.
     */
    const follow = () => {
      const layer = layerRef?.current;
      if (!box || !layer) return;
      const lr = flatRect(layer);
      const cr = flatRect(canvas);
      const next: Area = {
        left: lr.left - cr.left + box.left * lr.width,
        top: lr.top - cr.top + box.top * lr.height,
        width: (box.right - box.left) * lr.width,
        height: (box.bottom - box.top) * lr.height,
        k: lr.width / STAGE_WIDTH,
      };
      if (next.width !== area.width || next.height !== area.height) {
        const sx = area.width > 0 ? next.width / area.width : 1;
        const sy = area.height > 0 ? next.height / area.height : 1;
        for (const p of particles) {
          p.x *= sx;
          p.y *= sy;
        }
        const was = area.width * area.height;
        area = next;
        // Число частиц — от площади региона на экране; пересчёт при заметной перемене, не каждый кадр.
        if (was <= 0 || Math.abs(next.width * next.height - was) / was > 0.15) fill();
      } else area = next;
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = canvas.clientWidth;
      ch = canvas.clientHeight;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      if (box) follow();
      else {
        area = { left: 0, top: 0, width: cw, height: ch, k: 1 };
        fill();
      }
    };
    resize();

    let frame = 0;
    let last = performance.now();
    let t = 0;
    const tick = (now: number) => {
      // Длинная пауза (вкладка в фоне) не должна телепортировать частицы.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      if (box) follow();
      for (const p of particles) step(p, kind, dt, t, area.width, area.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      if (shape) {
        // Маска по форме региона: путь в единицах сцены, переведённый в px холста.
        ctx.setTransform(dpr * area.k, 0, 0, dpr * area.k, dpr * (area.left - box!.left * STAGE_WIDTH * area.k), dpr * (area.top - box!.top * STAGE_WIDTH * area.k));
        ctx.clip(shape);
      }
      ctx.setTransform(dpr, 0, 0, dpr, dpr * area.left, dpr * area.top);
      draw(ctx, kind, particles, t, sprite);
      ctx.restore();
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame || document.hidden || pausedRef.current) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => (document.hidden || pausedRef.current ? stop() : start());
    sync.current = onVisibility;

    start();
    document.addEventListener('visibilitychange', onVisibility);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    return () => {
      stop();
      sync.current = () => {};
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, [kind, density, layerRef, polygon]);

  if (!kind || reduced) return null;
  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" data-ambient={kind} />;
}
