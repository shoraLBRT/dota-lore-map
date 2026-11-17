import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { cssPixels } from '../../app/motion';
import { useSfx } from '../../app/sound';
import type { Hero, Region } from '../../data/types';
import { preloadRegionArt } from './art';
import { focusAfter } from './focus';
import { regionMediaBadge } from './mediaBadge';
import { headingTo, type Anchor } from './RegionTooltip';

/** Задержка закрытия подсказки региона: успеть перевести мышь с региона на подсказку и обратно (#65), мс. */
export const TOOLTIP_CLOSE_DELAY = 200;

interface Point {
  x: number;
  y: number;
}

/** Правый край левой полосы (SPEC §6.1): подсказку левее не ставят (#101). */
const railRight = () => cssPixels('--rail-width');

interface Options {
  regions: Region[];
  /** Мир (S1): подсказка есть только в нём. */
  inWorld: boolean;
  svgRef: RefObject<SVGSVGElement | null>;
  heroesOf: (regionId: string) => Hero[];
  /** Есть галерея — в подсказке значок медиа. */
  withMedia: boolean;
}

/**
 * Подсказка региона в мире (ARCHITECTURE A4, #65): наведение и фокус на регионе показывают её,
 * мышь на ней и фокус в ней держат её открытой, Esc закрывает до ухода с региона.
 */
