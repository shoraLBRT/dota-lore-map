import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { cssDuration, cssPixels } from '../../app/motion';
import { useSfx } from '../../app/sound';
import type { Camera, Hero, Place, Point, Region } from '../../data/types';
import { getRegion, heroesOfPlace, heroesOfRegion, placeName } from '../../data/world';
import { useT } from '../../i18n';
import { AmbientCanvas } from '../atmosphere/AmbientCanvas';
import { spotName, type Spot } from '../search/search';
import { preloadRegionArt } from './art';
import { focusAfter } from './focus';
import { biomeColor } from './biomes';
import {
  animateCamera,
  cameraTransform,
  DURATION,
  frameCamera,
  placeCamera,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  MOBILE_QUERY,
  SHEET_PEEK,
  UNMEASURED,
  WORLD_CAMERA,
  worldListLayout,
  type Rect,
  type View,
} from './camera';

function isMobile(): boolean {
  try {
    return window.matchMedia(MOBILE_QUERY).matches;
  } catch {
    return false;
  }
}
import { EDGE_CLOUDS } from './cloudSets';
import { Clouds } from './Clouds';
import {
  clampLabelX,
  LABEL_GAP,
  placeEdgeLabels,
  placeMarkerLabels,
  splitLabel,
  type Box,
  type EdgeLabel,
  type LabelSide,
  type MarkerLabel,
} from './labels';
import styles from './MapStage.module.css';
import { PlaceTooltip } from './PlaceTooltip';
import { RegionArt } from './RegionArt';
import { RegionList } from './RegionList';
import { RegionTooltip } from './RegionTooltip';
import { Threads } from './Threads';
import { arc, edgeExit, rayExit, toScreen, visibleFrame } from './threadGeometry';

interface Props {
  regions: Region[];
  activeRegionId?: string;
  activePlaceSlug?: string;
  /** `source` — откуда открыли: полигон на карте или пункт списка регионов (фокус при возврате, A14). */
  onSelectRegion: (regionId: string, source?: 'map' | 'list') => void;
  onSelectPlace: (regionId: string, placeSlug: string) => void;
  /** Справа кадр закрыт панелью: камера региона и места кадрирует свободную часть (ARCHITECTURE A4). */
  panel?: boolean;
  /** Занять навигацию на время анимации камеры; возвращает «отпустить» (SPEC §7.1: клики не прерывают камеру). */
  onCameraBusy?: () => () => void;
  /** Герои для подсказки региона; по умолчанию — из данных мира. */
  heroesOf?: (regionId: string) => Hero[];
  /** Герои для подсказки места; по умолчанию — из данных мира. */
  heroesOfSpot?: (regionId: string, placeSlug: string) => Hero[];
  /** Выбран герой (SPEC §6.5): его регионы и места подсвечены, остальные приглушены. */
  focus?: Spot[];
  /** Места, соединяемые нитями (SPEC §6.6); `threadsKey` перезапускает прорисовку. */
  threads?: Spot[];
  threadsKey?: string;
  /**
   * Герой под наведением или фокусом (портрет в панели, вариант поиска; SPEC §6.6, #66): в мире подсвечены
   * его регионы, в регионе и месте — пульсируют его маркеры, места за кадром получают метку у края.
   */
  preview?: Spot[];
  /** Нажат портрет в подсказке региона (#65): выбрать героя, не уходя из мира. Без него портреты не кликаются. */
  onPickHero?: (hero: Hero) => void;
  /** Клик по метке нити, ушедшей за край кадра. */
  onSelectSpot?: (spot: Spot) => void;
  /** Телефон (#39, SPEC §13): в мире карта прижата к верху, под ней — список регионов. */
  regionList?: boolean;
  /** Сколько px сверху кадра занято (плашка героя): карта со списком встаёт ниже. */
  topInset?: number;
  /** Низ плашки героя или поиска над кадром, px от его верха (0 — плашки нет): метки «нить за краем» — ниже (#64). */
  coverTop?: number;
}

/** Отступ подписей маркеров от края видимой части кадра, px. */
const LABEL_MARGIN = 4;

/** Отступ меток «нить за краем» от края кадра, px. */
const EXIT_MARGIN = 28;

/** Отступ самих меток «нить за краем» от края видимой части кадра, px (#64). */
const EXIT_LABEL_MARGIN = 8;

