import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { getHero, getPlace, getRegion, heroCrop, heroRender, placeName } from '../../data/world';
import { TOOLTIP_OPEN_DELAY } from '../world/useRegionTooltip';
import { artId } from './profile';

// Профиль героя в приложении (E15, SPEC §6.8): открывается кликом по герою, показывает то, что есть.

const profile = (name: string) => screen.queryByRole('complementary', { name });
const chip = () => screen.queryByRole('region', { name: 'Выбранный герой' });

describe('профиль героя', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('портрет в панели региона: профиль поверх панели, камера на месте, фокус на имени; крошка закрывает профиль, герой остаётся', () => {
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
    expect(panel.querySelector('img')).toHaveAttribute('src', heroCrop(getHero('tusk')!));
    // Нити героя на карте — как при выборе из поиска.
    expect(document.querySelectorAll('[data-testid="threads"] path[data-thread]').length).toBeGreaterThan(0);

    const region = getRegion('icewrack')!.name.ru;
    fireEvent.click(within(panel).getByRole('button', { name: 'Закрыть профиль' }));
    expect(window.location.hash).toBe('#/r/icewrack?hero=tusk');
    expect(screen.getByRole('heading', { level: 2, name: region })).toHaveFocus();
    // Герой выбран: нити на месте, сверху чип — он открывает профиль снова.
    expect(document.querySelectorAll('[data-testid="threads"] path[data-thread]').length).toBeGreaterThan(0);
    fireEvent.click(within(chip()!).getByRole('button', { name: /^Tusk/ }));
    expect(window.location.hash).toBe('#/r/icewrack?hero=tusk&profile');
    expect(within(profile('Tusk')!).getByRole('heading', { level: 2, name: 'Tusk' })).toHaveFocus();
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

  it('арты: карточка открывает галерею героя; Esc закрывает галерею, затем профиль, затем снимает героя', () => {
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
    expect(window.location.hash).toBe('#/world?hero=tusk&profile');
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(window.location.hash).toBe('#/world?hero=tusk');
    expect(profile('Tusk')).toBeNull();
    // Профиль закрыт, а в мире панели нет — фокус на чипе героя.
    expect(within(chip()!).getByRole('button', { name: /^Tusk/ })).toHaveFocus();
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(window.location.hash).toBe('#/world');
    expect(chip()).toBeNull();
  });

  it('место из профиля: камера к месту, панель места, герой выбран, чип возвращает профиль; EN', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'en');
    window.location.hash = '#/world?hero=nevermore&profile';
    render(<App />);
    const places = within(profile('Shadow Fiend')!).getByRole('navigation', { name: "Hero's places" });
    const [first, second] = within(places).getAllByRole('button');
    expect(first).toHaveTextContent('Homeland');
    // Упоминание — не остановка пути (пунктир, как на карте).
    expect(second!.className).toMatch(/offPath/);
    fireEvent.click(first!);
    expect(window.location.hash).toBe('#/r/hells/abysm?hero=nevermore');
    expect(profile('Shadow Fiend')).toBeNull();
    const abysm = placeName(getPlace('hells', 'abysm')!, 'en');
    expect(screen.getByRole('heading', { level: 2, name: abysm })).toHaveFocus();
    const badge = screen.getByRole('region', { name: 'Selected hero' });
    expect(within(badge).getByRole('button', { name: 'Clear hero selection' })).toBeInTheDocument();
    fireEvent.click(within(badge).getByRole('button', { name: 'Shadow Fiend Hero profile' }));
    expect(window.location.hash).toBe('#/r/hells/abysm?hero=nevermore&profile');
    expect(within(profile('Shadow Fiend')!).getByRole('button', { name: 'Close profile' })).toBeInTheDocument();
  });

  it('выбран герой, профиль открыт: маркер, крошка и Esc ведут к панели экрана, герой остаётся (A15)', () => {
    window.location.hash = '#/r/icewrack?hero=tusk&profile';
    render(<App />);
    expect(profile('Tusk')).not.toBeNull();
    // Маркер места на карте: панель места, профиль закрыт, нити и подсветка героя на месте.
    fireEvent.click(document.querySelector('[data-place="blueheart-glacier"][tabindex]')!);
    expect(window.location.hash).toBe('#/r/icewrack/blueheart-glacier?hero=tusk');
    expect(profile('Tusk')).toBeNull();
    const glacier = placeName(getPlace('icewrack', 'blueheart-glacier')!, 'ru');
    expect(screen.getByRole('complementary', { name: glacier })).toBeInTheDocument();
    expect(document.querySelector('[data-place="cobalt"]')?.getAttribute('class')).toMatch(/heroSpot/);
    expect(chip()).not.toBeNull();
    // Крошка «‹ Регион» панели места — тоже переход: герой выбран, профиль закрыт.
    fireEvent.click(screen.getByRole('button', { name: `‹ ${getRegion('icewrack')!.name.ru}` }));
    expect(window.location.hash).toBe('#/r/icewrack?hero=tusk');
    // Чип открывает профиль; ✕ снимает героя.
    fireEvent.click(within(chip()!).getByRole('button', { name: /^Tusk/ }));
    expect(window.location.hash).toBe('#/r/icewrack?hero=tusk&profile');
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(window.location.hash).toBe('#/r/icewrack?hero=tusk');
    fireEvent.click(within(chip()!).getByRole('button', { name: 'Снять выбор героя' }));
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(chip()).toBeNull();
  });

  it('портрет в подсказке региона в мире открывает профиль, не двигая камеру (#65)', async () => {
    window.location.hash = '#/world';
    render(<App />);
    // #193: подсказку вызывает подпись региона.
    fireEvent.pointerEnter(document.querySelector('[data-label="icewrack"]')!, { pointerType: 'mouse' });
    await act(() => new Promise((r) => setTimeout(r, TOOLTIP_OPEN_DELAY)));
    // В мире панели нет: портрет-кнопка с этим героем — только в подсказке региона.
    fireEvent.click(document.querySelector('button img[alt="Crystal Maiden"]')!.closest('button')!);
    expect(window.location.hash).toBe('#/world?hero=crystal_maiden&profile');
    expect(profile('Crystal Maiden')).not.toBeNull();
  });
});
