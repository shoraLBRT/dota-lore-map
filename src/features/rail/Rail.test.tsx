import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NavigationProvider } from '../../app/navigation';
import { SoundProvider } from '../../app/sound';
import { dictionaries, I18nProvider } from '../../i18n';
import { Rail } from './Rail';

function renderRail() {
  render(
    <I18nProvider initialLang="ru">
      <SoundProvider>
        <NavigationProvider>
          <Rail />
        </NavigationProvider>
      </SoundProvider>
    </I18nProvider>,
  );
  return screen.getByRole('navigation', { name: 'Навигация' });
}

describe('Rail — левая панель (SPEC §6.1)', () => {
  it('сверху вниз: логотип, глобус, поиск, язык, звук, «О проекте»', () => {
    const rail = renderRail();
    const buttons = within(rail).getAllByRole('button');
    expect(buttons).toHaveLength(7);
    expect(buttons[0]).toHaveAccessibleName('На заставку');
    expect(buttons[1]).toHaveAccessibleName('Весь мир');
    expect(buttons[2]).toHaveAccessibleName('Поиск героя — скоро');
    expect(buttons[3]).toHaveAccessibleName('RU');
    expect(buttons[4]).toHaveAccessibleName('EN');
    expect(buttons[5]).toHaveAccessibleName('Звук');
    expect(buttons[6]).toHaveAccessibleName('О проекте');
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

  it('поиск — заглушка: недоступна и ничего не делает', () => {
    window.location.hash = '#/world';
    renderRail();
    const search = screen.getByRole('button', { name: 'Поиск героя — скоро' });
    expect(search).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(search);
    expect(window.location.hash).toBe('#/world');
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
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'О проекте' })).toHaveFocus();
  });
});
