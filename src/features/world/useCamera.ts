import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cssDuration, cssPixels } from '../../app/motion';
import type { Camera, Region } from '../../data/types';
import {
  animateCamera,
  cameraTransform,
  DURATION,
  frameCamera,
  MOBILE_QUERY,
  placeCamera,
  SHEET_PEEK,
  STAGE_WIDTH,
  UNMEASURED,
  WORLD_CAMERA,
  worldListLayout,
  type View,
} from './camera';

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
}

interface Options {
  /** Открытый регион с геометрией; нет — мир. */
  active: Region | undefined;
  activePlaceSlug: string | undefined;
  /** Справа кадр закрыт панелью (ARCHITECTURE A4). */
  panel: boolean;
  /** Телефон: в мире карта прижата к верху, под ней — список регионов (#39). */
  regionList: boolean;
  topInset: number;
  hasMap: boolean;
  onCameraBusy: () => () => void;
}

/**
 * Камера карты (ARCHITECTURE A4): измеряет кадр и панель, считает кадр региона или места и анимирует
 * перелёт. Пока камера летит, навигация занята (`onCameraBusy`, SPEC §7.1), а `flying` — true.
 */
export function useCamera({ active, activePlaceSlug, panel, regionList, topInset, hasMap, onCameraBusy }: Options) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(UNMEASURED);
  /** Камера летит: подсказки ждут посадки, иначе встают у якоря, посчитанного на старте (аудит E13). */
  const [flying, setFlying] = useState(false);
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

  const camera = useMemo<Camera>(() => {
    if (!active?.layout) return WORLD_CAMERA;
    const pos = active.places.find((p) => p.slug === activePlaceSlug)?.pos;
    return pos ? placeCamera(active.layout.camera, pos) : active.layout.camera;
  }, [active, activePlaceSlug]);

  const inset = panel && active ? view.inset : 0;
  /** Панель закрывает кадр справа и в мире (профиль героя, E15): камера мира не двигается, но значки нитей не встают под неё. */
  const cover = panel ? view.inset : 0;
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

  const frame: Frame = { view, framed, inset, cover, insetBottom, regionZoom, markerScale, threadScale };
  return { viewportRef, layerRef, flying, listLayout, target, frame };
}
