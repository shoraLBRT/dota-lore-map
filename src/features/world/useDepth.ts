import { useEffect, type RefObject } from 'react';
import { prefersReducedMotion } from './camera';
import { dofAt, perspectiveOf, tiltAt, tiltPoint, tiltTransform } from './depth';

const SCALE = /scale\(([\d.e-]+)\)/;
const MATRIX = /^matrix\(([^,]+),\s*([^,]+)/;

/**
 * Приближение слоя карты сейчас. Жесты свободной камеры пишут inline `transform` — его и читаем (без пересчёта стиля);
 * только пока идёт WAAPI-перелёт, приближение берётся из вычисленного transform.
 */
function zoomOf(layer: HTMLElement, flying: boolean): number {
  if (!flying) {
    const m = SCALE.exec(layer.style.transform);
    if (m) return Number(m[1]) || 1;
  }
  const m = MATRIX.exec(getComputedStyle(layer).transform);
  if (!m) return 1;
  return Math.hypot(Number(m[1]), Number(m[2])) || 1;
}

/** Сколько кадров подряд без изменений, после которых цикл засыпает (камера встала). */
export const STILL_FRAMES = 8;

/** Группы названий и маркеров экранного слоя: `translate(якорь) scale(k)`, без вложенных (значки медиа). */
const ANCHORED = "g[transform^='translate']:not(g[transform^='translate'] g)";
const TRANSLATE = /^translate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)/;

/**
 * Якоря подписей и маркеров плоского экранного слоя — туда, куда наклон унёс их точку на карте
 * (CSS-свойство `translate` поверх атрибута `transform`, который пишут React, `placeAnchors` и `WorldMarkers`).
 */
function placeAnchors(svg: SVGSVGElement, viewport: DOMRect, deg: number, p: number) {
  const ctm = svg.getScreenCTM?.();
  if (!ctm) return;
  const inv = ctm.inverse();
  const cx = viewport.left + viewport.width / 2;
  const cy = viewport.top + viewport.height / 2;
  for (const el of svg.querySelectorAll<SVGGElement>(ANCHORED)) {
    const m = TRANSLATE.exec(el.getAttribute('transform') ?? '');
    if (!m) continue;
    const x = Number(m[1]);
    const y = Number(m[2]);
    const sx = ctm.a * x + ctm.c * y + ctm.e;
    const sy = ctm.b * x + ctm.d * y + ctm.f;
    const [tx, ty] = tiltPoint(sx, sy, cx, cy, deg, p);
    const nx = inv.a * tx + inv.c * ty + inv.e;
    const ny = inv.b * tx + inv.d * ty + inv.f;
    el.style.translate = `${(nx - x).toFixed(2)}px ${(ny - y).toFixed(2)}px`;
  }
}

function clearAnchors(svg: SVGSVGElement) {
  for (const el of svg.querySelectorAll<SVGGElement>(ANCHORED)) el.style.translate = '';
}

/**
 * Объём карты (#232, #233, SPEC §8.5): по приближению слоя карты ставит `--dof` (сила размытия краёв) полосам `dofRef`,
 * пишет наклон `perspective() rotateX()` обёрткам `tiltRefs` (слой карты и частицы региона) и переносит якоря подписей
 * плоского экранного слоя (`screenSvgRef`) в точки наклонённой карты. Reduced motion — без наклона.
 *
 * Камеру двигают жесты (inline `transform` слоя в кадре rAF) и перелёт (WAAPI). Смену стиля слоя ловит
 * MutationObserver и сразу, в том же кадре, ставит наклон и якоря — иначе наклон отставал бы от зума на кадр,
 * и точка под курсором дрожала бы. Перелёт и инерцию ведёт свой цикл rAF; камера встала — цикл засыпает.
 */
export function useDepth(refs: {
  viewportRef: RefObject<HTMLElement | null>;
  layerRef: RefObject<HTMLElement | null>;
  tiltRefs: readonly RefObject<HTMLElement | null>[];
  dofRef: RefObject<HTMLElement | null>;
  screenSvgRef: RefObject<SVGSVGElement | null>;
}) {
  const { viewportRef, layerRef, tiltRefs, dofRef, screenSvgRef } = refs;
  useEffect(() => {
    let frame = 0;
    let last = '';
    let tilted = false;
    let still = 0;
    let lastMatrix = '';
    const update = () => {
      const viewport = viewportRef.current;
      const layer = layerRef.current;
      const svg = screenSvgRef.current;
      if (!viewport || !layer) return false;
      const before = last;
      const flying = (layer.getAnimations?.().length ?? 0) > 0;
      const zoom = zoomOf(layer, flying);
      const matrix = flying ? `fly ${zoom}` : layer.style.transform;
      const deg = tiltAt(zoom, prefersReducedMotion());
      const d = Math.round(dofAt(zoom) * 50) / 50;
      const p = perspectiveOf(viewport.clientWidth, viewport.clientHeight);
      const key = `${deg}|${d}|${p}`;
      if (key !== before) {
        last = key;
        const transform = tiltTransform({ deg, p });
        for (const ref of tiltRefs) if (ref.current) ref.current.style.transform = transform;
        const edge = dofRef.current;
        if (edge) {
          edge.style.setProperty('--dof', String(d));
          edge.toggleAttribute('data-on', d > 0);
        }
      }
      // Подписи сдвигаем каждый кадр, пока карта наклонена: камера двигает их и без смены наклона.
      if (svg && deg > 0) placeAnchors(svg, viewport.getBoundingClientRect(), deg, p);
      else if (svg && tilted) clearAnchors(svg);
      tilted = deg > 0;
      const moving = key !== before || matrix !== lastMatrix || flying;
      lastMatrix = matrix;
      return moving;
    };
    const tick = () => {
      frame = 0;
      still = update() ? 0 : still + 1;
      // Кадры идут, пока камера движется; после STILL_FRAMES неподвижных кадров и без перелёта цикл засыпает.
      if (still < STILL_FRAMES) frame = requestAnimationFrame(tick);
    };
    // Камеру двигают жесты, колесо, клавиши и перелёт (смена `style` слоя): любое из них будит цикл.
    const wake = () => {
      still = 0;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    // Жест записал камеру — наклон и якоря в том же кадре, до отрисовки.
    const now = () => {
      update();
      wake();
    };
    const viewport = viewportRef.current;
    const layer = layerRef.current;
    const events = ['wheel', 'pointerdown', 'pointermove', 'keydown', 'touchstart'] as const;
    for (const e of events) viewport?.addEventListener(e, wake, { passive: true, capture: true });
    const mo = new MutationObserver(now);
    if (layer) mo.observe(layer, { attributes: true, attributeFilter: ['style'] });
    now();
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      for (const e of events) viewport?.removeEventListener(e, wake, { capture: true });
    };
  }, [viewportRef, layerRef, tiltRefs, dofRef, screenSvgRef]);
}