/** Размер метки «нить за краем» без измерений (jsdom): кегль 0.8rem, стрелка, отступы, одна или две строки. */
function estimateExit(name: string, region: string | undefined): [number, number] {
  const chars = Math.max(name.length, region?.length ?? 0);
  return [Math.min(chars * 7.5 + 40, 224), region ? 44 : 28];
}

/** Кегль подписей маркеров (MapStage.module.css: .markerLabel, .capital .markerLabel), px. */
const MARKER_FONT = 13;
const CAPITAL_FONT = 17;

/**
 * Ширины подписей на карте по `data-measure` (getComputedTextLength — в единицах своей системы координат,
 * без учёта transform). Без измерений (jsdom) — пусто, подписи стоят как в данных.
 */
function measureTexts(root: Element | null): Record<string, number> {
  const out: Record<string, number> = {};
  root?.querySelectorAll<SVGTextContentElement>('[data-measure]').forEach((el) => {
    if (typeof el.getComputedTextLength !== 'function') return;
    const width = el.getComputedTextLength();
    const key = el.getAttribute('data-measure')!;
    if (width > 0) out[key] = Math.max(out[key] ?? 0, width);
  });
  return out;
}

/** Ширины (`w:key`) и высоты (`h:key`) элементов, px. Без измерений (jsdom, offsetWidth 0) — пусто. */
function measureBoxes(els: Map<string, HTMLElement>): Record<string, number> {
  const out: Record<string, number> = {};
  els.forEach((el, key) => {
    if (el.offsetWidth > 0) {
      out[`w:${key}`] = el.offsetWidth;
      out[`h:${key}`] = el.offsetHeight;
    }
  });
  return out;
}

const sameRecord = (a: Record<string, number>, b: Record<string, number>) => {
  const keys = Object.keys(b);
  return keys.length === Object.keys(a).length && keys.every((k) => Math.abs((a[k] ?? -1) - b[k]!) < 0.5);
};

/** Подпись маркера на стороне `side`: якорь и базовая линия (labels.ts: labelBox). */
function markerLabelAttrs(
  side: LabelSide,
  ring: number,
  size: number,
): { x: number; y: number; textAnchor: 'start' | 'middle' | 'end' } {
  const d = ring + LABEL_GAP;
  switch (side) {
    case 'bottom':
      return { x: 0, y: d + 0.78 * size, textAnchor: 'middle' };
    case 'right':
      return { x: d, y: 0.28 * size, textAnchor: 'start' };
    case 'left':
      return { x: -d, y: 0.28 * size, textAnchor: 'end' };
    default:
      return { x: 0, y: -d - 0.22 * size, textAnchor: 'middle' };
  }
}

const toStage = ([x, y]: Point): [number, number] => [x * STAGE_WIDTH, y * STAGE_HEIGHT];
const points = (polygon: Point[]) => polygon.map((p) => toStage(p).join(',')).join(' ');

/** Цвет подсветки (SPEC §8.3): ярусы — своё свечение, остальные — по стороне. */
const highlight = (r: Region) => (r.tier === 'continent' ? r.side : r.tier);

/** Вершины пятиконечной звезды столицы (SPEC §6.3), радиус 1. */
const STAR = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? 1 : 0.45;
  return `${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`;
}).join(' ');

function onActivate(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      action();
    }
  };
}

const noop = () => () => {};

/** Задержка закрытия подсказки региона: успеть перевести мышь с региона на подсказку и обратно (#65), мс. */
export const TOOLTIP_CLOSE_DELAY = 200;

const rectStyle = (r: Rect): CSSProperties => ({ top: r.top, left: r.left, width: r.width, height: r.height });

/**
 * Слой карты (ARCHITECTURE A4): SVG в координатах 1600×1000 под камерой.
 * Мир (S1): наведение и фокус подсвечивают регион и показывают подсказку (S1h).
 * Регион и место (S2/S3): соседи затемнены и не кликаются, маркеры мест с подсказкой героев.
 * Регионы без геометрии в map/layout.json показываются списком кнопок.
 */
