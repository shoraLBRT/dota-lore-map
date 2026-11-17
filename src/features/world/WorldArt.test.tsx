import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Region } from '../../data/types';
import { I18nProvider } from '../../i18n';
import { BIOME_COLORS } from './biomes';
import { MapStage } from './MapStage';

// Картинка мира под полигонами (#110, ARCHITECTURE A10). В остальных тестах WORLD_ART = undefined (src/test/setup.ts).
vi.mock('./art', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./art')>()),
  WORLD_ART: '/map/world-2560.webp',
}));

const region = (id: string, x: number): Region => ({
  id,
  tier: 'continent',
  side: 'neutral',
  name: { ru: `${id} ru`, en: `${id} en` },
  geo: '',
  biome: 'snow',
  places: [],
  regionHeroes: [],
  layout: {
    polygon: [
      [x, 0.1],
      [x + 0.2, 0.1],
      [x + 0.1, 0.3],
    ],
    label: [x + 0.1, 0.2],
    camera: { x: x + 0.1, y: 0.2, zoom: 3 },
  },
});

function show(activeRegionId?: string) {
  render(
    <I18nProvider initialLang="en">
      <MapStage
        regions={[region('a', 0.1), region('b', 0.5)]}
        activeRegionId={activeRegionId}
        heroesOfSpot={() => []}
        onSelectRegion={vi.fn()}
        onSelectPlace={vi.fn()}
        heroesOf={() => []}
      />
    </I18nProvider>,
  );
}

describe('MapStage — картинка мира', () => {
  it('рисует картинку под прозрачными полигонами-кнопками', () => {
    show();
    const art = screen.getByTestId('world-art');
    expect(art).toHaveAttribute('href', '/map/world-2560.webp');
    expect(art).toHaveAttribute('aria-hidden', 'true');
    const polygon = screen.getByRole('button', { name: 'a en' });
    // Картинка — первым слоем SVG, полигоны над ней.
    expect(art.compareDocumentPosition(polygon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(polygon).not.toHaveAttribute('fill');
    expect(polygon.getAttribute('class')).toMatch(/onArt/);
  });

  it('в регионе соседи затемняются заливкой поверх картинки', () => {
    show('a');
    const b = document.querySelector('polygon[data-region="b"]')!;
    expect(b.getAttribute('class')).toMatch(/onArt/);
    expect(b.getAttribute('class')).toMatch(/dimmed/);
  });

  it('картинка не загрузилась — возвращается процедурная заглушка', () => {
    show();
    fireEvent.error(screen.getByTestId('world-art'));
    expect(screen.queryByTestId('world-art')).toBeNull();
    const polygon = screen.getByRole('button', { name: 'a en' });
    expect(polygon).toHaveAttribute('fill', BIOME_COLORS.snow);
    expect(polygon.getAttribute('class')).not.toMatch(/onArt/);
  });
});
