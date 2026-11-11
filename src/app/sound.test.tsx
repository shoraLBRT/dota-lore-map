import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HOVER_GAP, SoundProvider, useSfx, useSound } from './sound';

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

describe('звуки интерфейса (SPEC §7.4)', () => {
  const setup = () => {
    const played: string[] = [];
    let created = 0;
    const makeSynth = () => {
      created += 1;
      return { play: (name: string) => played.push(name) };
    };
    const w = ({ children }: { children: ReactNode }) => <SoundProvider makeSynth={makeSynth}>{children}</SoundProvider>;
    const hook = renderHook(() => useSound(), { wrapper: w });
    return { played, created: () => created, hook };
  };

  it('до разблокировки — тишина и синтезатор не создаётся; после — играет; выключенный — молчит', () => {
    const { played, created, hook } = setup();
    act(() => hook.result.current.play('panel'));
    expect(played).toEqual([]);
    expect(created()).toBe(0);
    act(() => hook.result.current.unlock());
    act(() => hook.result.current.play('panel'));
    expect(played).toEqual(['panel']);
    act(() => hook.result.current.toggle());
    act(() => hook.result.current.play('gallery'));
    expect(played).toEqual(['panel']);
    expect(created()).toBe(1);
  });

  it('первый жест на любом экране разблокирует звук (прямая ссылка без «Начать»)', () => {
    const { hook } = setup();
    expect(hook.result.current.unlocked).toBe(false);
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    expect(hook.result.current.unlocked).toBe(true);
  });

  it('клик по кнопке или ссылке — звук «клик», по пустому месту — нет', () => {
    const { played, hook } = setup();
    act(() => hook.result.current.unlock());
    const button = document.createElement('button');
    const div = document.createElement('div');
    document.body.append(button, div);
    act(() => {
      button.click();
      div.click();
    });
    expect(played).toEqual(['click']);
    button.remove();
    div.remove();
  });

  it('наведение не чаще раза в HOVER_GAP мс', () => {
    const { played, hook } = setup();
    act(() => hook.result.current.unlock());
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    act(() => {
      hook.result.current.play('hover');
      hook.result.current.play('hover');
    });
    now.mockReturnValue(1000 + HOVER_GAP);
    act(() => hook.result.current.play('hover'));
    expect(played).toEqual(['hover', 'hover']);
    now.mockRestore();
  });

  it('без провайдера useSfx — тишина, а не ошибка', () => {
    const { result } = renderHook(() => useSfx());
    expect(() => result.current('click')).not.toThrow();
  });
});
