// Hash-адреса (ARCHITECTURE A5):
//   #/                     интро
//   #/world                мир
//   #/r/<regionId>         регион
//   #/r/<regionId>/<slug>  место
//   ?hero=<key>&media=<id> поверх любого адреса (внутри hash: #/r/icewrack?hero=crystal_maiden)
//   ?hero=<key>&profile    открыт профиль героя (E15, A15); без флага герой только выбран

export type Screen =
  | { name: 'intro' }
  | { name: 'world' }
  | { name: 'region'; regionId: string }
  | { name: 'place'; regionId: string; placeSlug: string };

export interface Route {
  screen: Screen;
  hero?: string;
  /** Профиль героя открыт (флаг `profile` без значения, только вместе с `hero`; A15). */
  profile?: boolean;
  media?: string;
}

export const INTRO: Route = { screen: { name: 'intro' } };

function decode(part: string): string | null {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

export function parseHash(hash: string): Route {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  const q = body.indexOf('?');
  const path = q >= 0 ? body.slice(0, q) : body;
  const params = new URLSearchParams(q >= 0 ? body.slice(q + 1) : '');

  const parts = path
    .split('/')
    .filter((p) => p !== '')
    .map(decode);

  let screen: Screen = { name: 'intro' };
  if (parts.some((p) => p === null)) {
    screen = { name: 'intro' };
  } else if (parts.length === 1 && parts[0] === 'world') {
    screen = { name: 'world' };
  } else if (parts[0] === 'r' && parts.length === 2) {
    screen = { name: 'region', regionId: parts[1]! };
  } else if (parts[0] === 'r' && parts.length === 3) {
    screen = { name: 'place', regionId: parts[1]!, placeSlug: parts[2]! };
  }

  const route: Route = { screen };
  const hero = params.get('hero');
  const media = params.get('media');
  if (hero) route.hero = hero;
  if (hero && params.has('profile')) route.profile = true;
  if (media) route.media = media;
  return route;
}

export function serializeRoute(route: Route): string {
  const s = route.screen;
  let path: string;
  switch (s.name) {
    case 'intro':
      path = '/';
      break;
    case 'world':
      path = '/world';
      break;
    case 'region':
      path = `/r/${encodeURIComponent(s.regionId)}`;
      break;
    case 'place':
      path = `/r/${encodeURIComponent(s.regionId)}/${encodeURIComponent(s.placeSlug)}`;
      break;
  }
  const parts: string[] = [];
  if (route.hero) parts.push(new URLSearchParams({ hero: route.hero }).toString());
  if (route.hero && route.profile) parts.push('profile');
  if (route.media) parts.push(new URLSearchParams({ media: route.media }).toString());
  const query = parts.join('&');
  return `#${path}${query ? `?${query}` : ''}`;
}

/** На уровень вверх (Esc, кнопка «назад»): место → регион → мир. */
export function parentScreen(screen: Screen): Screen {
  switch (screen.name) {
    case 'place':
      return { name: 'region', regionId: screen.regionId };
    case 'region':
      return { name: 'world' };
    default:
      return screen;
  }
}
