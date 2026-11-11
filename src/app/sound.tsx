import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// Состояние звука (SPEC §7.4). Сами звуки — E9; здесь только выбор пользователя и «разблокировка»
// после клика «Начать» (политика автовоспроизведения браузеров).

const STORAGE_KEY = 'dota-lore-map.sound';

function loadEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Без localStorage выбор не переживёт перезагрузку.
  }
}

interface Sound {
  /** Пользователь не выключил звук. */
  enabled: boolean;
  /** Был жест пользователя («Начать»), звуки можно играть. */
  unlocked: boolean;
  /** Звук реально играет: включён и разблокирован. */
  playing: boolean;
  toggle: () => void;
  unlock: () => void;
}

const SoundContext = createContext<Sound | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(loadEnabled);
  const [unlocked, setUnlocked] = useState(false);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      saveEnabled(!prev);
      return !prev;
    });
  }, []);
  const unlock = useCallback(() => setUnlocked(true), []);

  const value = useMemo<Sound>(
    () => ({ enabled, unlocked, playing: enabled && unlocked, toggle, unlock }),
    [enabled, unlocked, toggle, unlock],
  );
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): Sound {
  const sound = useContext(SoundContext);
  if (!sound) throw new Error('useSound: нет SoundProvider');
  return sound;
}
