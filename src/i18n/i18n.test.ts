import { afterEach, describe, expect, it, vi } from 'vitest';
import en from './en.json';
import ru from './ru.json';
import { detectLang, translate } from '.';

describe('i18n', () => {
  afterEach(() => vi.restoreAllMocks());

  it('в словарях одинаковые ключи и нет пустых строк', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
    for (const text of [...Object.values(ru), ...Object.values(en)]) expect(text.trim()).not.toBe('');
  });

  it('подставляет переменные', () => {
    expect(translate('ru', 'panel.backTo', { name: 'Айсрак' })).toBe('‹ Айсрак');
  });

  it('язык по умолчанию — из браузера, затем сохранённый выбор', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ru-RU');
    expect(detectLang()).toBe('ru');
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE');
    expect(detectLang()).toBe('en');
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    expect(detectLang()).toBe('ru');
  });

  it('не падает без localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    expect(detectLang()).toBe('en');
  });
});
