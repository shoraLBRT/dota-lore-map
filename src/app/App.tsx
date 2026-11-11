import { useCallback, useEffect, useState } from 'react';
import { Gallery } from '../features/gallery/Gallery';
import { galleryOf } from '../features/gallery/items';
import { Intro } from '../features/intro/Intro';
import { WorldScreen } from '../features/world/WorldScreen';
import { I18nProvider } from '../i18n';
import { NavigationProvider, useNavigation } from './navigation';
import { parentScreen, type Screen } from './router';
import { SoundProvider, useSound } from './sound';

const WORLD: Screen = { name: 'world' };

function Screens() {
  const { route, open, navigate } = useNavigation();
  const { unlock } = useSound();
  const { screen } = route;
  // A1 идёт уже на адресе #/world: интро остаётся поверх мира, пока облака не разъедутся.
  const [introLeaving, setIntroLeaving] = useState(false);
  const onIntro = screen.name === 'intro';
  const gallery = onIntro ? null : galleryOf(route);
  const galleryOpen = gallery !== null;

  // Esc — на уровень вверх: место → регион → мир (SPEC §5.1). Открыта галерея — Esc закрывает только её.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || galleryOpen) return;
      const parent = parentScreen(screen);
      if (parent !== screen) open(parent);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, open, galleryOpen]);

  const start = useCallback(() => {
    unlock(); // SPEC §5.2: «Начать» включает звуки, если пользователь их не выключил.
    setIntroLeaving(true);
    open(WORLD);
  }, [unlock, open]);
  const left = useCallback(() => setIntroLeaving(false), []);
  // Листание и закрытие галереи не добавляют записей в историю: «назад» браузера ведёт к прошлому экрану.
  const selectMedia = useCallback((media: string) => navigate({ ...route, media }, { replace: true }), [navigate, route]);
  const closeGallery = useCallback(
    () => navigate(route.hero ? { screen: route.screen, hero: route.hero } : { screen: route.screen }, { replace: true }),
    [navigate, route],
  );

  return (
    <>
      <WorldScreen screen={onIntro ? WORLD : screen} veiled={onIntro} />
      {(onIntro || introLeaving) && <Intro leaving={!onIntro && introLeaving} onStart={start} onLeft={left} />}
      {gallery && <Gallery items={gallery.items} index={gallery.index} onSelect={selectMedia} onClose={closeGallery} />}
    </>
  );
}

export function App() {
  return (
    <I18nProvider>
      <SoundProvider>
        <NavigationProvider>
          <Screens />
        </NavigationProvider>
      </SoundProvider>
    </I18nProvider>
  );
}
