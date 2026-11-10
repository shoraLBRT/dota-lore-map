import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Hero } from '../data/types';
import { I18nProvider } from '../i18n';
import { HeroPortrait } from './HeroPortrait';

const cm: Hero = { key: 'crystal_maiden', name: 'Crystal Maiden', slug: 'crystalmaiden', links: [] };

describe('HeroPortrait', () => {
  it('портрет с CDN, ссылка в новой вкладке, подсказка с именем, заглушка при ошибке', () => {
    const { container } = render(
      <I18nProvider initialLang="en">
        <HeroPortrait hero={cm} />
      </I18nProvider>,
    );
    const link = screen.getByRole('link', { name: /Crystal Maiden/ });
    expect(link).toHaveAttribute('href', 'https://www.dota2.com/hero/crystalmaiden?l=english');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Crystal Maiden');

    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toContain('/heroes/crystal_maiden.png');
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('hero-fallback')).toHaveTextContent('C');
  });
});
