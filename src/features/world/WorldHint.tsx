import { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from '../../app/media';
import { cssDuration } from '../../app/motion';
import { useT } from '../../i18n';
import styles from './WorldHint.module.css';

// Подсказки мира при первом входе (SPEC §5.3), по очереди:
// 1. «Карту можно двигать» (#181) — жест в середине кадра; гаснет от первого сдвига или зума камеры
//    (или когда открыт регион) и больше не показывается.
// 2. «Выберите регион…» (аудит E13, SPEC §8.6) — строка внизу кадра; гаснет после первого наведения на регион,
//    фокуса или нажатия.
// Что уже видели, помнит localStorage.

export const HINT_STORAGE_KEY = 'dota-lore-map.world-hint';
export const MOVE_HINT_STORAGE_KEY = 'dota-lore-map.move-hint';

/** Мышь или палец: текст и жест подсказки (#181). Телефон и планшет без мыши — палец. */
export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';

function loadSeen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'seen';
  } catch {
    return false;
  }
}

function saveSeen(key: string) {
  try {
    window.localStorage.setItem(key, 'seen');
  } catch {
    // Без localStorage подсказка покажется снова после перезагрузки — не страшно.
  }
}

export type HintState = 'shown' | 'leaving' | 'gone';

/** Состояние одноразовой подсказки: `dismiss` гасит её и запоминает в localStorage под `key`. */
export function useOnceHint(key: string) {
  const [state, setState] = useState<HintState>(() => (loadSeen(key) ? 'gone' : 'shown'));
  const dismiss = useCallback(() => {
    setState((s) => {
      if (s !== 'shown') return s;
      saveSeen(key);
      return 'leaving';
    });
  }, [key]);
  useEffect(() => {
    if (state !== 'leaving') return;
    const timer = window.setTimeout(() => setState('gone'), cssDuration('--dur-fade'));
    return () => window.clearTimeout(timer);
  }, [state]);
  return { state, dismiss };
}

/** Подсказка «выберите регион». */
export const useWorldHint = () => useOnceHint(HINT_STORAGE_KEY);
/** Подсказка «карту можно двигать» (#181). */
export const useMoveHint = () => useOnceHint(MOVE_HINT_STORAGE_KEY);

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/** Строка внизу кадра; `state` — из useWorldHint. */
export function WorldHint({ state }: { state: HintState }) {
  const { t } = useT();
  if (state === 'gone') return null;
  return (
    <p className={cls(styles.hint, state === 'leaving' && styles.leaving)} data-testid="world-hint">
      {t('world.hint')}
    </p>
  );
}

/**
 * Жест «карту можно двигать» (#181): мышь, которая тянет карту и крутит колесо, или палец с щипком —
 * без стрелок (просьба владельца). Ниже — строка текста, с мышью ещё и клавиши. Reduced motion — жест стоит.
 */
export function MoveHint({ state }: { state: HintState }) {
  const { t } = useT();
  const touch = useMediaQuery(TOUCH_QUERY);
  if (state === 'gone') return null;
  return (
    <div className={cls(styles.move, state === 'leaving' && styles.leaving)} data-testid="move-hint" data-input={touch ? 'touch' : 'mouse'}>
      <svg className={styles.glyph} viewBox="0 0 64 48" aria-hidden="true" focusable="false">
        {touch ? (
          <g className={styles.pinch}>
            <circle className={styles.fingerA} cx="26" cy="24" r="6" />
            <circle className={styles.fingerB} cx="38" cy="24" r="6" />
          </g>
        ) : (
          <g className={styles.mouse}>
            <rect x="22" y="6" width="20" height="32" rx="10" />
            <line x1="32" y1="6" x2="32" y2="18" />
            <rect className={styles.wheel} x="30" y="10" width="4" height="6" rx="2" />
          </g>
        )}
      </svg>
      <p className={styles.moveText}>{t(touch ? 'world.move.touch' : 'world.move.mouse')}</p>
      {!touch && <p className={styles.moveKeys}>{t('world.move.keys')}</p>}
    </div>
  );
}