export function MapStage({
  regions,
  activeRegionId,
  activePlaceSlug,
  onSelectRegion,
  onSelectPlace,
  panel = false,
  onCameraBusy = noop,
  heroesOf = heroesOfRegion,
  heroesOfSpot = heroesOfPlace,
  focus,
  threads,
  threadsKey,
  preview,
  onPickHero,
  onSelectSpot,
  regionList = false,
  topInset = 0,
  coverTop = 0,
}: Props) {
  const { l, lang, t } = useT();
  const sfx = useSfx();
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipId = useId();
  const placeTipId = useId();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  // Подсказка региона (#65): мышь на ней держит её открытой, фокус в ней (с клавиатуры) — тоже;
  // Esc закрывает её до ухода с региона.
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipFocusId, setTipFocusId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [spotHover, setSpotHover] = useState<string | null>(null);
  const [spotFocus, setSpotFocus] = useState<string | null>(null);
  /** Пункт списка регионов под наведением или фокусом: регион подсвечен на карте, без подсказки. */
  const [listId, setListId] = useState<string | null>(null);
  const [view, setView] = useState<View>(UNMEASURED);
  /** Камера летит: подсказки ждут посадки, иначе встают у якоря, посчитанного на старте (аудит E13). */
  const [flying, setFlying] = useState(false);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [fontsTick, setFontsTick] = useState(0);

  const drawn = regions.filter((r) => r.layout);
  const listed = regions.filter((r) => !r.layout);
  const active = regions.find((r) => r.id === activeRegionId && r.layout);
  const hasMap = drawn.length > 0;

  // S1h только в мире; фокус в подсказке важнее мыши (иначе фокус пропадёт вместе с ней), мышь — фокуса на регионе.
  const inWorld = !active;
  const wantedId = inWorld ? (tipFocusId ?? hoverId ?? focusId) : null;
  const shownId = wantedId === dismissedId ? null : wantedId;
  const litId = inWorld ? listId : null;
  const shown = useMemo(() => regions.find((r) => r.id === shownId && r.layout), [regions, shownId]);
  const shownHeroes = useMemo(() => (shown ? heroesOf(shown.id) : []), [shown, heroesOf]);

  const spots = useMemo(() => active?.places.filter((p) => p.pos) ?? [], [active]);
  const spotId = active ? (spotHover ?? spotFocus) : null;
  const spot = spots.find((p) => p.slug === spotId);
  const spotHeroes = useMemo(
    () => (active && spot ? heroesOfSpot(active.id, spot.slug) : []),
    [active, spot, heroesOfSpot],
  );

  const focusRegions = useMemo(() => (focus ? new Set(focus.map((s) => s.regionId)) : null), [focus]);
  const focusPlaces = useMemo(() => (focus ? new Set(focus.map((s) => s.key)) : null), [focus]);
  const previewRegions = useMemo(() => (preview ? new Set(preview.map((s) => s.regionId)) : null), [preview]);
  const previewPlaces = useMemo(() => (preview ? new Set(preview.map((s) => s.key)) : null), [preview]);
  /** Класс приглушения или подсветки при выбранном герое. */
  const heroClass = (regionId: string) =>
    focusRegions ? (focusRegions.has(regionId) ? styles.heroRegion : styles.muted) : undefined;

  // Кадр и панель: измеряем, чтобы камера региона не уходила под панель.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const layer = layerRef.current;
    if (!viewport || !layer) return;
    const measure = () =>
      setView((v) => {
        const next: View = {
          width: viewport.clientWidth,
          height: viewport.clientHeight,
          layerWidth: layer.offsetWidth,
          layerHeight: layer.offsetHeight,
          inset: cssPixels('--panel-inset'),
          // Шторка — доля высоты окна и прижата к его низу, как и кадр карты.
          insetBottom: isMobile() ? Math.round(window.innerHeight * SHEET_PEEK) : 0,
        };
        const same = (Object.keys(next) as (keyof View)[]).every((k) => next[k] === v[k]);
        return same ? v : next;
      });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [hasMap]);

  const camera = useMemo<Camera>(() => {
    if (!active?.layout) return WORLD_CAMERA;
    const pos = active.places.find((p) => p.slug === activePlaceSlug)?.pos;
    return pos ? placeCamera(active.layout.camera, pos) : active.layout.camera;
  }, [active, activePlaceSlug]);

  const inset = panel && active ? view.inset : 0;
  const insetBottom = panel && active ? (view.insetBottom ?? 0) : 0;
  const framed = useMemo(() => frameCamera(camera, { ...view, inset, insetBottom }), [camera, view, inset, insetBottom]);
  // Мир со списком регионов: карта прижата к верху (или влево, если телефон боком), список — в пустом месте.
  const listLayout = useMemo(
    () => (regionList && inWorld && hasMap ? worldListLayout(view, topInset) : null),
    [regionList, inWorld, hasMap, view, topInset],
  );
  const target = listLayout
    ? cameraTransform(WORLD_CAMERA, listLayout.offset, listLayout.offsetY)
    : cameraTransform(framed.camera, framed.offset, framed.offsetY);
  /** Маркеры и подписи — в экранных пикселях, независимо от приближения и размера окна (1 единица SVG = 1 px). */
  const regionZoom = active?.layout ? frameCamera(active.layout.camera, { ...view, inset, insetBottom }).camera.zoom : 1;
  const markerScale = (view.layerWidth > 0 ? STAGE_WIDTH / view.layerWidth : 1) / regionZoom;
  /** Нити — тоже в экранных px, но при любом приближении (в мире zoom 1). */
  const threadScale = (view.layerWidth > 0 ? STAGE_WIDTH / view.layerWidth : 1) / framed.camera.zoom;

  // Ширины подписей: при смене языка, региона и после загрузки шрифтов (подписи не выходят за край и не налезают).
  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => alive && setFontsTick((n) => n + 1));
    return () => {
      alive = false;
    };
  }, []);
  const measureKey = `${lang}|${active?.id ?? ''}|${fontsTick}|${hasMap}`;
  useLayoutEffect(() => {
    const next = measureTexts(svgRef.current);
    setWidths((prev) => (sameRecord(prev, next) ? prev : next));
  }, [measureKey]);

  // Подписи маркеров не налезают друг на друга: текущее место, столица и места героя ставятся первыми.
  const sides = useMemo(() => {
    const rank = (p: Place) =>
      p.slug === activePlaceSlug ? 0 : p.capital ? 1 : focusPlaces?.has(`${active?.id}/${p.slug}`) ? 2 : 3;
    const items: MarkerLabel[] = [...spots]
      .sort((a, b) => rank(a) - rank(b))
      .map((p) => {
        const [x, y] = toStage(p.pos!);
        const size = p.capital ? CAPITAL_FONT : MARKER_FONT;
        return {
          key: p.slug,
          x: x / markerScale,
          y: y / markerScale,
          // Без измерений — оценка по числу знаков.
          width: widths[`m:${p.slug}`] ?? placeName(p, lang).length * size * 0.6,
          size,
          ring: p.capital ? 11 : 9,
          must: rank(p) < 2,
        };
      });
    // Видимая часть кадра (левее панели, выше шторки) в единицах маркеров: подписи не уходят за край (аудит E13).
    let bounds: Box | undefined;
    if (view.width > 0 && active) {
      const frame = visibleFrame(view, inset, LABEL_MARGIN, insetBottom);
      const [ox, oy] = toScreen([0, 0], framed.camera, framed.offset, view, framed.offsetY);
      const k = regionZoom / framed.camera.zoom;
      bounds = { left: (frame.left - ox) * k, right: (frame.right - ox) * k, top: (frame.top - oy) * k, bottom: (frame.bottom - oy) * k };
    }
    return placeMarkerLabels(items, bounds);
  }, [spots, activePlaceSlug, focusPlaces, active, lang, widths, markerScale, view, inset, insetBottom, framed, regionZoom]);

  // S2/S3: нить к месту за краем кадра уходит туда со стрелкой и названием (SPEC §6.6).
  const exits = useMemo(() => {
    const placed = (threads ?? []).filter((s) => s.point);
    if (!active || view.width <= 0 || (placed.length < 2 && !preview?.length)) return [];
    const project = (p: Point) => toScreen(p, framed.camera, framed.offset, view, framed.offsetY);
    const frame = visibleFrame(view, inset, EXIT_MARGIN, insetBottom);
    const visible = (p: Point) => {
      const [x, y] = project(p);
      return x >= frame.left && x <= frame.right && y >= frame.top && y <= frame.bottom;
    };
    const out = new Map<string, { spot: Spot; x: number; y: number; angle: number }>();
    for (let i = 1; i < placed.length; i++) {
      const a = placed[i - 1]!;
      const b = placed[i]!;
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

  // Метки «нить за краем» — целиком в видимой части кадра и не друг на друге (#64). Размеры — измеренные.
  const [exitSizes, setExitSizes] = useState<Record<string, number>>({});
  const exitRefs = useRef(new Map<string, HTMLButtonElement>());
  const exitsKey = `${lang}|${fontsTick}|${exits.map((e) => e.spot.key).join(',')}`;
  useLayoutEffect(() => {
    const next = measureBoxes(exitRefs.current);
    setExitSizes((prev) => (sameRecord(prev, next) ? prev : next));
  }, [exitsKey]);
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

  // Анимация камеры (A3, A4). Пока она идёт, навигация занята: клики ставятся в очередь.
  const shownCamera = useRef<Camera>(camera);
  const shownTarget = useRef(target);
  const shownRegion = useRef(active?.id);
  const running = useRef<Animation | null>(null);
  const busy = useRef(onCameraBusy);
  useLayoutEffect(() => {
    busy.current = onCameraBusy;
  }, [onCameraBusy]);
  // Кадр на сейчас: окно могли повернуть или растянуть во время перелёта (аудит E13).
  const latestTarget = useRef(target);
  useLayoutEffect(() => {
    latestTarget.current = target;
  }, [target]);

  useLayoutEffect(() => {
    const el = layerRef.current;
    const prevCamera = shownCamera.current;
    const prevRegion = shownRegion.current;
    let from = shownTarget.current;
    shownCamera.current = camera;
    shownTarget.current = target;
    shownRegion.current = active?.id;
    // Тот же кадр, другой размер окна — без анимации, transform уже стоит в style.
    if (!el || prevCamera === camera) return;
    if (running.current) {
      // Новый переход посреди старого (кнопка «назад» браузера) — продолжаем с текущего положения.
      from = window.getComputedStyle(el).transform || from;
      running.current.cancel();
      running.current = null;
    }
    const withinRegion = prevRegion !== undefined && prevRegion === active?.id;
    const duration = withinRegion
      ? cssDuration('--dur-place') || DURATION.place
      : cssDuration('--dur-camera') || DURATION.region;
    const animation = animateCamera(el, from, target, duration);
    if (!animation) return;
    running.current = animation;
    setFlying(true);
    const release = busy.current();
    animation.finished
      .catch(() => undefined)
      .finally(() => {
        if (running.current === animation) {
          running.current = null;
          setFlying(false);
          // Посадка ставит кадр, посчитанный на старте; если окно с тех пор изменилось — берём свежий.
          el.style.transform = latestTarget.current;
        }
        release();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- анимируем только смену кадра, не размер окна
  }, [camera]);

  useEffect(() => () => running.current?.cancel(), []);

  const getAnchor = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !shown?.layout) return null;
    const rect = svg.getBoundingClientRect();
    const [x, y] = shown.layout.label;
    return { x: rect.left + x * rect.width, y: rect.top + y * rect.height };
  }, [shown]);

  const getSpotAnchor = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !spot?.pos) return null;
    const rect = svg.getBoundingClientRect();
    const [x, y] = spot.pos;
    return { x: rect.left + x * rect.width, y: rect.top + y * rect.height };
  }, [spot]);

  const cancelClose = () => clearTimeout(closeTimer.current);
  // Уход мыши с региона или подсказки: закрыть с задержкой, если она не вернулась на регион или подсказку.
  const leave = (id: string | null) => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHoverId((h) => (id === null || h === id ? null : h)), TOOLTIP_CLOSE_DELAY);
  };
  useEffect(() => cancelClose, []);

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

  const enter = (r: Region) => {
    cancelClose();
    setDismissedId((d) => (d === r.id ? null : d));
    setHoverId(r.id);
    sfx('hover');
    void preloadRegionArt(r);
  };

  // S3 → S2: клик по пустому месту карты (SPEC §5.1). Маркеры клик не пропускают.
  const onBackground = (e: MouseEvent) => {
    if (active && activePlaceSlug !== undefined && !(e.target as Element).closest?.('[data-place]')) {
      onSelectRegion(active.id);
    }
  };

  const marker = (p: Place, i: number) => {
    const [x, y] = toStage(p.pos!);
    const isActive = p.slug === activePlaceSlug;
    const name = placeName(p, lang);
    const select = () => onSelectPlace(active!.id, p.slug);
    const side = sides.get(p.slug) ?? 'top';
    const ring = p.capital ? 11 : 9;
    const label = markerLabelAttrs(side, ring, p.capital ? CAPITAL_FONT : MARKER_FONT);
    const previewed = previewPlaces?.has(`${active!.id}/${p.slug}`) ?? false;
    return (
      <g
        key={p.slug}
        className={[
          styles.marker,
          p.capital && styles.capital,
          isActive && styles.current,
          side === 'hidden' && styles.labelHidden,
          focusPlaces && (focusPlaces.has(`${active!.id}/${p.slug}`) ? styles.heroSpot : styles.mutedMarker),
          previewed && styles.previewed,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ '--i': i } as CSSProperties}
        transform={`translate(${x} ${y}) scale(${markerScale.toFixed(4)})`}
        role="button"
        tabIndex={0}
        aria-label={name}
        aria-current={isActive ? 'true' : undefined}
        aria-describedby={p.slug === spotId && spotHeroes.length > 0 ? placeTipId : undefined}
        data-place={p.slug}
        onClick={(e) => {
          e.stopPropagation();
          select();
        }}
        onKeyDown={onActivate(select)}
        onPointerEnter={(e) => {
          if (e.pointerType === 'touch') return;
          setSpotHover(p.slug);
          sfx('hover');
        }}
        onPointerLeave={() => setSpotHover((s) => (s === p.slug ? null : s))}
        onFocus={() => setSpotFocus(p.slug)}
        onBlur={() => setSpotFocus((s) => (s === p.slug ? null : s))}
      >
        <circle className={styles.hit} r={18} />
        {previewed && <circle className={styles.pulse} r={ring} data-pulse="" />}
        <circle className={styles.ring} r={ring} />
        {p.capital ? (
          <polygon className={styles.dot} points={STAR} transform="scale(7)" />
        ) : (
          <circle className={styles.dot} r={4} />
        )}
        <text
          className={styles.markerLabel}
          x={label.x}
          y={label.y}
          textAnchor={label.textAnchor}
          data-measure={`m:${p.slug}`}
          data-side={side}
        >
          {name}
        </text>
      </g>
    );
  };

  return (
    <div className={[styles.stage, active && styles.zoomed].filter(Boolean).join(' ')}>
      {hasMap && (
        <div ref={viewportRef} className={styles.viewport} onClick={onBackground}>
          <div ref={layerRef} className={styles.layer} style={{ transform: target }}>
            <svg
              ref={svgRef}
              className={styles.svg}
              viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
              role="group"
              aria-label={t('world.map')}
            >
              <g>
                {drawn.map((r) => {
                  const isActive = r.id === active?.id;
                  // S2/S3: соседи затемнены и не кликаются, активный регион — «пустое место» карты (SPEC §5.4).
                  if (!inWorld) {
                    return (
                      <polygon
                        key={r.id}
                        className={[styles.region, isActive ? styles.active : styles.dimmed].join(' ')}
                        points={points(r.layout!.polygon)}
                        fill={biomeColor(r.biome)}
                        aria-hidden="true"
                        data-region={r.id}
                      />
                    );
                  }
                  return (
                    <polygon
                      key={r.id}
                      className={[styles.region, heroClass(r.id)].filter(Boolean).join(' ')}
                      points={points(r.layout!.polygon)}
                      fill={biomeColor(r.biome)}
                      role="button"
                      tabIndex={0}
                      aria-label={l(r.name)}
                      aria-describedby={r.id === shownId ? tooltipId : undefined}
                      data-region={r.id}
                      onClick={() => onSelectRegion(r.id, 'map')}
                      onKeyDown={(e) => {
                        // #65: Tab с региона — в его подсказку, Esc — закрыть её.
                        if (r.id === shownId && e.key === 'Tab' && !e.shiftKey && enterTip(r.id)) {
                          e.preventDefault();
                          return;
                        }
                        if (r.id === shownId && e.key === 'Escape') {
                          e.stopPropagation();
                          setDismissedId(r.id);
                          return;
                        }
                        onActivate(() => onSelectRegion(r.id, 'map'))(e);
                      }}
                      // SPEC §5.3: на тач-устройствах подсказки нет, тап сразу открывает регион.
                      onPointerEnter={(e) => e.pointerType !== 'touch' && enter(r)}
                      onPointerLeave={(e) => e.pointerType !== 'touch' && leave(r.id)}
                      onFocus={() => {
                        setFocusId(r.id);
                        void preloadRegionArt(r);
                      }}
                      onBlur={() => {
                        setFocusId((id) => (id === r.id ? null : id));
                        setDismissedId((d) => (d === r.id ? null : d));
                      }}
                    />
                  );
                })}
              </g>
              {/* Заливка цветом стороны поверх всех полигонов, чтобы светлая граница не пряталась под соседями. */}
              <g aria-hidden="true">
                {drawn.map((r) => (
                  <polygon
                    key={r.id}
                    className={[
                      styles.tint,
                      styles[highlight(r)],
                      (r.id === shownId || r.id === litId || (inWorld && (focusRegions?.has(r.id) || previewRegions?.has(r.id)))) &&
                        styles.lit,
                      r.id === shownId && r.id === focusId && styles.focused,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    points={points(r.layout!.polygon)}
                    data-tint={r.id}
                  />
                ))}
              </g>
              <g aria-hidden="true" className={styles.labels}>
                {drawn.map((r) => {
                  const [lx, ly] = toStage(r.layout!.label);
                  // Длинные названия регионов — в две строки (ярусам, широким полосам, не нужно); подпись не выходит за край.
                  const name = l(r.name);
                  const lines = r.tier === 'continent' ? splitLabel(name) : [name];
                  const width = widths[`r:${r.id}`];
                  const x = width ? clampLabelX(lx, width) : lx;
                  return (
                    <text
                      key={r.id}
                      className={[
                        styles.label,
                        styles[highlight(r)],
                        r.tier !== 'continent' && styles.tierLabel,
                        (r.id === shownId || r.id === litId || (inWorld && previewRegions?.has(r.id))) && styles.lit,
                        inWorld && heroClass(r.id),
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      x={x}
                      y={ly}
                      textAnchor="middle"
                      data-label={r.id}
                      data-measure={lines.length === 1 ? `r:${r.id}` : undefined}
                    >
                      {lines.length === 1
                        ? name
                        : lines.map((line, i) => (
                            <tspan key={i} x={x} dy={i === 0 ? '-0.45em' : '1.05em'} data-measure={`r:${r.id}`}>
                              {line}
                            </tspan>
                          ))}
                    </text>
                  );
                })}
              </g>
              {active && <RegionArt key={`art-${active.id}`} region={active} />}
              {active && (
                <g key={`markers-${active.id}`} className={styles.markers}>
                  {spots.map(marker)}
                </g>
              )}
              {threads && <Threads key={threadsKey} spots={threads} scale={threadScale} />}
            </svg>
          </div>
          {active && <AmbientCanvas key={active.id} ambient={active.ambient} />}
          <div className={styles.vignette} style={listLayout ? rectStyle(listLayout.map) : undefined} aria-hidden="true" />
          {exits.map((e) => {
            const at = exitAt.get(e.spot.key);
            return (
              <button
                key={`${threadsKey ?? ''}/${e.spot.key}`}
                ref={(el) => {
                  if (el) exitRefs.current.set(e.spot.key, el);
                  else exitRefs.current.delete(e.spot.key);
                }}
                type="button"
                className={[styles.exit, styles[e.spot.tone]].join(' ')}
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
          })}
          <div className={styles.cloudBox} style={listLayout ? rectStyle(listLayout.map) : undefined}>
            <Clouds clouds={EDGE_CLOUDS} mode="drift" hidden={!inWorld} />
          </div>
          {listLayout && (
            <RegionList
              regions={drawn}
              onSelect={(id) => onSelectRegion(id, 'list')}
              onHighlight={(id) => {
                setListId(id);
                if (!id) return;
                const r = drawn.find((d) => d.id === id);
                if (r) void preloadRegionArt(r);
              }}
              heroCountOf={(id) => heroesOf(id).length}
              focus={focusRegions}
              waiting={flying}
              style={rectStyle(listLayout.list)}
            />
          )}
        </div>
      )}
      {shown && !flying && (
        <RegionTooltip
          id={tooltipId}
          region={shown}
          heroes={shownHeroes}
          getAnchor={getAnchor}
          tipRef={tipRef}
          onPick={onPickHero}
          onPointerEnter={cancelClose}
          onPointerLeave={() => leave(null)}
          onKeyDown={onTipKeyDown}
          onFocusOut={() => setTipFocusId(null)}
        />
      )}
      {active && spot && !flying && (
        <PlaceTooltip id={placeTipId} placeKey={`${active.id}/${spot.slug}`} heroes={spotHeroes} getAnchor={getSpotAnchor} />
      )}
      {listed.length > 0 && (
        <nav className={styles.list} aria-label={t('world.regions')}>
          <ul>
            {listed.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  aria-current={r.id === activeRegionId ? 'true' : undefined}
                  onClick={() => onSelectRegion(r.id)}
                >
                  {l(r.name)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
