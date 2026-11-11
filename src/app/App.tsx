import { useCallback, useEffect, useState } from 'react';
import { Intro } from '../features/intro/Intro';
import { WorldScreen } from '../features/world/WorldScreen';
import { I18nProvider } from '../i18n';
import { NavigationProvider, useNavigation } from './navigation';
import { parentScreen, type Screen } from './router';
import { SoundProvider, useSound } from './sound';

const WORLD: Screen = { name: 'world' };

function Screens() {
  const { route, open } = useNavigation();
  const { unlock } = useSound();
  const { screen } = route;
  // A1 идёт уже на адресе #/world: интро остаётся поверх мира, пока облака не разъедутся.
  const [introLeaving, setIntroLeaving] = useState(false);
  const onIntro = screen.name === 'intro';

  // Esc — на уровень вверх: место → регион → мир (SPEC §5.1).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const parent = parentScreen(screen);
      if (parent !== screen) open(parent);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, open]);

  const start = useCallback(() => {
    unlock(); // SPEC §5.2: «Начать» включает звуки, если пользователь их не выключил.
    setIntroLeaving(true);
    open(WORLD);
  }, [unlock, open]);
  const left = useCallback(() => setIntroLeaving(false), []);

  return (
    <>
      <WorldScreen screen={onIntro ? WORLD : screen} veiled={onIntro} />
      {(onIntro || introLeaving) && <Intro leaving={!onIntro && introLeaving} onStart={start} onLeft={left} />}
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
