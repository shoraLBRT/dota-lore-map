import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NavigationProvider, useNavigation } from './navigation';

type Nav = ReturnType<typeof useNavigation>;

function setup() {
  const ref: { nav: Nav | null } = { nav: null };
  function Probe() {
    ref.nav = useNavigation();
    return null;
  }
  render(
    <NavigationProvider>
      <Probe />
    </NavigationProvider>,
  );
  return () => ref.nav!;
}

describe('навигация: очередь на время анимации камеры (SPEC §7.1)', () => {
  it('без анимации open переходит сразу', () => {
    const nav = setup();
    act(() => nav().open({ name: 'world' }));
    expect(window.location.hash).toBe('#/world');
    expect(nav().route.screen).toEqual({ name: 'world' });
  });

  it('во время анимации переходы ждут, после неё выполняется последний', () => {
    const nav = setup();
    act(() => nav().open({ name: 'world' }));
    let release = () => {};
    act(() => {
      release = nav().hold();
    });
    act(() => nav().open({ name: 'region', regionId: 'icewrack' }));
    act(() => nav().open({ name: 'region', regionId: 'tomokan' }));
    expect(window.location.hash).toBe('#/world');

    act(() => release());
    expect(window.location.hash).toBe('#/r/tomokan');
    // Повторный release ничего не ломает.
    act(() => release());
    act(() => nav().open({ name: 'world' }));
    expect(window.location.hash).toBe('#/world');
  });

  it('переход извне (кнопка «назад» браузера) отменяет очередь', async () => {
    const nav = setup();
    act(() => nav().open({ name: 'world' }));
    let release = () => {};
    act(() => {
      release = nav().hold();
    });
    act(() => nav().open({ name: 'region', regionId: 'icewrack' }));
    await act(async () => {
      window.location.hash = '#/r/tomokan';
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(nav().route.screen).toEqual({ name: 'region', regionId: 'tomokan' });
    act(() => release());
    expect(window.location.hash).toBe('#/r/tomokan');
  });
});
