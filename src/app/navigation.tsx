import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { parseHash, serializeRoute, type Route, type Screen } from './router';

type Action = { type: 'sync'; route: Route };

function reducer(state: Route, action: Action): Route {
  // Одинаковый адрес — тот же объект, без лишней перерисовки.
  return serializeRoute(state) === serializeRoute(action.route) ? state : action.route;
}

interface NavigateOptions {
  replace?: boolean;
}

interface Navigation {
  route: Route;
  /**
   * Перейти на адрес целиком. `replace` — без новой записи в истории браузера
   * (листание галереи: «назад» закрывает её, а не перебирает страницы; закрытие профиля и героя).
   * Адрес прошлой записи истории — шаг назад (`history.back()`), а не новая запись (A5, #182): Esc, крестик
   * и крошка ведут туда же, куда «назад» браузера, и закрытое окно «назадом» не возвращается.
   */
  navigate: (route: Route, options?: NavigateOptions) => void;
  /**
   * Сменить экран, сохранив выбранного героя (медиа закрывается).
   * Пока идёт анимация камеры (`hold`), переход ставится в очередь: выполняется последний запрошенный (SPEC §7.1).
   */
  open: (screen: Screen) => void;
  /** Занять навигацию на время анимации камеры; возвращает «отпустить» (повторный вызов безопасен). */
  hold: () => () => void;
}

/** Ключ `history.state`: адрес записи, с которой на эту пришли нашим переходом. */
const PREV = 'dlmPrev';
/** Сколько ждать hashchange после `history.back()`, прежде чем снова принимать переходы. */
const BACK_TIMEOUT = 500;

function prevHash(state: unknown): string | null {
  const prev = state && typeof state === 'object' ? (state as Record<string, unknown>)[PREV] : undefined;
  return typeof prev === 'string' ? serializeRoute(parseHash(prev)) : null;
}

const NavigationContext = createContext<Navigation | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [route, dispatch] = useReducer(reducer, undefined, () => parseHash(window.location.hash));
  const routeRef = useRef(route);
  useLayoutEffect(() => {
    routeRef.current = route;
  }, [route]);
  const holds = useRef(0);
  const pending = useRef<Screen | null>(null);
  /** Hash, который поставили мы сами: его hashchange не считается внешним переходом. */
  const ownHash = useRef<string | null>(null);
  /** Ждём hashchange от своего `history.back()`: до него история старая, следующий переход ждёт его. */
  const backing = useRef<number | null>(null);
  const queued = useRef<[Route, NavigateOptions | undefined] | null>(null);
  const navigateRef = useRef<(next: Route, options?: NavigateOptions) => void>(() => undefined);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      if (backing.current !== null) {
        window.clearTimeout(backing.current);
        backing.current = null;
        // Переход, запрошенный, пока шёл шаг назад (два Esc подряд), — теперь, от новой записи истории.
        const next = queued.current;
        queued.current = null;
        if (next) return navigateRef.current(...next);
      } else if (hash !== ownHash.current) pending.current = null; // Переход извне («назад», ручной адрес) важнее очереди.
      dispatch({ type: 'sync', route: parseHash(hash) });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route, options?: NavigateOptions) => {
    if (backing.current !== null) {
      queued.current = [next, options];
      dispatch({ type: 'sync', route: next });
      return;
    }
    const hash = serializeRoute(next);
    ownHash.current = hash;
    const here = window.location.hash;
    if (here !== hash) {
      if (prevHash(window.history.state) === hash) {
        // Туда, откуда пришли, — шаг назад по истории; hashchange придёт следом с тем же адресом, что и dispatch ниже.
        backing.current = window.setTimeout(() => {
          // hashchange так и не пришёл — история не наша; отложенный переход выполняем как есть.
          backing.current = null;
          const late = queued.current;
          queued.current = null;
          if (late) navigateRef.current(...late);
        }, BACK_TIMEOUT);
        window.history.back();
      } else if (options?.replace) {
        // replaceState и pushState не шлют hashchange — состояние обновляет dispatch ниже.
        window.history.replaceState(window.history.state, '', hash);
      } else {
        window.history.pushState({ [PREV]: here }, '', hash);
      }
    }
    dispatch({ type: 'sync', route: next });
  }, []);
  useLayoutEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const go = useCallback(
    (screen: Screen) => {
      const hero = routeRef.current.hero;
      navigate(hero ? { screen, hero } : { screen });
    },
    [navigate],
  );

  const open = useCallback(
    (screen: Screen) => {
      if (holds.current > 0) {
        pending.current = screen;
        return;
      }
      go(screen);
    },
    [go],
  );

  const hold = useCallback(() => {
    holds.current += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holds.current -= 1;
      const next = pending.current;
      if (holds.current === 0 && next) {
        pending.current = null;
        go(next);
      }
    };
  }, [go]);

  const value = useMemo(() => ({ route, navigate, open, hold }), [route, navigate, open, hold]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): Navigation {
  const nav = useContext(NavigationContext);
  if (!nav) throw new Error('useNavigation: нет NavigationProvider');
  return nav;
}
