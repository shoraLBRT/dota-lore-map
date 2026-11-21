import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cssDuration, cssPixels } from '../../app/motion';
import type { Camera, Region } from '../../data/types';
import {
  animateCamera,
  cameraTransform,
  clampCamera,
  containScale,
  DURATION,
  frameCamera,
  MOBILE_QUERY,
  placeCamera,
  polygonBox,
  regionFrame,
  SHEET_PEEK,
  STAGE_WIDTH,
  UNMEASURED,
  WORLD_CAMERA,
  type View,
  wholeFrame,
  type WorldBox,
  zoomLevels,
} from './camera';
import { centered, useFreeCamera } from './freeCamera';
import { cameraInverse, placeAnchors } from './screenAnchors';

/** Кадр «мир слева от панели» — отдельный кадр для анимации, хотя камера та же (#97). */
const WORLD_PANEL_SHOT = 'world-panel' as const;
/** Свободная камера, оставленная при выходе из региона колесом (#190): мир продолжается с того же вида. */
const EXIT_SHOT = 'region-exit' as const;

function isMobile(): boolean {
  try {
    return window.matchMedia(MOBILE_QUERY).matches;
  } catch {
    return false;
  }
}

/** Кадр камеры и закрытые его части — всё, что слоям карты нужно знать о камере. */
export interface Frame {
  view: View;
  framed: { camera: Camera; offset: number; offsetY?: number };
  /** Панель справа (только в регионе и месте), панель справа в любом экране, шторка снизу, px. */
  inset: number;
  cover: number;
  insetBottom: number;
  /** Приближение кадра региона; маркеры — в экранных px (`markerScale`), нити — тоже (`threadScale`). */
  regionZoom: number;
  markerScale: number;
  threadScale: number;
  /** Названия регионов (#189): 1 px экрана в единицах сцены, приближение мира на экране, его потолок, мир, вписанный в кадр (px). */
  pxScale: number;
  worldZoom: number;
  zoomMax: number;
  fitted: number;
}

interface Options {
  /** Открытый регион с геометрией; нет — мир. */
  active: Region | undefined;
  /** Рамки всех регионов на карте (`polygonBox`): от их кадров — потолок зума мира (#209). */
  regionBoxes: WorldBox[];
  activePlaceSlug: string | undefined;
  /** Справа кадр закрыт панелью (ARCHITECTURE A4). */
  panel: boolean;
  hasMap: boolean;
  onCameraBusy: () => () => void;
  /** Отдаление с нижнего упора региона или места (#190): выйти в мир. Камера мира остаётся там же. */
  onLeave?: () => void;
  /** Пользователь сдвинул или приблизил карту свободной камерой (#181): гаснет подсказка жестов. */
  onMove?: () => void;
}

/**
 * Камера карты (ARCHITECTURE A4): измеряет кадр и панель, считает кадр региона или места и анимирует
 * перелёт. Пока камера летит, навигация занята (`onCameraBusy`, SPEC §7.1), а `flying` — true.
 */
