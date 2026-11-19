import { useMemo } from 'react';
import type { Region } from '../../data/types';
import type { HeroThreads } from '../search/threads';
import { labelBox, type Box, type LabelSide, type MarkerLabel } from './labels';
import type { RegionNames } from './regionLabelLayout';
import { toStage } from './stage';
import { toScreen, visibleFrame } from './threadGeometry';
import type { Frame } from './useCamera';

/** Отступ значков нитей и меток «нить за краем» от края видимой части кадра, px (#64). */
export const EXIT_LABEL_MARGIN = 8;

interface Options {
  threads: HeroThreads | undefined;
  active: Region | undefined;
  drawn: Region[];
  /** Подписи маркеров и их стороны (markerLayout.ts). */
  labels: { items: MarkerLabel[]; sides: Map<string, LabelSide> };
  /** Названия регионов мира: рамки названий и гербов (#189). */
  names: RegionNames;
  frame: Frame;
  /** Низ плашки героя над кадром, px. */
  coverTop: number;
  /** Мир со списком регионов (телефон): значки не ограничиваются кадром. */
  listed: boolean;
}

/**
 * Где на нитях можно ставить значки событий (#67, ARCHITECTURE A11): `obstacles` — подписи, на которые
 * они не встают (в мире — названия регионов, в регионе — кольца и подписи маркеров), `clip` — видимая
 * часть кадра. Всё в координатах сцены.
 */
export function useThreadLayout({
  threads,
  active,
  drawn,
  labels: { items: labelItems, sides },
  names,
  frame,
  coverTop,
  listed,
}: Options) {
  const { markerScale, threadScale, view, framed, cover, insetBottom } = frame;
  const obstacles = useMemo<Box[]>(() => {
    if (!threads) return [];
    if (active) {
      const k = markerScale;
      const scaled = (b: Box, x: number, y: number): Box => ({
        left: (b.left + x) * k,
        right: (b.right + x) * k,
        top: (b.top + y) * k,
        bottom: (b.bottom + y) * k,
      });
      return labelItems.flatMap((m) => {
        const ring = scaled({ left: -m.ring, right: m.ring, top: -m.ring, bottom: m.ring }, m.x, m.y);
        const side = sides.get(m.key);
        return side && side !== 'hidden' ? [ring, scaled(labelBox(side, m), m.x, m.y)] : [ring];
      });
    }
    // Мир: видимые названия регионов и их гербы — рамки в px экрана от точки названия, в единицах сцены.
    const k = frame.pxScale;
    return drawn.flatMap((r) => {
      const spot = names.spots.get(r.id);
      if (!spot || frame.worldZoom < spot.from - 1e-6) return [];
      const [lx, ly] = toStage(r.layout!.label);
      return [spot.box, ...(spot.crest ? [spot.crest] : [])].map((b) => ({
        left: lx + b.left * k,
        right: lx + b.right * k,
        top: ly + b.top * k,
        bottom: ly + b.bottom * k,
      }));
    });
  }, [threads, active, labelItems, sides, markerScale, drawn, names, frame.pxScale, frame.worldZoom]);
  // Видимая часть кадра в координатах сцены (левее панели, выше шторки, ниже плашки героя): значки — только в ней.
  const clip = useMemo<Box | undefined>(() => {
    if (!threads || view.width <= 0 || listed) return undefined;
    const frame = visibleFrame(view, cover, EXIT_LABEL_MARGIN, insetBottom);
    if (coverTop > 0) frame.top = Math.max(frame.top, coverTop + EXIT_LABEL_MARGIN);
    const [ox, oy] = toScreen([0, 0], framed.camera, framed.offset, view, framed.offsetY);
    const k = threadScale;
    return { left: (frame.left - ox) * k, right: (frame.right - ox) * k, top: (frame.top - oy) * k, bottom: (frame.bottom - oy) * k };
  }, [threads, view, cover, insetBottom, coverTop, framed, threadScale, listed]);
  return { obstacles, clip };
}
