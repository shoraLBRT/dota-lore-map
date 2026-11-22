import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { cssPixels } from '../../app/motion';
import { useSfx } from '../../app/sound';
import type { Camera, Hero, Region } from '../../data/types';
import { preloadRegionArt } from './art';
import { pointOnMap } from './depth';
import { focusAfter } from './focus';
import { regionMediaBadge } from './mediaBadge';
import type { Anchor, Box } from './RegionTooltip';

/** Задержка закрытия подсказки региона: успеть перевести мышь с подписи на подсказку и обратно (#65), мс. */
export const TOOLTIP_CLOSE_DELAY = 200;
/** Задержка появления подсказки после наведения на подпись региона (#193), мс. */
export const TOOLTIP_OPEN_DELAY = 300;
/** Глубже этого приближения мира подсказки региона нет (#193): подписи и арт и так крупные. */
export const TOOLTIP_MAX_ZOOM = 2;

/** Запас вокруг габарита подписи региона для наведения, px (#193). */
const LABEL_SLACK = 4;

/** Правый край левой полосы (SPEC §6.1): подсказку левее не ставят (#101). */
const railRight = () => cssPixels('--rail-width');

const boxOf = (el: Element): Box | null => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
};

interface Options {
  regions: Region[];
  /** Мир (S1): подсказка есть только в нём. */
  inWorld: boolean;
  svgRef: RefObject<SVGSVGElement | null>;
  /** SVG экранного слоя с подписями регионов (`[data-label]`): подсказка привязана к подписи (#193). */
  labelsRef: RefObject<SVGSVGElement | null>;
  /** Камера мира: сдвиг или зум (перетаскивание, колесо, щипок) прячет подсказку, глубже порога её нет. */
  camera: Camera;
  heroesOf: (regionId: string) => Hero[];
  /** Есть галерея — в подсказке значок медиа. */
  withMedia: boolean;
}

/**
 * Подсказка региона в мире (ARCHITECTURE A4, #65, #193): наведение на полигон только подсвечивает регион;
 * подсказку вызывает наведение на подпись (через `TOOLTIP_OPEN_DELAY`) или фокус с клавиатуры на регионе.
 * Мышь на подписи или на подсказке и фокус в подсказке держат её открытой, Esc закрывает до ухода с региона.
 */
