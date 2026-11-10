import { useEffect } from 'react';
import { Intro } from '../features/intro/Intro';
import { WorldScreen } from '../features/world/WorldScreen';
import { I18nProvider } from '../i18n';
import { NavigationProvider, useNavigation } from './navigation';
import { parentScreen } from './router';

function Screens() {
  const { route, open } = useNavigation();
  const { screen } = route;

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

  return screen.name === 'intro' ? <Intro /> : <WorldScreen screen={screen} />;
}

export function App() {
  return (
    <I18nProvider>
      <NavigationProvider>
        <Screens />
      </NavigationProvider>
    </I18nProvider>
  );
}
