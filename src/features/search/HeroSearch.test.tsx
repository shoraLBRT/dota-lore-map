import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { getPlace, getRegion, placeName } from '../../data/world';

// Поиск героя и нити в приложении (E7, SPEC §6.5, §6.6); выбранный герой — профиль в панели (E15, SPEC §6.8).

const openSearch = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Поиск героя' }));
  return screen.getByRole('combobox', { name: 'Герой, регион или место' });
};
const profile = (name: string) => screen.queryByRole('complementary', { name });
const threads = () => document.querySelectorAll('[data-testid="threads"] path[data-thread]');

describe('поиск героя и нити', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('автодополнение: портрет и имя, алиас рядом; ↑ / ↓ и Enter выбирают', () => {
    window.location.hash = '#/world';
    render(<App />);
    const input = openSearch();
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'пудж' } });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('PudgeПудж');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);

    fireEvent.change(input, { target: { value: 'sv' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const all = screen.getAllByRole('option');
    expect(all.at(-1)).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(all[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(input, { target: { value: 'пудж' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(window.location.hash).toBe('#/r/quoidge?hero=pudge&profile');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('ничего не нашли — так и пишет; Esc закрывает только поиск', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'zzzz' } });
    expect(screen.getByText('Ничего не нашли')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(window.location.hash).toBe('#/r/icewrack');
  });

  it('одно место — камера к нему; профиль с именем, ссылкой ↗ и крошкой «назад»', () => {
    window.location.hash = '#/world';
    render(<App />);
    fireEvent.change(openSearch(), { target: { value: 'ww' } });
    fireEvent.click(screen.getAllByRole('option')[0]!);
    expect(window.location.hash).toBe('#/r/icewrack/icewrack?hero=winter_wyvern&profile');
    const plaque = profile('Winter Wyvern')!;
    within(plaque).getByRole('heading', { name: 'Winter Wyvern' });
    expect(within(plaque).getByRole('link', { name: /^dota2.com: Winter Wyvern, официальная страница/ })).toHaveAttribute(
      'href',
      'https://www.dota2.com/hero/winterwyvern?l=russian',
    );
    expect(threads()).toHaveLength(0);
    // Место героя подсвечено, остальные маркеры региона приглушены.
    expect(document.querySelector('[data-place="icewrack"]')?.getAttribute('class')).toMatch(/heroSpot/);
    expect(document.querySelector('[data-place="cobalt"]')?.getAttribute('class')).toMatch(/mutedMarker/);

    const icewrack = placeName(getPlace('icewrack', 'icewrack')!, 'ru');
    fireEvent.click(within(plaque).getByRole('button', { name: 'Закрыть профиль' }));
    expect(profile('Winter Wyvern')).toBeNull();
    expect(window.location.hash).toBe('#/r/icewrack/icewrack?hero=winter_wyvern');
    // Под профилем была панель места — она и вернулась.
    expect(screen.getByRole('complementary', { name: icewrack })).toBeInTheDocument();
  });

  it('места в разных регионах: мир, остальные регионы приглушены, нити; список мест ведёт к месту, герой остаётся', () => {
    window.location.hash = '#/world?hero=tidehunter&profile';
    render(<App />);
    expect(threads()).toHaveLength(2);
    expect(document.querySelector('polygon[data-region="cladd"]')?.getAttribute('class')).not.toMatch(/muted/);
    expect(document.querySelector('polygon[data-region="icewrack"]')?.getAttribute('class')).toMatch(/muted/);
    expect(document.querySelector('[data-tint="the-deep"]')?.getAttribute('class')).toMatch(/lit/);

    const places = within(profile('Tidehunter')!).getByRole('navigation', { name: 'Места героя' });
    const reef = new RegExp(`^${placeName(getPlace('the-deep', 'recluse-reef')!, 'ru')}`);
    fireEvent.click(within(places).getByRole('button', { name: reef }));
    expect(window.location.hash).toBe('#/r/the-deep/recluse-reef?hero=tidehunter');
    // Видна панель места, профиль закрыт; герой выбран — чип сверху.
    expect(profile('Tidehunter')).toBeNull();
    expect(screen.getByRole('region', { name: 'Выбранный герой' })).toBeInTheDocument();
    expect(threads()).toHaveLength(2);
  });

  it('Esc: сначала закрывает профиль, потом снимает героя, потом — на уровень вверх', () => {
    window.location.hash = '#/r/quoidge?hero=pudge&profile';
    render(<App />);
    expect(profile('Pudge')).not.toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(window.location.hash).toBe('#/r/quoidge?hero=pudge');
    expect(profile('Pudge')).toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(window.location.hash).toBe('#/r/quoidge');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/world');
  });

  it('наведение на портрет героя с несколькими местами рисует его нити, уход — убирает', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    expect(getRegion('icewrack')).toBeDefined();
    const tusk = screen.getByRole('button', { name: /^Tusk: открыть профиль/ }).closest('li')!;
    fireEvent.pointerEnter(tusk);
    expect(threads()).toHaveLength(4);
    fireEvent.pointerLeave(tusk);
    expect(threads()).toHaveLength(0);
    // У героя с одним местом нитей нет.
    const ww = screen.getByRole('button', { name: /^Winter Wyvern: открыть профиль/ }).closest('li')!;
    fireEvent.focus(ww);
    expect(threads()).toHaveLength(0);
  });

  it('наведение на героя всегда показывает его на карте (#66): маркер пульсирует — мышь, фокус, тап', () => {
    window.location.hash = '#/r/radiant-lands';
    render(<App />);
    const pulse = (slug: string) => document.querySelector(`[data-place="${slug}"] [data-pulse]`);
    const portrait = (name: string) =>
      screen.getByRole('button', { name: new RegExp(`^${name}: открыть профиль`) }).closest('li')!;
    // Phantom Lancer — одно место, нитей нет, но маркер отмечен.
    const pl = portrait('Phantom Lancer');
    fireEvent.pointerEnter(pl, { pointerType: 'mouse' });
    expect(pulse('pole')).not.toBeNull();
    expect(document.querySelector('[data-place="pole"]')!.getAttribute('class')).toMatch(/previewed/);
    expect(threads()).toHaveLength(0);
    fireEvent.pointerLeave(pl, { pointerType: 'mouse' });
    expect(pulse('pole')).toBeNull();
    fireEvent.focus(pl);
    expect(pulse('pole')).not.toBeNull();
    fireEvent.blur(pl);
    expect(pulse('pole')).toBeNull();
    // Тап: палец ушёл — герой остаётся на карте до ухода фокуса.
    fireEvent.pointerEnter(pl, { pointerType: 'touch' });
    fireEvent.pointerLeave(pl, { pointerType: 'touch' });
    expect(pulse('pole')).not.toBeNull();
    fireEvent.blur(pl);
    expect(pulse('pole')).toBeNull();
    // Gyrocopter — несколько мест: и нить, и маркер своего места.
    fireEvent.pointerEnter(portrait('Gyrocopter'), { pointerType: 'mouse' });
    expect(threads()).toHaveLength(1);
    expect(pulse('home-of-the-keen-folk')).not.toBeNull();
    expect(pulse('pole')).toBeNull();
    // Из поиска фокус ушёл на портрет: поиск закрылся, а герой портрета остался на карте.
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'gyrocopter' } });
    fireEvent.blur(input, { relatedTarget: pl });
    fireEvent.focus(pl);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(pulse('pole')).not.toBeNull();
  });

  it('в мире текущий вариант поиска подсвечивает регионы героя (#66)', () => {
    window.location.hash = '#/world';
    render(<App />);
    const lit = (id: string) => document.querySelector(`[data-tint="${id}"]`)!.getAttribute('class');
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'zeus' } });
    expect(lit('heavens')).toMatch(/lit/);
    expect(lit('free-cities')).toMatch(/lit/);
    expect(lit('icewrack')).not.toMatch(/lit/);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(lit('heavens')).not.toMatch(/lit/);
  });

  it('регионы и места (#100): место с регионом в подписи, выбор открывает его экран, герой остаётся', () => {
    window.location.hash = '#/world?hero=crystal_maiden';
    render(<App />);
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'турст' } });
    const [option, ...rest] = screen.getAllByRole('option');
    expect(rest).toHaveLength(0);
    expect(option).toHaveTextContent('Турстаркури');
    expect(option).toHaveTextContent(getRegion('wailing-mountains')!.name.ru);
    fireEvent.click(option!);
    expect(window.location.hash).toBe('#/r/wailing-mountains/turstarkuri?hero=crystal_maiden');
    expect(screen.queryByRole('combobox')).toBeNull();

    // EN-название в RU-интерфейсе: регион и место показаны по-русски.
    fireEvent.change(openSearch(), { target: { value: 'icew' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Айсрак', 'Айсрак, Айсрак']);
    expect(screen.getByRole('group', { name: 'Регионы' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Места' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(window.location.hash).toBe('#/r/icewrack?hero=crystal_maiden');
  });

  it('клавиатура идёт по всем группам; вариант региона героя на карте не показывает (#100)', () => {
    window.location.hash = '#/world';
    render(<App />);
    const litCount = () => [...document.querySelectorAll('[data-tint]')].filter((el) => /lit/.test(el.getAttribute('class') ?? '')).length;
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.getByRole('group', { name: 'Герои' })).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(8);
    expect(litCount()).toBeGreaterThan(0);
    for (let i = 0; i < 4; i++) fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[4]).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('group', { name: 'Регионы' })).getAllByRole('option')[0]).toBe(options[4]);
    expect(litCount()).toBe(0);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(litCount()).toBeGreaterThan(0);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(window.location.hash).toMatch(/^#\/r\/[a-z-]+$/);
  });

  it('неизвестный герой в адресе — ни профиля, ни нитей', () => {
    window.location.hash = '#/world?hero=nobody';
    render(<App />);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(threads()).toHaveLength(0);
  });

  it('нити со смыслом (#67): у Hoodwink шаг пути со стрелкой, значки событий у мест, легенда раскрывается', () => {
    window.location.hash = '#/world?hero=hoodwink&profile';
    render(<App />);
    const step = document.querySelector('[data-testid="threads"] [data-step="path"]')!;
    expect(step).toHaveAttribute('data-event', 'home');
    expect(step.querySelector('[data-arrow]')).not.toBeNull();

    const plaque = profile('Hoodwink')!;
    const places = within(plaque).getByRole('navigation', { name: 'Места героя' });
    const [origin, home] = within(places).getAllByRole('button');
    expect(origin).toHaveTextContent('Родина');
    expect(origin!.querySelector('[data-event="origin"]')).not.toBeNull();
    expect(home).toHaveTextContent('Дом');

    const toggle = within(plaque).getByRole('button', { name: 'Как читать нити' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const legend = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(legend).not.toBeVisible();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(legend).toBeVisible();
    const items = within(legend).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      'Путь героя: откуда → куда, по порядку',
      'Родина',
      'Дом',
      'Цвет нити — сторона первого места героя',
    ]);
  });

  it('легенда (#67): у Tidehunter — пунктир «другая связь» без стрелки; EN', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'en');
    window.location.hash = '#/world?hero=tidehunter&profile';
    render(<App />);
    expect(document.querySelector('[data-testid="threads"] [data-step="aside"] [data-arrow]')).toBeNull();
    const plaque = screen.getByRole('complementary', { name: 'Tidehunter' });
    fireEvent.click(within(plaque).getByRole('button', { name: 'How to read the threads' }));
    const items = within(plaque).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toContain('Other link: the place is only mentioned');
    expect(items).toContain('Homeland');
  });
});

