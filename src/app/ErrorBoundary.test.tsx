import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_TEXT_LIMIT, ErrorBoundary, errorText } from './ErrorBoundary';

// #107: исключение при отрисовке — экран ошибки, а не пустая страница.

function Boom(): never {
  throw new Error('битые данные');
}

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  // jsdom ещё раз сообщает о брошенной при отрисовке ошибке через событие `error` окна — глушим его.
  const silence = (e: ErrorEvent) => e.preventDefault();

  beforeEach(() => {
    // React и сама граница пишут ошибку в консоль — здесь она ожидаема.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.addEventListener('error', silence);
    window.location.hash = '#/r/icewrack?hero=tusk';
  });

  afterEach(() => {
    consoleError.mockRestore();
    window.removeEventListener('error', silence);
    window.localStorage.clear();
  });

  it('RU: экран ошибки с кнопками и ссылкой на форму issue с адресом и текстом ошибки', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Что-то сломалось' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Перезагрузить' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'На карту мира' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /^Сообщить об ошибке/ });
    const url = new URL(link.getAttribute('href')!);
    expect(url.origin + url.pathname).toBe('https://github.com/shoraLBRT/dota-lore-map/issues/new');
    const body = url.searchParams.get('body')!;
    expect(body).toContain(window.location.href);
    expect(body).toContain('Error: битые данные');
    expect(body).toContain('Экран: регион');
    expect(link).toHaveAttribute('target', '_blank');
    expect(consoleError).toHaveBeenCalled();
  });

  it('EN: тексты экрана по языку из localStorage', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'en');
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Report the error/ })).toBeInTheDocument();
  });

  it('без ошибки показывает приложение', () => {
    render(
      <ErrorBoundary>
        <p>карта</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('карта')).toBeInTheDocument();
  });
});

describe('errorText', () => {
  it('сообщение и стек не длиннее потолка, строка заголовка не повторяется', () => {
    const error = new Error('x');
    error.stack = `Error: x\n${'    at f (a.js:1:1)\n'.repeat(50)}`;
    const text = errorText(error);
    expect(text.length).toBeLessThanOrEqual(ERROR_TEXT_LIMIT);
    expect(text.startsWith('Error: x\nat f')).toBe(true);
    expect(text.match(/Error: x/g)).toHaveLength(1);
  });

  it('не Error — строкой', () => {
    expect(errorText('oops')).toBe('oops');
  });
});
