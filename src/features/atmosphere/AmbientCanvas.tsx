import { useEffect, useRef } from 'react';
import type { Ambient } from '../../data/types';
import { prefersReducedMotion } from '../world/camera';
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

/**
 * Частицы региона на canvas поверх карты (SPEC §7.3), только в S2/S3. Тип и плотность — `ambient` из данных.
 * Не рисуется при prefers-reduced-motion; на скрытой вкладке цикл стоит.
 */
export function AmbientCanvas({ ambient }: { ambient: Ambient | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kind = ambientKind(ambient);
  const density = ambient?.density ?? 0.5;
  const reduced = prefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !kind) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue(COLOR_TOKEN[kind]).trim() || '#fff';
    const sprite = kind === 'fog' ? fogSprite(color) : null;
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const n = particleCount(kind, density, w, h);
      particles = particles.slice(0, n);
      while (particles.length < n) particles.push(spawn(kind, w, h));
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
      for (const p of particles) step(p, kind, dt, t, w, h);
      ctx.clearRect(0, 0, w, h);
      draw(ctx, kind, particles, t, sprite);
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame || document.hidden) return;
      last = performance.now();
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
  }, [kind, density]);

  if (!kind || reduced) return null;
  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" data-ambient={kind} />;
}
