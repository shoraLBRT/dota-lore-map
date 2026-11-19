import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NavigationProvider } from '../../app/navigation';
import { SoundProvider } from '../../app/sound';
import { dictionaries, I18nProvider } from '../../i18n';
import { FeedbackProvider } from '../feedback/FeedbackProvider';
import { Rail } from './Rail';

function renderRail() {
  render(
    <I18nProvider initialLang="ru">
      <SoundProvider>
        <NavigationProvider>
          <FeedbackProvider>
            <Rail />
          </FeedbackProvider>
        </NavigationProvider>
      </SoundProvider>
    </I18nProvider>,
  );
  return screen.getByRole('navigation', { name: 'Навигация' });
}

describe('Rail — левая панель (SPEC §6.1)', () => {
  it('сверху вниз: логотип, глобус, поиск, язык, обратная связь, звук, «О проекте»', () => {
    const rail = renderRail();
    const buttons = within(rail).getAllByRole('button');
    expect(buttons).toHaveLength(7);
    expect(buttons[0]).toHaveAccessibleName('На заставку');
    expect(buttons[1]).toHaveAccessibleName('Весь мир');
    expect(buttons[2]).toHaveAccessibleName('Поиск героя');
    expect(buttons[3]).toHaveAccessibleName('Язык: RU');
    expect(buttons[4]).toHaveAccessibleName('Обратная связь');
    expect(buttons[5]).toHaveAccessibleName('Звук');
    expect(buttons[6]).toHaveAccessibleName('О проекте');
    // У каждой кнопки — подсказка при наведении, она же имя (#195).
    for (const b of buttons) expect(document.getElementById(b.getAttribute('aria-labelledby')!)).toHaveAttribute('role', 'tooltip');
  });

  it('язык — один значок с меню: текущий отмечен, выбор меняет язык и возвращает фокус, Esc закрывает (#195)', () => {
    let escapes = 0;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && (escapes += 1);
    window.addEventListener('keydown', onEsc);
    const rail = renderRail();
    const lang = within(rail).getByRole('button', { name: 'Язык: RU' });
    expect(lang).toHaveTextContent('RU');
    expect(lang).toHaveAttribute('aria-haspopup', 'menu');
    expect(lang).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(lang);
    const menu = screen.getByRole('menu', { name: 'Язык' });
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual(['RUРусский', 'ENEnglish']);
    expect(items[0]).toHaveAttribute('aria-checked', 'true');
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0]!, { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1]!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(lang).toHaveFocus();
    expect(escapes).toBe(0);

    fireEvent.keyDown(lang, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
    expect(screen.queryByRole('menu')).toBeNull();
    const en = within(rail).getByRole('button', { name: 'Language: EN' });
    expect(en).toHaveFocus();
    window.removeEventListener('keydown', onEsc);
  });

  it('логотип ведёт на интро, глобус — в мир', () => {
    window.location.hash = '#/r/icewrack';
    renderRail();
    fireEvent.click(screen.getByRole('button', { name: 'Весь мир' }));
    expect(window.location.hash).toBe('#/world');
    expect(screen.getByRole('button', { name: 'Весь мир' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'На заставку' }));
    expect(window.location.hash).toBe('#/');
  });

  it('лупа открывает поиск героя', () => {
    window.location.hash = '#/world';
    let opened = 0;
    render(
      <I18nProvider initialLang="ru">
        <SoundProvider>
          <NavigationProvider>
            <FeedbackProvider>
              <Rail onSearch={() => (opened += 1)} />
            </FeedbackProvider>
          </NavigationProvider>
        </SoundProvider>
      </I18nProvider>,
    );
    const search = screen.getByRole('button', { name: 'Поиск героя' });
    expect(search).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(search);
    expect(opened).toBe(1);
  });

  it('звук: переключатель с состоянием, выбор сохраняется', () => {
    renderRail();
    const sound = screen.getByRole('button', { name: 'Звук' });
    expect(sound).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(sound);
    expect(sound).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem('dota-lore-map.sound')).toBe('off');
  });

  it('«О проекте» открывает окно с дисклеймером на двух языках, Esc закрывает', () => {
    renderRail();
    const about = screen.getByRole('button', { name: 'О проекте' });
    about.focus();
    fireEvent.click(about);
    const dialog = screen.getByRole('dialog', { name: 'О проекте' });
    expect(within(dialog).getByText(dictionaries.ru.disclaimer)).toBeInTheDocument();
    expect(within(dialog).getByText(dictionaries.en.disclaimer)).toBeInTheDocument();
    expect(within(dialog).getByText(dictionaries.ru['about.license'])).toBeInTheDocument();
    expect(within(dialog).getByText(/^Версия сборки: \S+/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /dota2\.com и Steam/ })).toHaveAttribute('href', 'https://www.dota2.com/comics');
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'О проекте' })).toHaveFocus();
  });
});