export function useRegionTooltip({ regions, inWorld, svgRef, heroesOf, withMedia }: Options) {
  const sfx = useSfx();
  const tooltipId = useId();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipFocusId, setTipFocusId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // #101: подсказка стоит рядом с регионом, путь к ней может идти через соседа. Сосед, на которого мышь зашла
  // по пути к подсказке, ждёт TOOLTIP_CLOSE_DELAY и перехватывает подсказку, только если мышь там и осталась.
  const lastPos = useRef<Point | null>(null);
  const pending = useRef<{ id: string; from: Point; timer: ReturnType<typeof setTimeout> } | null>(null);

  // S1h только в мире; фокус в подсказке важнее мыши (иначе фокус пропадёт вместе с ней), мышь — фокуса на регионе.
  const wantedId = inWorld ? (tipFocusId ?? hoverId ?? focusId) : null;
  const shownId = wantedId === dismissedId ? null : wantedId;
  const shown = useMemo(() => regions.find((r) => r.id === shownId && r.layout), [regions, shownId]);
  const heroes = useMemo(() => (shown ? heroesOf(shown.id) : []), [shown, heroesOf]);
  const media = useMemo(() => (shown && withMedia ? regionMediaBadge(shown) : null), [shown, withMedia]);

  const getAnchor = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !shown?.layout) return null;
    const rect = svg.getBoundingClientRect();
    const [x, y] = shown.layout.label;
    const anchor: Anchor = { x: rect.left + x * rect.width, y: rect.top + y * rect.height, minLeft: railRight() };
    // #101: габарит полигона на экране — подсказка встанет рядом с регионом, а не на нём.
    const box = svg.querySelector(`[data-region="${shown.id}"]`)?.getBoundingClientRect();
    if (box && box.width > 0 && box.height > 0) anchor.box = { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    return anchor;
  }, [shown, svgRef]);

  const cancelClose = () => clearTimeout(closeTimer.current);
  const clearPending = () => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  };
  const switchTo = (r: Region) => {
    clearPending();
    setDismissedId((d) => (d === r.id ? null : d));
    setHoverId(r.id);
    sfx('hover');
  };
  const aimsAtTip = (from: Point, to: Point) => {
    const rect = tipRef.current?.getBoundingClientRect();
    return rect ? headingTo(from, to, rect) : false;
  };
  // Мышь свернула с пути к подсказке — сосед перехватывает её сразу.
  useEffect(() => {
    if (!inWorld) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const at = { x: e.clientX, y: e.clientY };
      const wait = pending.current;
      if (wait && !aimsAtTip(wait.from, at)) {
        const r = regions.find((x) => x.id === wait.id);
        if (r) switchTo(r);
      }
      lastPos.current = at;
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inWorld, regions]);
  // Уход мыши с региона или подсказки: закрыть с задержкой, если она не вернулась на регион или подсказку.
  const leave = (id: string | null) => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHoverId((h) => (id === null || h === id ? null : h)), TOOLTIP_CLOSE_DELAY);
  };
  useEffect(
    () => () => {
      cancelClose();
      clearPending();
    },
    [],
  );

  const regionButton = (id: string) => svgRef.current?.querySelector<SVGElement>(`[role="button"][data-region="${id}"]`);
  /** Tab с региона: фокус на первую кнопку подсказки. false — заходить некуда. */
  const enterTip = (id: string) => {
    const first = tipRef.current?.querySelector<HTMLElement>('button');
    if (!first) return false;
    setTipFocusId(id);
    first.focus();
    return true;
  };
  const onTipKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const id = shownId;
    const polygon = id ? regionButton(id) : null;
    if (!polygon) return;
    if (e.key === 'Escape') {
      // Esc закрывает подсказку, а не снимает героя и не уводит на уровень вверх (App).
      e.preventDefault();
      e.stopPropagation();
      setDismissedId(id);
      setTipFocusId(null);
      polygon.focus();
      return;
    }
    if (e.key !== 'Tab') return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button'));
    if (e.shiftKey && e.target === buttons[0]) {
      e.preventDefault();
      setTipFocusId(null);
      polygon.focus();
    } else if (!e.shiftKey && e.target === buttons[buttons.length - 1]) {
      e.preventDefault();
      setTipFocusId(null);
      focusAfter(polygon, e.currentTarget);
    }
  };

  /** Обработчики полигона-кнопки региона в мире. */
  const region = {
    /** #65: Tab с региона — в его подсказку, Esc — закрыть её. true — клавиша обработана. */
    onKeyDown: (r: Region, e: KeyboardEvent): boolean => {
      if (r.id === shownId && e.key === 'Tab' && !e.shiftKey && enterTip(r.id)) {
        e.preventDefault();
        return true;
      }
      if (r.id === shownId && e.key === 'Escape') {
        e.stopPropagation();
        setDismissedId(r.id);
        return true;
      }
      return false;
    },
    /** `at` — где мышь вошла в регион (клиентские координаты). */
    onEnter: (r: Region, at?: Point) => {
      cancelClose();
      void preloadRegionArt(r);
      const from = lastPos.current;
      if (at && from && shownId && shownId !== r.id && hoverId === shownId && aimsAtTip(from, at)) {
        clearPending();
        pending.current = { id: r.id, from, timer: setTimeout(() => switchTo(r), TOOLTIP_CLOSE_DELAY) };
        return;
      }
      switchTo(r);
    },
    onLeave: (r: Region) => {
      if (pending.current?.id === r.id) {
        clearPending();
        leave(null);
        return;
      }
      leave(r.id);
    },
    onFocus: (r: Region) => {
      setFocusId(r.id);
      void preloadRegionArt(r);
    },
    onBlur: (r: Region) => {
      setFocusId((id) => (id === r.id ? null : id));
      setDismissedId((d) => (d === r.id ? null : d));
    },
  };

  /** Свойства для `RegionTooltip`, кроме `region`, героев и медиа. */
  const tip = {
    id: tooltipId,
    getAnchor,
    tipRef,
    onPointerEnter: () => {
      cancelClose();
      clearPending();
    },
    onPointerLeave: () => leave(null),
    onKeyDown: onTipKeyDown,
    onFocusOut: () => setTipFocusId(null),
  };

  return { tooltipId, shownId, shown, heroes, media, focusId, region, tip };
}

export type RegionTooltipState = ReturnType<typeof useRegionTooltip>;
