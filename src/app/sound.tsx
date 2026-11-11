import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createSynth, type Sfx, type Synth } from './sfx';

// Звук интерфейса (SPEC §7.4): выбор пользователя, «разблокировка» по первому жесту (политика автовоспроизведения
// браузеров: «Начать» или любой клик/клавиша, если пришли по прямой ссылке) и проигрывание звуков (ARCHITECTURE A12).

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
  /** Сыграть звук, если звук играет; наведение — не чаще раза в HOVER_GAP мс. */
  play: (name: Sfx) => void;
}

/** Минимальный промежуток между звуками наведения, мс: проводка мышью по карте не трещит. */
export const HOVER_GAP = 90;

/** Что считается кликом для звука «клик». */
const CLICKABLE = 'button, a[href], [role="button"], [role="option"]';

const SoundContext = createContext<Sound | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Источник звуков; подменяется в тестах. */
  makeSynth?: () => Synth | null;
}

export function SoundProvider({ children, makeSynth = createSynth }: ProviderProps) {
  const [enabled, setEnabled] = useState(loadEnabled);
  const [unlocked, setUnlocked] = useState(false);
  /** undefined — ещё не создан: AudioContext создаётся только внутри жеста пользователя. */
  const synth = useRef<Synth | null | undefined>(undefined);
  const playing = useRef(false);
  const lastHover = useRef(-Infinity);
  useLayoutEffect(() => {
    playing.current = enabled && unlocked;
  }, [enabled, unlocked]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      saveEnabled(!prev);
      return !prev;
    });
  }, []);
  const unlock = useCallback(() => {
    if (synth.current === undefined) synth.current = makeSynth();
    setUnlocked(true);
  }, [makeSynth]);

  const play = useCallback((name: Sfx) => {
    if (!playing.current || !synth.current) return;
    if (name === 'hover') {
      const now = performance.now();
      if (now - lastHover.current < HOVER_GAP) return;
      lastHover.current = now;
    }
    try {
      synth.current.play(name);
    } catch {
      // Звук — украшение: ошибка аудио не должна ломать интерфейс.
    }
  }, []);

  // По прямой ссылке «Начать» не нажимают — звук разблокирует первый жест на любом экране.
  useEffect(() => {
    if (unlocked) return;
    const onGesture = () => unlock();
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    return () => {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
    };
  }, [unlocked, unlock]);

  // Клик по любому интерактивному элементу — звук «клик» (SPEC §7.4); одно место вместо обработчика в каждой кнопке.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(CLICKABLE)) play('click');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [play]);

  const value = useMemo<Sound>(
    () => ({ enabled, unlocked, playing: enabled && unlocked, toggle, unlock, play }),
    [enabled, unlocked, toggle, unlock, play],
  );
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): Sound {
  const sound = useContext(SoundContext);
  if (!sound) throw new Error('useSound: нет SoundProvider');
  return sound;
}

const silent = () => undefined;

/** Сыграть звук интерфейса; без SoundProvider (изолированные тесты компонентов) — тишина. */
export function useSfx(): (name: Sfx) => void {
  return useContext(SoundContext)?.play ?? silent;
}
