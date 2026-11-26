// Названия регионов по уровням (#189, #251, SPEC §8.6): какого размера и с какой стороны от герба; видны все.
// Чистые правила — в labels.ts; здесь — сборка из данных и кадра и хук для MapStage.

import { useMemo } from 'react';
import type { Lang, Region } from '../../data/types';
import { heroesOfRegion } from '../../data/world';
import {
  crestBox,
  nameBox,
  labelMetrics,
  placeRegionLabels,
  regionLevels,
  splitLabel,
  type LabelLevel,
  type LabelMetrics,
  type RegionLabelItem,
  type RegionLabelSpot,
} from './labels';

/** Средняя ширина знака названия (капители Cormorant SC 700 с разрядкой 0.08em) в кеглях — пока подписи не измерены. */
export const NAME_CHAR_EM = 0.8;

/** Вес региона для уровня названия (#189): его герои и места. */
export const regionWeight = (r: Region) => heroesOfRegion(r.id).length + r.places.length;

/** Уровни названий всех регионов (#189). */
export function levelsOf(regions: Region[], weight: (r: Region) => number = regionWeight) {
  return regionLevels(regions, weight);
}

/** Строки названия: длинное название континента — в две строки, ярусы — одной. */
export const nameLines = (r: Region, name: string) => (r.tier === 'continent' ? splitLabel(name) : [name]);

export interface NameOptions {
  name: (r: Region) => string;
  levels: Map<string, LabelLevel>;
  /** Измеренные ширины строк (`r:id`, px при кегле своего уровня). */
  widths: Record<string, number>;
  /** Мир, вписанный в кадр, px: от него размеры (`labelMetrics`). */
  fitted: number;
  /** Вес региона: внутри уровня тяжёлые ставятся первыми. */
  weight?: (r: Region) => number;
}

/** Названия для расстановки: первый уровень — первым (ему лучшие стороны), внутри — по весу, при равенстве — по порядку данных. */
export function regionLabelItems(drawn: Region[], { name, levels, widths, fitted, weight = regionWeight }: NameOptions): RegionLabelItem[] {
  return drawn
    .map((r, i) => {
      const level = levels.get(r.id) ?? 2;
      const metrics = labelMetrics(level, fitted);
      const lines = nameLines(r, name(r));
      const longest = Math.max(...lines.map((s) => s.length));
      const [x, y] = r.layout!.label;
      return {
        level,
        w: weight(r),
        i,
        item: {
          id: r.id,
          x,
          y,
          width: widths[`r:${r.id}`] ?? longest * metrics.font * NAME_CHAR_EM,
          lines: lines.length,
          metrics,
          minor: level > 1,
        },
      };
    })
    .sort((a, b) => a.level - b.level || b.w - a.w || a.i - b.i)
    .map((x) => x.item);
}

export interface RegionNames {
  levels: Map<string, LabelLevel>;
  metrics: Map<string, LabelMetrics>;
  spots: Map<string, RegionLabelSpot>;
  items: RegionLabelItem[];
}

const unplaced = (m: RegionLabelItem): RegionLabelSpot => ({ side: 'bottom', metrics: m.metrics, box: nameBox('bottom', m), crest: crestBox(m.metrics.crest) });

/**
 * Уровни, размеры и стороны названий регионов на кадр (#189, #251). `metrics` — полные размеры уровня (по ним
 * меряются ширины), `spots[id].metrics` — с которыми название встало. `world` — размер мира в px при zoom 1 (слой карты),
 * `zoomFrom` — самое дальнее приближение мира в кадре, `zoomMax` — потолок мира. Пересчёт — при смене кадра, языка и измерений, не на каждый кадр зума.
 */
export function useRegionNames(
  drawn: Region[],
  opts: { lang: Lang; name: (r: Region) => string; widths: Record<string, number>; fitted: number; zoomFrom: number; zoomMax: number; world: { width: number; height: number } },
): RegionNames {
  const { lang, name, widths, fitted, zoomFrom, zoomMax, world } = opts;
  const levels = useMemo(() => levelsOf(drawn), [drawn]);
  const w = world.width;
  const h = world.height;
  return useMemo(() => {
    const items = regionLabelItems(drawn, { name, levels, widths, fitted });
    // Кадр не измерен (jsdom, до первого замера): тесноту не узнать — все названия под гербом.
    const spots =
      w > 0 && h > 0
        ? placeRegionLabels(items, { width: w, height: h }, zoomFrom, zoomMax)
        : new Map(items.map((m) => [m.id, unplaced(m)]));
    return { levels, items, spots, metrics: new Map(items.map((m) => [m.id, m.metrics])) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `name` зависит только от языка
  }, [drawn, levels, widths, fitted, zoomFrom, zoomMax, w, h, lang]);
}
