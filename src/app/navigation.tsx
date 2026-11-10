import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { parseHash, serializeRoute, type Route, type Screen } from './router';

type Action = { type: 'sync'; route: Route };

function reducer(state: Route, action: Action): Route {
  // Одинаковый адрес — тот же объект, без лишней перерисовки.
  return serializeRoute(state) === serializeRoute(action.route) ? state : action.route;
}

interface Navigation {
  route: Route;
  /** Перейти на адрес целиком. */
  navigate: (route: Route) => void;
  /** Сменить экран, сохранив выбранного героя (медиа закрывается). */
  open: (screen: Screen) => void;
}

const NavigationContext = createContext<Navigation | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [route, dispatch] = useReducer(reducer, undefined, () => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => dispatch({ type: 'sync', route: parseHash(window.location.hash) });
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    const hash = serializeRoute(next);
    if (window.location.hash !== hash) window.location.hash = hash;
    dispatch({ type: 'sync', route: next });
  }, []);

  const open = useCallback(
    (screen: Screen) => navigate(route.hero ? { screen, hero: route.hero } : { screen }),
    [navigate, route.hero],
  );

  const value = useMemo(() => ({ route, navigate, open }), [route, navigate, open]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): Navigation {
  const nav = useContext(NavigationContext);
  if (!nav) throw new Error('useNavigation: нет NavigationProvider');
  return nav;
}
