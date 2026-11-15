import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { parseHash } from '../../app/router';
import type { Media } from '../../data/types';
import { getRegion, world } from '../../data/world';
import { mediaKinds, placeMediaBadge, regionMediaBadge } from './mediaBadge';

// Значок медиа на карте (#69): у маркера места и в подсказке региона; клик открывает галерею (?media=, A5).

const icewrack = getRegion('icewrack')!;
const hazhadal = getRegion('hazhadal')!;
const withMedia = (r: typeof icewrack) => r.places.filter((p) => p.media?.length && p.pos);

function hoverRegion(name: string) {
  const polygon = screen.getByRole('button', { name });
  fireEvent.pointerEnter(polygon, { pointerType: 'mouse' });
  return screen.getByRole('group', { name });
}

describe('значок медиа (#69)', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('данные: у региона — своё и медиа мест, открывает своё; без своего — первое место с медиа', () => {
    const ice = regionMediaBadge(icewrack)!;
    expect(ice.open).toEqual({ mediaId: icewrack.media![0] });
    expect(ice.media.map((m) => m.id)).toEqual(expect.arrayContaining([...icewrack.media!, ...withMedia(icewrack).flatMap((p) => p.media!)]));
    expect(hazhadal.media ?? []).toHaveLength(0);
    const place = withMedia(hazhadal)[0]!;
    expect(regionMediaBadge(hazhadal)!.open).toEqual({ mediaId: place.media![0], placeSlug: place.slug });
    expect(placeMediaBadge({ ...place, media: undefined })).toBeNull();
    // Без медиа у региона и мест значка нет.
    expect(world.regions.filter((r) => !regionMediaBadge(r)).length).toBeGreaterThan(0);
  });

  it('имя — виды медиа строчными, без повторов', () => {
    const m = (ru: string, en: string) => ({ subtitle: { ru, en } }) as Media;
    expect(mediaKinds([m('Комикс', 'Comic'), m('Комикс', 'Comic'), m('Синематик', 'Cinematic')], 'ru')).toBe('комикс, синематик');
    expect(mediaKinds([m('Комикс', 'Comic')], 'en')).toBe('comic');
  });

  it('у маркера места с медиа — кнопка «Есть медиа: комикс» сразу за маркером; клик — место и галерея', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const places = withMedia(icewrack);
    const badges = screen.getAllByRole('button', { name: 'Есть медиа: комикс' });
    expect(badges).toHaveLength(places.length);
    const place = places[0]!;
    const badge = document.querySelector<SVGElement>(`[data-media-badge="${place.slug}"]`)!;
    // Tab: маркер места → его значок.
    expect(badge.previousElementSibling).toHaveAttribute('data-place', place.slug);
    expect(document.querySelectorAll('[data-media-badge]')).toHaveLength(places.length);

    fireEvent.click(badge);
    const route = parseHash(window.location.hash);
    expect(route.screen).toEqual({ name: 'place', regionId: 'icewrack', placeSlug: place.slug });
    expect(route.media).toBe(place.media![0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('значок с клавиатуры: Enter открывает галерею', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const place = withMedia(icewrack)[0]!;
    const badge = document.querySelector<SVGElement>(`[data-media-badge="${place.slug}"]`)!;
    expect(badge).toHaveAttribute('tabindex', '0');
    act(() => badge.focus());
    fireEvent.keyDown(badge, { key: 'Enter' });
    expect(parseHash(window.location.hash).media).toBe(place.media![0]);
  });

  it('подсказка региона в мире: значок открывает медиа региона, а без своего — место с медиа', () => {
    window.location.hash = '#/world';
    render(<App />);
    const tip = hoverRegion(icewrack.name.ru);
    const badge = within(tip).getByRole('button', { name: 'Есть медиа: комикс' });
    expect(badge).toHaveTextContent('комикс');
    // Tab с региона ведёт в подсказку: значок — первая кнопка.
    expect(within(tip).getAllByRole('button')[0]).toBe(badge);
    fireEvent.click(badge);
    expect(parseHash(window.location.hash)).toEqual({ screen: { name: 'region', regionId: 'icewrack' }, media: icewrack.media![0] });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('регион без своего медиа: значок ведёт в место; без медиа — значка нет; EN — «Media: comic»', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'en');
    window.location.hash = '#/world';
    render(<App />);
    const bare = world.regions.find((r) => r.layout && !regionMediaBadge(r))!;
    fireEvent.pointerEnter(screen.getByRole('button', { name: bare.name.en }), { pointerType: 'mouse' });
    expect(document.getElementById(screen.getByRole('button', { name: bare.name.en }).getAttribute('aria-describedby')!)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Media:/ })).toBeNull();
    fireEvent.pointerLeave(screen.getByRole('button', { name: bare.name.en }), { pointerType: 'mouse' });

    const tip = hoverRegion(hazhadal.name.en);
    fireEvent.click(within(tip).getByRole('button', { name: 'Media: comic' }));
    const place = withMedia(hazhadal)[0]!;
    expect(parseHash(window.location.hash)).toEqual({
      screen: { name: 'place', regionId: 'hazhadal', placeSlug: place.slug },
      media: place.media![0],
    });
  });
});
