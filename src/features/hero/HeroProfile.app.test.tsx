import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { getHero, getPlace, getRegion, heroCrop, heroPortrait, heroRender, placeName } from '../../data/world';
import { pointAtLabel } from '../world/labelHover.testutil';
import { TOOLTIP_OPEN_DELAY } from '../world/useRegionTooltip';
import { artId } from './profile';

// Профиль героя в приложении (E15, SPEC §6.8): открывается кликом по герою, показывает то, что есть.

const profile = (name: string) => screen.queryByRole('complementary', { name });
const chip = () => screen.queryByRole('region', { name: 'Выбранный герой' });

describe('профиль героя', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('портрет в панели региона: профиль поверх панели, камера на месте, фокус на имени; × закрывает профиль и снимает героя (#230)', async () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Tusk: открыть профиль/ }));
    expect(window.location.hash).toBe('#/r/icewrack?hero=tusk&profile');
    expect(chip()).toBeNull();
    const panel = profile('Tusk')!;
    const heading = within(panel).getByRole('heading', { level: 2, name: 'Tusk' });
    expect(heading).toHaveFocus();
    // Описание есть у всех героев после E14; связь с Bristleback пришла обратной записью из партии 04 (#49).
    expect(within(panel).getByRole('heading', { name: 'Связан с' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /Bristleback/ })).toBeInTheDocument();
    expect(panel.querySelector('p')).not.toBeNull();
    expect(within(panel).getByRole('heading', { name: 'Арты' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /^dota2.com: Tusk/ })).toHaveAttribute(
      'href',
      'https://www.dota2.com/hero/tusk?l=russian',
    );
    expect(panel.querySelector(`[data-hero-header] img[src="${heroCrop(getHero('tusk')!)}"]`)).not.toBeNull();
    // Нити героя на карте — как при выборе из поиска.
    expect(document.querySelectorAll('[data-testid="threads"] path[data-thread]').length).toBeGreaterThan(0);

    const region = getRegion('icewrack')!.name.ru;
    fireEvent.click(within(panel).getByRole('button', { name: 'Закрыть профиль' }));
    await waitFor(() => expect(window.location.hash).toBe('#/r/icewrack'));
    expect(screen.getByRole('heading', { level: 2, name: region })).toHaveFocus();
    // Профиль и герой закрываются одним шагом: нитей нет, чипа нет.
    expect(document.querySelectorAll('[data-testid="threads"] path[data-thread]')).toHaveLength(0);
    expect(chip()).toBeNull();
  });

  it('из мира: профиль справа, камера не приближается; описание и «Связан с» с быстрыми ссылками', () => {
    window.location.hash = '#/world?hero=dawnbreaker&profile';
    render(<App />);
    const panel = profile('Dawnbreaker')!;
    expect(within(panel).getByRole('button', { name: 'Закрыть профиль' })).toBeInTheDocument();
    expect(panel).toHaveTextContent(getHero('dawnbreaker')!.profile!.summary!.ru.slice(0, 40));
    // Места героя — сразу под описанием, выше артов и связей (#95).
    const order = within(panel)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(order.slice(0, 3)).toEqual(['Места героя', 'Арты', 'Связан с']);
    const relations = within(panel).getByRole('heading', { name: 'Связан с' }).closest('section')!;
    // Свои связи по типу: родня, любовь, затем враги.
    const names = within(relations)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names[0]).toMatch(/, Родня: открыть профиль$/);
    expect(names).toContain('Mars, Возлюбленные: открыть профиль');

    fireEvent.click(within(relations).getByRole('button', { name: 'Mars, Возлюбленные: открыть профиль' }));
    expect(window.location.hash).toBe('#/world?hero=mars&profile');
    const mars = profile('Mars')!;
    expect(within(mars).getByRole('heading', { level: 2, name: 'Mars' })).toHaveFocus();
    // Обратная связь: у Mars своих записей нет, Dawnbreaker записала его возлюбленным.
    expect(within(mars).getByRole('button', { name: 'Dawnbreaker, Возлюбленные: открыть профиль' })).toBeInTheDocument();
  });

  it('арты: карточка открывает галерею героя; Esc закрывает галерею, затем профиль вместе с героем', async () => {
    window.location.hash = '#/world?hero=tusk&profile';
    render(<App />);
    const tusk = getHero('tusk')!;
    const arts = within(profile('Tusk')!).getByRole('heading', { name: 'Арты' }).closest('section')!;
    fireEvent.click(within(arts).getByRole('button', { name: /Tusk/ }));
    expect(window.location.hash).toBe(`#/world?hero=tusk&profile&media=${artId(tusk, 'render')}`);
    const dialog = screen.getByRole('dialog', { name: 'Tusk' });
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', heroRender(tusk));
    act(() => {
      fireEvent.keyDown(document.activeElement ?? window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(window.location.hash).toBe('#/world?hero=tusk&profile'));
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(window.location.hash).toBe('#/world');
    expect(profile('Tusk')).toBeNull();
    expect(chip()).toBeNull();
  });

  it('место из профиля: камера к месту, панель места, профиль закрыт вместе с героем; EN', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'en');
    window.location.hash = '#/world?hero=nevermore&profile';
    render(<App />);
    const places = within(profile('Shadow Fiend')!).getByRole('navigation', { name: "Hero's places" });
    const [first, second] = within(places).getAllByRole('button');
    expect(first).toHaveTextContent('Homeland');
    // Упоминание — не остановка пути (пунктир, как на карте).
    expect(second!.className).toMatch(/offPath/);
    fireEvent.click(first!);
    expect(window.location.hash).toBe('#/r/hells/abysm');
    expect(profile('Shadow Fiend')).toBeNull();
    const abysm = placeName(getPlace('hells', 'abysm')!, 'en');
    expect(screen.getByRole('heading', { level: 2, name: abysm })).toHaveFocus();
    expect(chip()).toBeNull();
  });

  it('профиль открыт: маркер места ведёт к панели места, профиль закрывается вместе с героем (A15, #230)', () => {
    window.location.hash = '#/r/icewrack?hero=tusk&profile';
    render(<App />);
    expect(profile('Tusk')).not.toBeNull();
    // Маркер места на карте: панель места, профиль закрыт, нити и подсветка героя на месте.
    fireEvent.click(document.querySelector('[data-place="blueheart-glacier"][tabindex]')!);
    expect(window.location.hash).toBe('#/r/icewrack/blueheart-glacier');
    expect(profile('Tusk')).toBeNull();
    const glacier = placeName(getPlace('icewrack', 'blueheart-glacier')!, 'ru');
    expect(screen.getByRole('complementary', { name: glacier })).toBeInTheDocument();
    expect(document.querySelector('[data-place="cobalt"]')?.getAttribute('class')).not.toMatch(/heroSpot/);
    expect(chip()).toBeNull();
  });

  it('портрет в подсказке региона в мире открывает профиль, не двигая камеру (#65)', async () => {
    window.location.hash = '#/world';
    render(<App />);
    // #193: подсказку вызывает подпись региона.
    pointAtLabel('icewrack');
    await act(() => new Promise((r) => setTimeout(r, TOOLTIP_OPEN_DELAY)));
    // В мире панели нет: портрет-кнопка с этим героем — только в подсказке региона.
    fireEvent.click(document.querySelector('button img[alt="Crystal Maiden"]')!.closest('button')!);
    expect(window.location.hash).toBe('#/world?hero=crystal_maiden&profile');
    expect(profile('Crystal Maiden')).not.toBeNull();
  });

  it('шапка: пока грузится — портрет-заглушка, по загрузке — шапка; ошибка — портрет, без пустого блока (#194)', () => {
    window.location.hash = '#/r/icewrack/black-pool?hero=lich&profile';
    render(<App />);
    const lich = getHero('lich')!;
    const header = () => profile('Lich')!.querySelector<HTMLElement>('[data-hero-header]');
    const img = (src: string) => header()?.querySelector<HTMLImageElement>(`img[src="${src}"]`) ?? null;
    expect(header()).toHaveAttribute('data-hero-header', 'loading');
    expect(img(heroPortrait(lich))).not.toBeNull();
    expect(img(heroCrop(lich))).not.toBeNull();
    fireEvent.load(img(heroCrop(lich))!);
    expect(header()).toHaveAttribute('data-hero-header', 'loaded');
  });

  it('шапка: адрес арта недоступен — остаётся портрет; нет и портрета — буква вместо блока (#194)', () => {
    window.location.hash = '#/r/icewrack/black-pool?hero=lich&profile';
    render(<App />);
    const lich = getHero('lich')!;
    const panel = profile('Lich')!;
    const header = () => panel.querySelector<HTMLElement>('[data-hero-header]');
    fireEvent.error(header()!.querySelector(`img[src="${heroCrop(lich)}"]`)!);
    expect(header()).toHaveAttribute('data-hero-header', 'failed');
    expect(header()!.querySelector(`img[src="${heroCrop(lich)}"]`)).toBeNull();
    const portrait = header()!.querySelector(`img[src="${heroPortrait(lich)}"]`)!;
    expect(portrait).not.toBeNull();
    fireEvent.error(portrait);
    expect(header()).toBeNull();
    // Маленький портрет `HeroPortrait` на месте шапки: его ошибка — буква.
    fireEvent.error(panel.querySelector(`img[src="${heroPortrait(lich)}"]`)!);
    expect(within(panel).getByTestId('hero-fallback')).toHaveTextContent('L');
  });
});
