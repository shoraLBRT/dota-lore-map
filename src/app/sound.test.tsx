import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { SoundProvider, useSound } from './sound';

const wrapper = ({ children }: { children: ReactNode }) => <SoundProvider>{children}</SoundProvider>;

describe('sound (SPEC §7.4)', () => {
  it('звук играет только после «Начать» и если пользователь его не выключил', () => {
    const { result } = renderHook(() => useSound(), { wrapper });
    expect(result.current).toMatchObject({ enabled: true, unlocked: false, playing: false });
    act(() => result.current.unlock());
    expect(result.current.playing).toBe(true);
    act(() => result.current.toggle());
    expect(result.current).toMatchObject({ enabled: false, playing: false });
  });

  it('выключенный звук помнится между запусками', () => {
    window.localStorage.setItem('dota-lore-map.sound', 'off');
    const { result } = renderHook(() => useSound(), { wrapper });
    act(() => result.current.unlock());
    expect(result.current.playing).toBe(false);
  });
});
