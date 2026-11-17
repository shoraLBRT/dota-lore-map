import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { parseHash } from '../../app/router';
import type { Place } from '../../data/types';
import { getRegion, placeName } from '../../data/world';
import { PLACES_SHOWN, sortPlaces } from './PlaceList';

// Список мест в панели региона (#99, SPEC §5.4 п. 7).

const stonehall = getRegion('stonehall')!;
const rows = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-place-row]'));

const place = (name: string, extra: Partial<Place> = {}): Place => ({
  name,
  slug: name.toLowerCase(),
  capital: false,
  placement: 'ours',
  ...extra,
});

describe('список мест в панели региона (#99)', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('порядок: столица, места событий, обычные, второстепенные; внутри — по алфавиту без кавычек', () => {
    const list = [
      place('Delta', { significance: 'minor' }),
      place('Bravo'),
      place('Alpha', { significance: 'minor' }),
      place('Zulu', { capital: true }),
      place('Echo', { significance: 'event' }),
      place('Charlie', { significance: 'link' }),
      place('«Alpine»', { significance: 'link' }),
    ];
    expect(sortPlaces(list, 'en').map((p) => p.name)).toEqual(['Zulu', 'Echo', '«Alpine»', 'Bravo', 'Charlie', 'Alpha', 'Delta']);
  });

  it('Стоунхолл: первые 8 мест и «Все места (24)», раскрытие показывает все и ставит фокус на девятое', async () => {
    window.location.hash = '#/r/stonehall';
    render(<App />);
    const list = screen.getByTestId('place-list');
    expect(within(list).getByRole('heading', { name: 'Места' })).toBeInTheDocument();
    expect(rows()).toHaveLength(PLACES_SHOWN);
    const sorted = sortPlaces(stonehall.places, 'ru');
    expect(rows().map((r) => r.dataset.placeRow)).toEqual(sorted.slice(0, PLACES_SHOWN).map((p) => p.slug));
    // Имя кнопки начинается с видимого названия (WCAG 2.5.3); столица названа для диктора.
    const capital = sorted[0]!;
    expect(capital.capital).toBe(true);
    expect(rows()[0]!.textContent).toMatch(new RegExp(`^${placeName(capital, 'ru')}, столица`));

    act(() => {
      within(list).getByRole('button', { name: `Все места (${stonehall.places.length})` }).click();
    });
    expect(rows()).toHaveLength(stonehall.places.length);
    expect(within(list).queryByRole('button', { name: /Все места/ })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(rows()[PLACES_SHOWN]));
  });

  it('клик по строке открывает место, как клик по маркеру', () => {
    window.location.hash = '#/r/stonehall';
    render(<App />);
    const row = rows()[1]!;
    fireEvent.click(row);
    expect(parseHash(window.location.hash).screen).toEqual({ name: 'place', regionId: 'stonehall', placeSlug: row.dataset.placeRow });
  });

  it('наведение и фокус на строке подсвечивают маркер; уход — снимает', () => {
    window.location.hash = '#/r/stonehall';
    render(<App />);
    const row = rows()[2]!;
    const slug = row.dataset.placeRow!;
    const marker = () => document.querySelector(`[data-place="${slug}"]`)!;
    expect(marker()).not.toHaveAttribute('data-lit');
    fireEvent.pointerEnter(row, { pointerType: 'mouse' });
    expect(marker()).toHaveAttribute('data-lit');
    fireEvent.pointerLeave(row);
    expect(marker()).not.toHaveAttribute('data-lit');
    act(() => row.focus());
    expect(marker()).toHaveAttribute('data-lit');
    act(() => row.blur());
    expect(document.querySelectorAll('[data-lit]')).toHaveLength(0);
  });

  it('регион без мест («Неизведанные земли») — блока нет', () => {
    window.location.hash = '#/r/uncharted';
    render(<App />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.queryByTestId('place-list')).toBeNull();
  });
});
