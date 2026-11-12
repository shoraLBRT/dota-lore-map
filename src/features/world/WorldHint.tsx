import { useCallback, useEffect, useState } from 'react';
import { cssDuration } from '../../app/motion';
import { useT } from '../../i18n';
import styles from './WorldHint.module.css';

// Подсказка в мире при первом входе (аудит E13, SPEC §8.6): «Выберите регион…» внизу кадра.
// Гаснет после первого наведения на регион, фокуса или нажатия и больше не показывается (localStorage).

export const HINT_STORAGE_KEY = 'dota-lore-map.world-hint';

function loadSeen(): boolean {
  try {
    return window.localStorage.getItem(HINT_STORAGE_KEY) === 'seen';
  } catch {
    return false;
  }
}

function saveSeen() {
  try {
    window.localStorage.setItem(HINT_STORAGE_KEY, 'seen');
  } catch {
    // Без localStorage подсказка покажется снова после перезагрузки — не страшно.
  }
}

type HintState = 'shown' | 'leaving' | 'gone';

/** Состояние подсказки и «пользователь уже нашёл регионы» — гасит её и запоминает. */
export function useWorldHint() {
  const [state, setState] = useState<HintState>(() => (loadSeen() ? 'gone' : 'shown'));
  const dismiss = useCallback(() => {
    setState((s) => {
      if (s !== 'shown') return s;
      saveSeen();
      return 'leaving';
    });
  }, []);
  useEffect(() => {
    if (state !== 'leaving') return;
    const timer = window.setTimeout(() => setState('gone'), cssDuration('--dur-fade'));
    return () => window.clearTimeout(timer);
  }, [state]);
  return { state, dismiss };
}

/** Строка внизу кадра; `state` — из useWorldHint. */
export function WorldHint({ state }: { state: HintState }) {
  const { t } = useT();
  if (state === 'gone') return null;
  return (
    <p className={[styles.hint, state === 'leaving' && styles.leaving].filter(Boolean).join(' ')} data-testid="world-hint">
      {t('world.hint')}
    </p>
  );
}