export function useCamera({ active, regionBoxes, activePlaceSlug, panel, hasMap, onCameraBusy, onLeave, onMove }: Options) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  /** Экранный слой (#180): подписи и маркеры в том же кадре, но вне растра слоя карты — тот же transform. */
  const screenRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(UNMEASURED);
  /** Камера летит: подсказки ждут посадки, иначе встают у якоря, посчитанного на старте (аудит E13). */
  const [flying, setFlying] = useState(false);
  /** Свободная камера (#165): куда пользователь утянул карту в текущем кадре `shot`. */
  const [free, setFree] = useState<{ shot: unknown; camera: Camera } | null>(null);
  const inWorld = !active;

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

  /** Открытое место с точкой на карте: камера встаёт на него (#192). */
  const placePos = active?.places.find((p) => p.slug === activePlaceSlug)?.pos;
  /** Ключ кадра: смена камеры — перелёт. */
  const camera = useMemo<Camera>(() => {
    if (!active?.layout) return WORLD_CAMERA;
    return placePos ? placeCamera(active.layout.camera, placePos) : active.layout.camera;
  }, [active, placePos]);
  /** Рамка открытого региона — по ней кадр региона и места (`regionFrame`, #192). */
  const box = useMemo(() => (active?.layout ? polygonBox(active.layout.polygon) : undefined), [active]);

  /** Мир с открытой панелью (профиль героя, #97): карта целиком кадрируется в свободную часть слева от панели. */
  const worldPanel = inWorld && panel && view.inset > 0;
  const inset = panel && (active || worldPanel) ? view.inset : 0;
  /** Панель закрывает кадр справа в любом экране: значки нитей не встают под неё. */
  const cover = panel ? view.inset : 0;
  const insetBottom = panel && active ? (view.insetBottom ?? 0) : 0;
  /** Кадр с панелью и шторкой этого экрана: видимая часть, которую камера держит на картинке (#112). */
  const stage = useMemo<View>(() => ({ ...view, inset, insetBottom }), [view, inset, insetBottom]);
  /**
   * Свободная камера: в регионе и месте пустота за краем мира допустима под панелью, в мире — нет (#97).
   * Зум — в пределах уровня (#209): кадры регионов для потолка мира — с панелью и шторкой (`view`), как при перелёте.
   */
  const levels = useMemo(
    () => zoomLevels(regionBoxes, view, box),
    [regionBoxes, view, box],
  );
  /** Потолок мира — и в регионе: от него расстановка названий регионов (#189), она не меняется при перелётах. */
  const worldMax = useMemo(() => (box ? zoomLevels(regionBoxes, view).zoomMax : levels.zoomMax), [box, regionBoxes, view, levels]);
  const roam = useMemo<View>(() => ({ ...(active ? stage : wholeFrame(stage)), ...levels }), [active, stage, levels]);
  const shot = worldPanel ? WORLD_PANEL_SHOT : camera;
  const freeCamera = free && (free.shot === shot || (free.shot === EXIT_SHOT && inWorld)) ? free.camera : null;
  const framed = useMemo(
    () =>
      freeCamera
        ? { camera: clampCamera(freeCamera, roam), offset: 0 }
        : box && stage.layerWidth > 0
          ? regionFrame(box, stage, placePos)
          : frameCamera(camera, stage),
    [freeCamera, camera, stage, roam, box, placePos],
  );
  const target = cameraTransform(framed.camera, framed.offset, framed.offsetY);
  /** Маркеры и подписи — в экранных пикселях, независимо от приближения и размера окна (1 единица SVG = 1 px). */
  const ownFrame = useMemo(() => (box ? regionFrame(box, stage) : null), [box, stage]);
  const regionZoom = ownFrame?.camera.zoom ?? 1;
  /** «Весь мир» в регионе дальше потолка мира не отдаляет (#209) — возвращает к кадру региона. */
  const home = useMemo(
    () => (ownFrame ? centered(ownFrame.camera, roam, ownFrame.offset, ownFrame.offsetY ?? 0) : WORLD_CAMERA),
    [ownFrame, roam],
  );
  const markerScale = (view.layerWidth > 0 ? STAGE_WIDTH / view.layerWidth : 1) / (freeCamera?.zoom ?? regionZoom);
  /** Нити — тоже в экранных px, но при любом приближении (в мире zoom 1). */
  const threadScale = (view.layerWidth > 0 ? STAGE_WIDTH / view.layerWidth : 1) / framed.camera.zoom;
  const worldZoom = framed.camera.zoom;
  const pxScale = (view.layerWidth > 0 ? STAGE_WIDTH / view.layerWidth : 1) / worldZoom;
  const fitted = view.layerWidth * containScale(view);
  const zoomMax = worldMax;

  // Анимация камеры (A3, A4). Пока она идёт, навигация занята: клики ставятся в очередь.
  // Кадр — камера, а в мире ещё и панель: открыли или свернули профиль — карта переезжает (#97).
  const shownCamera = useRef<Camera | typeof WORLD_PANEL_SHOT>(shot);
  const shownTarget = useRef(target);
  const shownRegion = useRef(active?.id);
  const running = useRef<Animation | null>(null);
  /** Камера, которую жест последней поставил в DOM (`useFreeCamera`); сбрасывает перелёт. */
  const applied = useRef<Camera | null>(null);
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
    shownCamera.current = shot;
    shownTarget.current = target;
    shownRegion.current = active?.id;
    // Тот же кадр, другой размер окна — без анимации, transform уже стоит в style.
    if (!el || prevCamera === shot) return;
    applied.current = null;
    if (running.current) {
      // Новый переход посреди старого (кнопка «назад» браузера) — продолжаем с текущего положения.
      from = window.getComputedStyle(el).transform || from;
      running.current.cancel();
      running.current = null;
      screenRef.current?.getAnimations?.().forEach((a) => a.cancel());
    }
    const worldToWorld = prevRegion === undefined && !active;
    const withinRegion = worldToWorld || (prevRegion !== undefined && prevRegion === active?.id);
    const duration = withinRegion
      ? cssDuration('--dur-place') || DURATION.place
      : cssDuration('--dur-camera') || DURATION.region;
    const animation = animateCamera(el, from, target, duration);
    // Экранный слой (#231): группы уже стоят в точках нового кадра, слой летит от «откуда» относительно него к себе.
    const screen = screenRef.current;
    const back = cameraInverse({ ...framed, layerWidth: view.layerWidth });
    const twin = screen ? animateCamera(screen, from === 'none' ? back : `${from} ${back}`, 'none', duration) : null;
    if (!animation) {
      twin?.cancel();
      return;
    }
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
          if (screenRef.current) screenRef.current.style.transform = '';
        }
        release();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- анимируем только смену кадра, не размер окна
  }, [shot]);

  // Экранный слой (#231): группы с якорем — в точки кадра на каждый рендер (жест между рендерами ставит их сам).
  // Рендер, который не догнал жест (`free` ещё со старой камерой, а жест уже поставил новую в DOM), кадр не откатывает:
  // React записал бы слою карты и якорям камеру на кадр-другой назад — подписи и карта разъехались бы до следующего рендера.
  useLayoutEffect(() => {
    const c = applied.current;
    if (c && free?.camera !== c) {
      if (layerRef.current) layerRef.current.style.transform = cameraTransform(c);
      placeAnchors(screenRef.current, { camera: c, layerWidth: view.layerWidth });
    } else placeAnchors(screenRef.current, { ...framed, layerWidth: view.layerWidth });
  });

  // Свободная камера двигает тот же кадр: следующий перелёт начинается с того места, куда карту утянули.
  useLayoutEffect(() => {
    if (!running.current) shownTarget.current = target;
  }, [target]);

  useEffect(() => () => running.current?.cancel(), []);

  // Жесты свободной камеры (#165). React узнаёт о камере не чаще раза в кадр анимации.
  const latest = useRef({ framed, view: roam, shot });
  useLayoutEffect(() => {
    latest.current = { framed, view: roam, shot };
  });
  const pending = useRef<Camera | null>(null);
  const controls = useFreeCamera({
    viewportRef,
    layerRef,
    screenRef,
    view: roam,
    attached: hasMap,
    enabled: hasMap && !flying,
    resetKey: shot,
    home,
    onFloor:
      active && onLeave
        ? (c) => {
            setFree({ shot: EXIT_SHOT, camera: c });
            onLeave();
          }
        : undefined,
    current: () => {
      const { framed: f, view: v } = latest.current;
      return clampCamera(centered(f.camera, v, f.offset, f.offsetY ?? 0), v);
    },
    onChange: (c) => {
      onMove?.();
      if (pending.current === null && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          const next = pending.current;
          pending.current = null;
          if (next) setFree({ shot: latest.current.shot, camera: next });
        });
      }
      pending.current = c;
      applied.current = c;
    },
  });

  const frame: Frame = { view, framed, inset, cover, insetBottom, regionZoom, markerScale, threadScale, pxScale, worldZoom, zoomMax, fitted };
  return { viewportRef, layerRef, screenRef, flying, target, frame, controls, free: freeCamera !== null };
}
