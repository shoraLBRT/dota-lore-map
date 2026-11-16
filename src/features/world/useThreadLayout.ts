import { useMemo } from 'react';
import type { Region } from '../../data/types';
import { useT } from '../../i18n';
import type { HeroThreads } from '../search/threads';
import { clampLabelX, labelBox, splitLabel, type Box, type LabelSide, type MarkerLabel } from './labels';
import { toStage } from './stage';
import { toScreen, visibleFrame } from './threadGeometry';
import type { Frame } from './useCamera';

/** Отступ значков нитей и меток «нить за краем» от края видимой части кадра, px (#64). */
export const EXIT_LABEL_MARGIN = 8;

/** Кегль названия региона на карте, единицы сцены (.label в RegionsLayer.module.css). */
const REGION_FONT = 22;

interface Options {
  threads: HeroThreads | undefined;
  active: Region | undefined;
  drawn: Region[];
  /** Подписи маркеров и их стороны (markerLayout.ts). */
  labels: { items: MarkerLabel[]; sides: Map<string, LabelSide> };
  widths: Record<string, number>;
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
  widths,
  frame,
  coverTop,
  listed,
}: Options) {
  const { l } = useT();
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
    return drawn.map((r) => {
      const [lx, ly] = toStage(r.layout!.label);
      const name = l(r.name);
      const lines = r.tier === 'continent' ? splitLabel(name).length : 1;
      const width = widths[`r:${r.id}`] ?? (lines === 1 ? name.length : Math.ceil(name.length / 2)) * REGION_FONT * 0.7;
      const x = widths[`r:${r.id}`] ? clampLabelX(lx, width) : lx;
      // Одна строка — по базовой линии; две — первая на 0.45em выше, вторая на 1.05em ниже неё (см. разметку подписи).
      const top = ly - (lines === 1 ? 0.8 : 1.25) * REGION_FONT;
      const bottom = ly + (lines === 1 ? 0.2 : 0.8) * REGION_FONT;
      return { left: x - width / 2, right: x + width / 2, top, bottom };
    });
  }, [threads, active, labelItems, sides, markerScale, drawn, widths, l]);
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
