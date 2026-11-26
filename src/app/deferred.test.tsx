import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Отложенные части бандла (#186): до загрузки — ничего (Suspense), после preload — сразу, без Suspense.
vi.unmock('./deferred');
vi.mock('../features/search/HeroSearch', () => ({
  HeroSearch: ({ label }: { label: string }) => (
    <>
      <p>{label}</p>
      <input aria-label="поле" />
    </>
  ),
}));

describe('deferred', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('рисует компонент после загрузки куска; после preload — синхронно', async () => {
    const { HeroSearch, preloadDeferred } = await import('./deferred');
    const Search = HeroSearch as unknown as (p: { label: string }) => JSX.Element;
    const first = render(<Search label="раз" />);
    expect(await screen.findByText('раз')).toBeInTheDocument();
    first.unmount();
    await preloadDeferred();
    render(<Search label="два" />);
    expect(screen.getByText('два')).toBeInTheDocument();
  });

  it('показанный до загрузки компонент не пересоздаётся, когда кусок догрузился: набранное остаётся', async () => {
    const { HeroSearch } = await import('./deferred');
    const Search = HeroSearch as unknown as (p: { label: string }) => JSX.Element;
    const view = render(<Search label="раз" />);
    const field = await screen.findByRole('textbox', { name: 'поле' });
    fireEvent.change(field, { target: { value: 'a' } });
    // Родитель перерисовался уже после загрузки куска — например, поиск показал героя на карте (CI, #260).
    view.rerender(<Search label="два" />);
    expect(screen.getByText('два')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'поле' })).toBe(field);
    expect(field).toHaveValue('a');
  });
});