export function useRegionTooltip({ regions, inWorld, svgRef, labelsRef, camera, heroesOf, withMedia }: Options) {
  const sfx = useSfx();
  const tooltipId = useId();
  /** Полигон или подпись под мышью: подсветка региона, без подсказки. */
  const [overId, setOverId] = useState<string | null>(null);
  /** Подсказка по наведению на подпись. */
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipFocusId, setTipFocusId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const openTimer = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const deep = camera.zoom > TOOLTIP_MAX_ZOOM + 1e-6;
  // S1h только в мире и не на глубоком зуме; фокус в подсказке важнее мыши (иначе фокус пропадёт вместе с ней),
  // мышь — фокуса на регионе.
  const wantedId = inWorld && !deep ? (tipFocusId ?? hoverId ?? focusId) : null;
  const shownId = wantedId === dismissedId ? null : wantedId;
  const shownRef = useRef(shownId);
  const hoverRef = useRef(hoverId);
  useEffect(() => {
    shownRef.current = shownId;
    hoverRef.current = hoverId;
  });
  const shown = useMemo(() => regions.find((r) => r.id === shownId && r.layout), [regions, shownId]);
  const heroes = useMemo(() => (shown ? heroesOf(shown.id) : []), [shown, heroesOf]);
  const media = useMemo(() => (shown && withMedia ? regionMediaBadge(shown) : null), [shown, withMedia]);

  const getAnchor = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !shown?.layout) return null;
    // Слой карты под наклоном (#232): точка подписи — там, где её видно на наклонённой карте.
    const [x, y] = pointOnMap(svg, ...shown.layout.label);
    const anchor: Anchor = { x, y, minLeft: railRight() };
    // #193: подсказка у подписи региона и не на ней; соседние подписи по возможности не закрывает.
    const labels = labelsRef.current?.querySelectorAll('[data-label]') ?? [];
    const avoid: Box[] = [];
    for (const el of labels) {
      const box = boxOf(el);
      if (!box) continue;
      if (el.getAttribute('data-label') === shown.id) anchor.label = box;
      else avoid.push(box);
    }
    anchor.avoid = avoid;
    return anchor;
  }, [shown, svgRef, labelsRef]);

  const cancelClose = () => clearTimeout(closeTimer.current);
  const cancelOpen = () => {
    if (openTimer.current) clearTimeout(openTimer.current.timer);
    openTimer.current = null;
  };
  const open = (r: Region) => {
    cancelOpen();
    setDismissedId((d) => (d === r.id ? null : d));
    setHoverId(r.id);
  };
  // Уход мыши с подписи или подсказки: закрыть с задержкой, если она не вернулась на подпись или подсказку.
  const leave = (id: string | null) => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHoverId((h) => (id === null || h === id ? null : h)), TOOLTIP_CLOSE_DELAY);
  };
  useEffect(
    () => () => {
      cancelClose();
      cancelOpen();
    },
    [],
  );

  // #193: камера сдвинулась или приблизилась (перетаскивание, колесо, щипок, кнопки зума) — подсказки по наведению нет;
  // мышь, оставшаяся на подписи, вызовет её снова, когда двинется.
  const cameraKey = `${camera.x}|${camera.y}|${camera.zoom}`;
  const prevCamera = useRef(cameraKey);
  useEffect(() => {
    if (prevCamera.current === cameraKey) return;
    prevCamera.current = cameraKey;
    cancelOpen();
    cancelClose();
    setHoverId(null);
  }, [cameraKey]);

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

  // Регион, для которого уже прозвучало наведение. Переход с полигона на его подпись и обратно — пара leave/enter
  // в одной задаче браузера: ref сбрасывается после неё, если мышь так и не вернулась на регион.
  const soundRef = useRef<string | null>(null);
  const over = (r: Region) => {
    if (soundRef.current !== r.id && soundRef.current !== `-${r.id}`) sfx('hover');
    soundRef.current = r.id;
    setOverId(r.id);
    void preloadRegionArt(r);
  };
  const out = (r: Region) => {
    soundRef.current = `-${r.id}`;
    setTimeout(() => {
      if (soundRef.current === `-${r.id}`) soundRef.current = null;
    }, 0);
    setOverId((id) => (id === r.id ? null : id));
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
    /** Мышь на полигоне — только подсветка (#193). */
    onEnter: over,
    onLeave: out,
    onFocus: (r: Region) => {
      setFocusId(r.id);
      void preloadRegionArt(r);
    },
    onBlur: (r: Region) => {
      setFocusId((id) => (id === r.id ? null : id));
      setDismissedId((d) => (d === r.id ? null : d));
    },
  };

  /**
   * Наведение на подпись региона (экранный слой): вызывает подсказку. Подсветку держит полигон под подписью.
   * Вызывается из `pointermove` окна по габариту подписи (см. ниже), а не событиями самой подписи.
   */
  const label = {
    onEnter: (r: Region) => {
      void preloadRegionArt(r);
      cancelClose();
      // Подсказка уже открыта (у этой или соседней подписи) — переходит сразу; иначе — после задержки.
      if (shownRef.current) {
        open(r);
        return;
      }
      if (openTimer.current?.id === r.id) return;
      cancelOpen();
      openTimer.current = { id: r.id, timer: setTimeout(() => open(r), TOOLTIP_OPEN_DELAY) };
    },
    /** Мышь двинулась на подписи после сдвига камеры: подсказку снова можно вызвать. */
    onMove: (r: Region) => {
      if (hoverRef.current === r.id || openTimer.current?.id === r.id) return;
      label.onEnter(r);
    },
    onLeave: (r: Region) => {
      if (openTimer.current?.id === r.id) cancelOpen();
      leave(r.id);
    },
  };
  const labelRef = useRef(label);
  useEffect(() => {
    labelRef.current = label;
  });

  // #193: подпись под мышью — по её габариту на экране (`getBoundingClientRect` с запасом LABEL_SLACK), а не по
  // событиям `<text>`: у SVG-текста цель — только глифы (в WebKit — и с pointer-events: bounding-box ненадёжно),
  // мышь между буквами и строками «уходила» с подписи. Считаем только мышь над картой (полигоны или пустое место
  // кадра), не над кнопками и подсказкой; с зажатой кнопкой (перетаскивание) подписи нет.
  const labelAt = useRef<string | null>(null);
  useEffect(() => {
    if (!inWorld) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const target = e.target as Element | null;
      // Мышь перешла на подсказку: её держит сама подсказка (onPointerEnter/Leave), уход с подписи не считаем.
      if (target && tipRef.current?.contains(target)) {
        labelAt.current = null;
        return;
      }
      const viewport = target?.closest?.('[data-map-viewport]');
      let id: string | null = null;
      // Герб региона (#189) — в экранном слое и ловит мышь сам: мышь на нём — тоже на названии.
      if (e.buttons === 0 && viewport && (target === viewport || svgRef.current?.contains(target) || labelsRef.current?.contains(target))) {
        for (const el of labelsRef.current?.querySelectorAll('[data-label]') ?? []) {
          const r = el.getBoundingClientRect();
          if (r.width <= 0) continue;
          if (
            e.clientX >= r.left - LABEL_SLACK &&
            e.clientX <= r.right + LABEL_SLACK &&
            e.clientY >= r.top - LABEL_SLACK &&
            e.clientY <= r.bottom + LABEL_SLACK
          ) {
            id = el.getAttribute('data-label');
            break;
          }
        }
      }
      const prev = labelAt.current;
      const region = (x: string | null) => (x ? regions.find((r) => r.id === x) : undefined);
      if (id === prev) {
        const r = region(id);
        if (r) labelRef.current.onMove(r);
        return;
      }
      labelAt.current = id;
      const left = region(prev);
      if (left) labelRef.current.onLeave(left);
      const entered = region(id);
      if (entered) labelRef.current.onEnter(entered);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [inWorld, regions, svgRef, labelsRef]);

  /** Свойства для `RegionTooltip`, кроме `region`, героев и медиа. */
  const tip = {
    id: tooltipId,
    getAnchor,
    tipRef,
    onPointerEnter: cancelClose,
    onPointerLeave: () => leave(null),
    onKeyDown: onTipKeyDown,
    onFocusOut: () => setTipFocusId(null),
  };

  /** Подсвечен ли регион мышью или подсказкой. */
  const litId = inWorld ? overId : null;
  return { tooltipId, shownId, shown, heroes, media, focusId, litId, region, label, tip };
}

export type RegionTooltipState = ReturnType<typeof useRegionTooltip>;
