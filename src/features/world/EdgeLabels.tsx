import { useMemo } from 'react';
import type { Point, Region } from '../../data/types';
import { getRegion } from '../../data/world';
import { useT } from '../../i18n';
import { spotName, type Spot } from '../search/search';
import type { HeroThreads } from '../search/threads';
import styles from './EdgeLabels.module.css';
import { placeEdgeLabels, type EdgeLabel } from './labels';
import { arc, edgeExit, rayExit, toScreen, visibleFrame } from './threadGeometry';
import tones from './tones.module.css';
import type { Frame } from './useCamera';
import { useMeasuredBoxes } from './useMeasuredLabels';
import { EXIT_LABEL_MARGIN } from './useThreadLayout';

/** Отступ меток «нить за краем» от края кадра, px. */
const EXIT_MARGIN = 28;

/** Размер метки «нить за краем» без измерений (jsdom): кегль 0.8rem, стрелка, отступы, одна или две строки. */
function estimateExit(name: string, region: string | undefined): [number, number] {
  const chars = Math.max(name.length, region?.length ?? 0);
  return [Math.min(chars * 7.5 + 40, 224), region ? 44 : 28];
}

interface Props {
  /** Открытый регион; в мире меток нет. */
  active: Region | undefined;
  threads: HeroThreads | undefined;
  threadsKey: string | undefined;
  /** Места героя под наведением (#66): место за кадром без нити к нему — тоже метка. */
  preview: Spot[] | undefined;
  frame: Frame;
  /** Низ плашки героя над кадром, px. */
  coverTop: number;
  /** Счётчик загрузки шрифтов: после него метки меряются заново. */
  fontsTick: number;
  onSelectSpot?: (spot: Spot) => void;
}

/**
 * Метки «нить за краем» (S2/S3, SPEC §6.6, ARCHITECTURE A11): нить к месту за краем кадра уходит туда
 * со стрелкой и названием. Метки целиком в видимой части кадра и не друг на друге (#64).
 */
export function EdgeLabels({
  active,
  threads,
  threadsKey,
  preview,
  frame: { view, framed, inset, insetBottom },
  coverTop,
  fontsTick,
  onSelectSpot,
}: Props) {
  const { lang } = useT();

  const exits = useMemo(() => {
    const steps = threads?.steps ?? [];
    if (!active || view.width <= 0 || (steps.length === 0 && !preview?.length)) return [];
    const project = (p: Point) => toScreen(p, framed.camera, framed.offset, view, framed.offsetY);
    const frame = visibleFrame(view, inset, EXIT_MARGIN, insetBottom);
    const visible = (p: Point) => {
      const [x, y] = project(p);
      return x >= frame.left && x <= frame.right && y >= frame.top && y <= frame.bottom;
    };
    const out = new Map<string, { spot: Spot; x: number; y: number; angle: number }>();
    for (const { from: a, to: b } of steps) {
      const aSeen = visible(a.point!);
      const bSeen = visible(b.point!);
      if (aSeen === bSeen) continue;
      const exit = edgeExit(arc(a.point!, b.point!), aSeen, project, frame);
      const target = aSeen ? b : a;
      if (exit && !out.has(target.key)) out.set(target.key, { spot: target, ...exit });
    }
    // Герой под наведением (#66): его место за кадром без нити к нему — метка по лучу из центра кадра.
    // Сам открытый регион (связь без места) меткой не отмечается.
    for (const s of preview ?? []) {
      if (!s.point || out.has(s.key) || (!s.placeSlug && s.regionId === active.id)) continue;
      const exit = rayExit(project(s.point), frame);
      if (exit) out.set(s.key, { spot: s, ...exit });
    }
    return [...out.values()].map((e) => {
      // Место в другом регионе — второй строкой регион (#64): «Мрачное Гнездовье / Небеса».
      // Регион не повторяется, если место называется так же («Друуд» в Друуде).
      const name = spotName(e.spot, lang);
      const other = e.spot.placeSlug && e.spot.regionId !== active.id ? getRegion(e.spot.regionId)?.name[lang] : undefined;
      return { ...e, name, region: other && other !== name ? other : undefined };
    });
  }, [threads, preview, active, framed, view, inset, insetBottom, lang]);

  // Размеры — измеренные.
  const [exitSizes, exitRefs] = useMeasuredBoxes(`${lang}|${fontsTick}|${exits.map((e) => e.spot.key).join(',')}`);
  const exitAt = useMemo(() => {
    const items: EdgeLabel[] = exits.map((e) => {
      const [w, h] = estimateExit(e.name, e.region);
      return { key: e.spot.key, x: e.x, y: e.y, width: exitSizes[`w:${e.spot.key}`] ?? w, height: exitSizes[`h:${e.spot.key}`] ?? h };
    });
    const frame = visibleFrame(view, inset, EXIT_LABEL_MARGIN, insetBottom);
    // Плашка героя или поиск сверху кадра (z-index выше меток): метки встают под неё.
    if (coverTop > 0) frame.top = Math.max(frame.top, coverTop + EXIT_LABEL_MARGIN);
    return placeEdgeLabels(items, frame);
  }, [exits, exitSizes, view, inset, insetBottom, coverTop]);

  return exits.map((e) => {
    const at = exitAt.get(e.spot.key);
    return (
      <button
        key={`${threadsKey ?? ''}/${e.spot.key}`}
        ref={(el) => {
          if (el) exitRefs.current.set(e.spot.key, el);
          else exitRefs.current.delete(e.spot.key);
        }}
        type="button"
        className={[styles.exit, tones[e.spot.tone]].join(' ')}
        style={at ? { left: `${at.left.toFixed(1)}px`, top: `${at.top.toFixed(1)}px` } : undefined}
        onClick={(ev) => {
          ev.stopPropagation();
          onSelectSpot?.(e.spot);
        }}
      >
        <span className={styles.exitArrow} style={{ transform: `rotate(${e.angle.toFixed(1)}deg)` }} aria-hidden="true">
          ➜
        </span>
        <span className={styles.exitText}>
          <span className={styles.exitName}>{e.name}</span>
          {e.region && <span className={styles.exitRegion}>{e.region}</span>}
        </span>
      </button>
    );
  });
}
