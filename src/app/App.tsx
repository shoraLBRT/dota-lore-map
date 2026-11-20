import { useCallback, useEffect, useState } from 'react';
import { FeedbackProvider, useFeedback } from '../features/feedback/FeedbackProvider';
import { galleryOf } from '../features/gallery/items';
import { Intro } from '../features/intro/Intro';
import { WorldScreen } from '../features/world/WorldScreen';
import { I18nProvider } from '../i18n';
import { Gallery, prefetchDeferred } from './deferred';
import { NavigationProvider, useNavigation } from './navigation';
import { parentScreen, type Screen } from './router';
import { SoundProvider, useSound } from './sound';

const WORLD: Screen = { name: 'world' };

function Screens() {
  const { route, open, navigate } = useNavigation();
  const { unlock } = useSound();
  const feedback = useFeedback();
  const { screen } = route;
  // A1 идёт уже на адресе #/world: интро остаётся поверх мира, пока облака не разъедутся.
  const [introLeaving, setIntroLeaving] = useState(false);
  const onIntro = screen.name === 'intro';
  const gallery = onIntro ? null : galleryOf(route);
  const galleryOpen = gallery !== null;

  // Esc — по порядку: окно обратной связи (обычно закрывается само; здесь — если фокус ушёл из окна, A16);
  // галерея закрывается сама; открыт профиль — закрыть его, герой остаётся (SPEC §6.8);
  // выбран герой — снять выбор (SPEC §6.5); иначе на уровень вверх: место → регион → мир (SPEC §5.1).
  const hero = route.hero;
  const profileOpen = Boolean(route.hero && route.profile);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (feedback.isOpen) {
        feedback.close();
        return;
      }
      if (galleryOpen) return;
      if (hero && profileOpen) {
        navigate({ screen, hero }, { replace: true });
        return;
      }
      if (hero) {
        navigate({ screen }, { replace: true });
        return;
      }
      const parent = parentScreen(screen);
      if (parent !== screen) open(parent);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, open, navigate, galleryOpen, hero, profileOpen, feedback]);

  const start = useCallback(() => {
    unlock(); // SPEC §5.2: «Начать» включает звуки, если пользователь их не выключил.
    setIntroLeaving(true);
    open(WORLD);
  }, [unlock, open]);
  const left = useCallback(() => setIntroLeaving(false), []);
  useEffect(prefetchDeferred, []);
  // Листание и закрытие галереи не добавляют записей в историю: «назад» браузера ведёт к прошлому экрану.
  const selectMedia = useCallback((media: string) => navigate({ ...route, media }, { replace: true }), [navigate, route]);
  const closeGallery = useCallback(
    // Профиль и выбранный герой остаются: галерея открыта поверх них.
    () => navigate({ ...route, media: undefined }, { replace: true }),
    [navigate, route],
  );

  return (
    <>
      <WorldScreen screen={onIntro ? WORLD : screen} veiled={onIntro} unveiling={!onIntro && introLeaving} />
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
          <FeedbackProvider>
            <Screens />
          </FeedbackProvider>
        </NavigationProvider>
      </SoundProvider>
    </I18nProvider>
  );
}
