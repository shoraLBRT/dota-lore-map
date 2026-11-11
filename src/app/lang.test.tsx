import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getMedia, getRegion } from '../data/world';
import { App } from './App';

// E8 (SPEC §12): переключение языка меняет все тексты без перезагрузки и без потери текущего экрана.

const icewrack = getRegion('icewrack')!;
const comic = getMedia('icewrack-new-neighbors')!;

describe('переключение языка на лету', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('регион с выбранным героем: тексты на новом языке, адрес, герой и панель на месте', () => {
    const hash = '#/r/icewrack?hero=tusk';
    window.location.hash = hash;
    render(<App />);
    expect(screen.getByRole('heading', { level: 2, name: icewrack.name.ru })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Выбранный герой' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    expect(window.location.hash).toBe(hash);
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('Dota 2 World');
    expect(screen.getByRole('heading', { level: 2, name: icewrack.name.en })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '‹ World' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse panel' })).toBeInTheDocument();
    const badge = screen.getByRole('region', { name: 'Selected hero' });
    expect(within(badge).getByRole('button', { name: 'Clear hero selection' })).toBeInTheDocument();
    expect(within(badge).getByRole('navigation', { name: "Hero's places" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RU' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    // Ни одной строки словаря на русском не осталось в правой панели.
    expect(screen.getByRole('complementary').textContent).not.toMatch(/[А-Яа-яЁё]/);
  });

  it('открытая галерея остаётся открытой; картинка, подписи и ссылка — на новом языке', () => {
    const hash = `#/r/icewrack?media=${comic.id}`;
    window.location.hash = hash;
    render(<App />);
    expect(screen.getByRole('dialog', { name: comic.title.ru })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    expect(window.location.hash).toBe(hash);
    const dialog = screen.getByRole('dialog', { name: comic.title.en });
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', (comic.src as { en: string }).en);
    expect(within(dialog).getByText('Comic · excerpt')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Read the full comic ↗' }).getAttribute('href')).toMatch(/l=english$/);
    expect(within(dialog).getByRole('button', { name: 'Close gallery' })).toBeInTheDocument();
  });
});
