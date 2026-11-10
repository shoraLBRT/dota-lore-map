import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { dictionaries } from '../i18n';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('интро: заголовок, кнопка «Начать», дисклеймер на двух языках', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Мир Dota 2' })).toBeInTheDocument();
    expect(screen.getByText(dictionaries.ru.disclaimer)).toBeInTheDocument();
    expect(screen.getByText(dictionaries.en.disclaimer)).toBeInTheDocument();
  });

  it('переключает язык и запоминает выбор', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Dota 2 World' })).toBeInTheDocument();
    expect(window.localStorage.getItem('dota-lore-map.lang')).toBe('en');
  });

  it('«Начать» → мир со списком регионов → регион → место', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
    expect(window.location.hash).toBe('#/world');

    const regions = screen.getByRole('navigation', { name: 'Регионы' });
    expect(regions.querySelectorAll('button')).toHaveLength(26);

    fireEvent.click(screen.getByRole('button', { name: 'Айсрак' }));
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(screen.getByRole('heading', { level: 2, name: 'Айсрак' })).toBeInTheDocument();
    const cm = screen.getByRole('link', { name: /Crystal Maiden/ });
    expect(cm).toHaveAttribute('href', 'https://www.dota2.com/hero/crystalmaiden?l=russian');
    expect(cm).toHaveAttribute('target', '_blank');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/world');
  });

  it('открывает место по адресу', () => {
    window.location.hash = '#/r/icewrack/blueheart-glacier';
    render(<App />);
    expect(screen.getByRole('heading', { level: 2, name: 'Blueheart Glacier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '‹ Айсрак' })).toBeInTheDocument();
  });
});
