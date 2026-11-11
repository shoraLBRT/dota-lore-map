import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { parseHash, serializeRoute, type Route, type Screen } from './router';

type Action = { type: 'sync'; route: Route };

function reducer(state: Route, action: Action): Route {
  // Одинаковый адрес — тот же объект, без лишней перерисовки.
  return serializeRoute(state) === serializeRoute(action.route) ? state : action.route;
}

interface Navigation {
  route: Route;
  /**
   * Перейти на адрес целиком. `replace` — без новой записи в истории браузера
   * (листание галереи: «назад» закрывает её, а не перебирает страницы).
   */
  navigate: (route: Route, options?: { replace?: boolean }) => void;
  /**
   * Сменить экран, сохранив выбранного героя (медиа закрывается).
   * Пока идёт анимация камеры (`hold`), переход ставится в очередь: выполняется последний запрошенный (SPEC §7.1).
   */
  open: (screen: Screen) => void;
  /** Занять навигацию на время анимации камеры; возвращает «отпустить» (повторный вызов безопасен). */
  hold: () => () => void;
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

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      // Переход извне (кнопка «назад» браузера, ручной адрес) важнее очереди.
      if (hash !== ownHash.current) pending.current = null;
      dispatch({ type: 'sync', route: parseHash(hash) });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route, options?: { replace?: boolean }) => {
    const hash = serializeRoute(next);
    ownHash.current = hash;
    if (window.location.hash !== hash) {
      // replaceState не шлёт hashchange — состояние обновляет dispatch ниже.
      if (options?.replace) window.history.replaceState(window.history.state, '', hash);
      else window.location.hash = hash;
    }
    dispatch({ type: 'sync', route: next });
  }, []);

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
