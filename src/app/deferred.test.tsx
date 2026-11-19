import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Отложенные части бандла (#186): до загрузки — ничего (Suspense), после preload — сразу, без Suspense.
vi.unmock('./deferred');
vi.mock('../features/search/HeroSearch', () => ({ HeroSearch: ({ label }: { label: string }) => <p>{label}</p> }));

describe('deferred', () => {
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
});
