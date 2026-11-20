import { useEffect, type RefObject } from 'react';
import { dofAt, perspectiveOf, tiltAt, uprightOf, type DepthFlags } from './depth';

/** Приближение слоя карты сейчас — из вычисленного transform (идёт и за жестами, и за WAAPI-перелётом). */
function zoomOf(layer: HTMLElement): number {
  const m = getComputedStyle(layer).transform;
  const match = /^matrix\(([^,]+),\s*([^,]+)/.exec(m);
  if (!match) return 1;
  return Math.hypot(Number(match[1]), Number(match[2])) || 1;
}

/**
 * Прототипы #197 «наклон» и «глубина резкости»: раз в кадр берёт приближение слоя карты и пишет
 * `perspective() rotateX()` обёртке слоёв (`tiltRef`), `--upright` (подписи лицом к зрителю) и `--dof` (сила размытия краёв).
 * Пишет только при изменении; без флагов цикла нет.
 */
export function useDepth(
  flags: DepthFlags,
  refs: { viewportRef: RefObject<HTMLElement | null>; layerRef: RefObject<HTMLElement | null>; tiltRef: RefObject<HTMLElement | null> },
) {
  const { tilt, dof } = flags;
  const { viewportRef, layerRef, tiltRef } = refs;
  useEffect(() => {
    if (!tilt && !dof) return;
    let frame = 0;
    let last = '';
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const viewport = viewportRef.current;
      const layer = layerRef.current;
      const wrap = tiltRef.current;
      if (!viewport || !layer || !wrap) return;
      const zoom = zoomOf(layer);
      const deg = tilt ? Math.round(tiltAt(zoom) * 10) / 10 : 0;
      const d = dof ? Math.round(dofAt(zoom) * 50) / 50 : 0;
      const p = perspectiveOf(viewport.clientWidth, viewport.clientHeight);
      const key = `${deg}|${d}|${p}`;
      if (key === last) return;
      last = key;
      wrap.style.transform = deg > 0 ? `perspective(${p}px) rotateX(${deg}deg)` : '';
      wrap.style.setProperty('--upright', uprightOf(deg).toFixed(4));
      wrap.style.setProperty('--dof', String(d));
      wrap.toggleAttribute('data-dof-on', d > 0);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [tilt, dof, viewportRef, layerRef, tiltRef]);
}
