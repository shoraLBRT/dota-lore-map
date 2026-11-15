import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { getHero, getRegion, heroCrop, heroRender } from '../../data/world';
import { artId } from './profile';

// Профиль героя в приложении (E15, SPEC §6.8): открывается кликом по герою, показывает то, что есть.

const profile = (name: string) => screen.queryByRole('complementary', { name });

describe('профиль героя', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('портрет в панели региона: профиль поверх панели, камера на месте, фокус на имени; крошка возвращает регион', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Tusk: открыть профиль/ }));
    expect(window.location.hash).toBe('#/r/icewrack?hero=tusk');
    const panel = profile('Tusk')!;
    const heading = within(panel).getByRole('heading', { level: 2, name: 'Tusk' });
    expect(heading).toHaveFocus();
    // У Tusk нет описания и связей — этих блоков нет, остальное есть.
    expect(within(panel).queryByRole('heading', { name: 'Связан с' })).toBeNull();
    expect(panel.querySelector('p')).toBeNull();
    expect(within(panel).getByRole('heading', { name: 'Арты' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /^dota2.com: Tusk/ })).toHaveAttribute(
      'href',
      'https://www.dota2.com/hero/tusk?l=russian',
    );
    expect(panel.querySelector('img')).toHaveAttribute('src', heroCrop(getHero('tusk')!));
    // Нити героя на карте — как при выборе из поиска.
    expect(document.querySelectorAll('[data-testid="threads"] path[data-thread]').length).toBeGreaterThan(0);

    const region = getRegion('icewrack')!.name.ru;
    fireEvent.click(within(panel).getByRole('button', { name: `Закрыть профиль героя, назад: ${region}` }));
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(screen.getByRole('heading', { level: 2, name: region })).toHaveFocus();
  });

  it('из мира: профиль справа, камера не приближается; описание и «Связан с» с быстрыми ссылками', () => {
    window.location.hash = '#/world?hero=dawnbreaker';
    render(<App />);
    const panel = profile('Dawnbreaker')!;
    expect(within(panel).getByRole('button', { name: 'Закрыть профиль героя, назад: Мир' })).toBeInTheDocument();
    expect(panel).toHaveTextContent(getHero('dawnbreaker')!.profile!.summary!.ru.slice(0, 40));
    const relations = within(panel).getByRole('heading', { name: 'Связан с' }).closest('section')!;
    // Свои связи по типу: родня, любовь, затем враги.
    const names = within(relations)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names[0]).toMatch(/, Родня: открыть профиль$/);
    expect(names).toContain('Mars, Возлюбленные: открыть профиль');

    fireEvent.click(within(relations).getByRole('button', { name: 'Mars, Возлюбленные: открыть профиль' }));
    expect(window.location.hash).toBe('#/world?hero=mars');
    const mars = profile('Mars')!;
    expect(within(mars).getByRole('heading', { level: 2, name: 'Mars' })).toHaveFocus();
    // Обратная связь: у Mars своих записей нет, Dawnbreaker записала его возлюбленным.
    expect(within(mars).getByRole('button', { name: 'Dawnbreaker, Возлюбленные: открыть профиль' })).toBeInTheDocument();
  });

  it('арты: карточка открывает галерею героя; Esc закрывает галерею, затем профиль', () => {
    window.location.hash = '#/world?hero=tusk';
    render(<App />);
    const tusk = getHero('tusk')!;
    const arts = within(profile('Tusk')!).getByRole('heading', { name: 'Арты' }).closest('section')!;
    fireEvent.click(within(arts).getByRole('button', { name: /Tusk/ }));
    expect(window.location.hash).toBe(`#/world?hero=tusk&media=${artId(tusk, 'render')}`);
    const dialog = screen.getByRole('dialog', { name: 'Tusk' });
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', heroRender(tusk));
    act(() => {
      fireEvent.keyDown(document.activeElement ?? window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.hash).toBe('#/world?hero=tusk');
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(window.location.hash).toBe('#/world');
    expect(profile('Tusk')).toBeNull();
  });

  it('место из профиля: камера к месту, профиль остаётся; EN', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'en');
    window.location.hash = '#/world?hero=tusk';
    render(<App />);
    const places = within(profile('Tusk')!).getByRole('navigation', { name: "Hero's places" });
    const [first, second] = within(places).getAllByRole('button');
    expect(first).toHaveTextContent('Homeland');
    // Связь E1 без типа — не остановка пути (пунктир, как на карте).
    expect(second!.className).toMatch(/offPath/);
    fireEvent.click(first!);
    expect(window.location.hash).toBe('#/r/icewrack/cobalt?hero=tusk');
    expect(profile('Tusk')).not.toBeNull();
    expect(first).toHaveAttribute('aria-current', 'true');
    expect(within(profile('Tusk')!).getByRole('button', { name: /^Close hero profile, back to / })).toBeInTheDocument();
  });

  it('портрет в подсказке региона в мире открывает профиль, не двигая камеру (#65)', () => {
    window.location.hash = '#/world';
    render(<App />);
    fireEvent.pointerEnter(document.querySelector('polygon[data-region="icewrack"]')!, { pointerType: 'mouse' });
    // В мире панели нет: портрет-кнопка с этим героем — только в подсказке региона.
    fireEvent.click(document.querySelector('button img[alt="Crystal Maiden"]')!.closest('button')!);
    expect(window.location.hash).toBe('#/world?hero=crystal_maiden');
    expect(profile('Crystal Maiden')).not.toBeNull();
  });
});
