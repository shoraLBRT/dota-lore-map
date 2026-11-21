import { useEffect, type RefObject } from 'react';
import { dofAt, perspectiveOf, tiltAt, tiltPoint, type DepthFlags } from './depth';

/** Приближение слоя карты сейчас — из вычисленного transform (идёт и за жестами, и за WAAPI-перелётом). */
function zoomOf(layer: HTMLElement): number {
  const m = getComputedStyle(layer).transform;
  const match = /^matrix\(([^,]+),\s*([^,]+)/.exec(m);
  if (!match) return 1;
  return Math.hypot(Number(match[1]), Number(match[2])) || 1;
}

/** Группы названий и маркеров экранного слоя: `translate(якорь) scale(k)`, без вложенных (значки медиа). */
const ANCHORED = "g[transform^='translate']:not(g[transform^='translate'] g)";
const TRANSLATE = /^translate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)/;

/**
 * Якоря подписей и маркеров плоского экранного слоя — туда, куда наклон унёс их точку на карте
 * (CSS-свойство `translate` поверх атрибута `transform`, который пишут React и `WorldMarkers`).
 */
function placeAnchors(svg: SVGSVGElement, viewport: DOMRect, deg: number, p: number) {
  const ctm = svg.getScreenCTM();
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
 * Раз в кадр берёт приближение слоя карты и ставит `--dof` (сила размытия краёв, #233) полосам `dofRef`;
 * с флагом прототипа #197 «наклон» ещё пишет `perspective() rotateX()` обёртке слоя карты (`tiltRef`) и переносит
 * якоря подписей плоского экранного слоя (`screenSvgRef`) в точки наклонённой карты.
 */
export function useDepth(
  flags: DepthFlags,
  refs: {
    viewportRef: RefObject<HTMLElement | null>;
    layerRef: RefObject<HTMLElement | null>;
    tiltRef: RefObject<HTMLElement | null>;
    dofRef: RefObject<HTMLElement | null>;
    screenSvgRef: RefObject<SVGSVGElement | null>;
  },
) {
  const { tilt } = flags;
  const { viewportRef, layerRef, tiltRef, dofRef, screenSvgRef } = refs;
  useEffect(() => {
    let frame = 0;
    let last = '';
    let tilted = false;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const viewport = viewportRef.current;
      const layer = layerRef.current;
      const wrap = tiltRef.current;
      const edge = dofRef.current;
      const svg = screenSvgRef.current;
      if (!viewport || !layer) return;
      const zoom = zoomOf(layer);
      const deg = tilt ? Math.round(tiltAt(zoom) * 10) / 10 : 0;
      const d = Math.round(dofAt(zoom) * 50) / 50;
      const p = tilt ? perspectiveOf(viewport.clientWidth, viewport.clientHeight) : 0;
      // Подписи сдвигаем каждый кадр, пока карта наклонена: камера двигает их и без смены наклона.
      if (svg && deg > 0) placeAnchors(svg, viewport.getBoundingClientRect(), deg, p);
      else if (svg && tilted) clearAnchors(svg);
      tilted = deg > 0;
      const key = `${deg}|${d}|${p}`;
      if (key === last) return;
      last = key;
      if (wrap) wrap.style.transform = deg > 0 ? `perspective(${p}px) rotateX(${deg}deg)` : '';
      if (edge) {
        edge.style.setProperty('--dof', String(d));
        edge.toggleAttribute('data-on', d > 0);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [tilt, viewportRef, layerRef, tiltRef, dofRef, screenSvgRef]);
}
