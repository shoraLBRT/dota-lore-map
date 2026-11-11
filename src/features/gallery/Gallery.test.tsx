import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import type { Lang, Media } from '../../data/types';
import { getMedia, mediaSourceUrl } from '../../data/world';
import { I18nProvider } from '../../i18n';
import { Gallery, SWIPE_MIN } from './Gallery';
import { counter, galleryOf } from './items';

const L = (ru: string, en = ru) => ({ ru, en });

const comic: Media = {
  id: 'a-comic',
  type: 'image',
  excerpt: true,
  src: { ru: 'https://cdn.example.com/ru/01.jpg', en: 'https://cdn.example.com/en/01.jpg' },
  title: L('«Комикс»', 'Comic'),
  subtitle: L('Комикс', 'Comic'),
  description: L('Описание комикса.', 'Comic description.'),
  credit: 'Valve Corporation',
  sourceUrl: 'https://www.dota2.com/comic',
};
const art: Media = {
  id: 'b-art',
  type: 'image',
  src: 'https://cdn.example.com/art.jpg',
  title: L('Арт'),
  subtitle: L('Арт', 'Art'),
  credit: 'Valve Corporation',
  sourceUrl: 'https://example.com/art',
};
const video: Media = {
  id: 'c-video',
  type: 'youtube',
  youtubeId: 'abcDEF_12-x',
  title: L('Синематик'),
  subtitle: L('Синематик', 'Cinematic'),
  credit: 'Valve Corporation',
  sourceUrl: 'https://www.youtube.com/watch?v=abcDEF_12-x',
};
const items = [comic, art, video];

function show(index: number, list: Media[] = items, lang: Lang = 'ru') {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <I18nProvider initialLang={lang}>
      <Gallery items={list} index={index} onSelect={onSelect} onClose={onClose} />
    </I18nProvider>,
  );
  const rerender = (i: number) =>
    view.rerender(
      <I18nProvider initialLang={lang}>
        <Gallery items={list} index={i} onSelect={onSelect} onClose={onClose} />
      </I18nProvider>,
    );
  return { onSelect, onClose, rerender };
}

describe('галерея S4 (SPEC §5.6)', () => {
  it('справа: счётчик, заголовок, тип с меткой «отрывок», описание, «Читать комикс целиком ↗» на языке интерфейса, правообладатель', () => {
    show(0);
    const dialog = screen.getByRole('dialog', { name: '«Комикс»' });
    expect(within(dialog).getByText('01 / 03')).toHaveAccessibleName('1 из 3');
    expect(within(dialog).getByText('Комикс · отрывок')).toBeInTheDocument();
    expect(within(dialog).getByText('Описание комикса.')).toBeInTheDocument();
    expect(within(dialog).getByText(/одна страница комикса/)).toBeInTheDocument();
    const read = within(dialog).getByRole('link', { name: 'Читать комикс целиком ↗' });
    expect(read).toHaveAttribute('href', 'https://www.dota2.com/comic?l=russian');
    expect(read).toHaveAttribute('target', '_blank');
    expect(read).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(dialog).getByText('© Valve Corporation')).toBeInTheDocument();
    const img = within(dialog).getByRole('img', { name: '«Комикс»' });
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/ru/01.jpg');
    // Видна сразу — грузится без lazy (LCP, SPEC §14).
    expect(img).not.toHaveAttribute('loading');
  });

  it('не отрывок — просто «Источник ↗», без пометки про страницу', () => {
    show(1, items, 'en');
    expect(screen.getByText('Art')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Source ↗' })).toHaveAttribute('href', 'https://example.com/art');
    expect(screen.queryByText(/single page/)).toBeNull();
  });

  it('листание: стрелки на экране и ← / → по кругу', () => {
    const { onSelect } = show(0);
    fireEvent.click(screen.getByRole('button', { name: 'Следующее медиа' }));
    expect(onSelect).toHaveBeenLastCalledWith('b-art');
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущее медиа' }));
    expect(onSelect).toHaveBeenLastCalledWith('c-video');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenLastCalledWith('b-art');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenLastCalledWith('c-video');
  });

  it('свайп: горизонтальный ≥ порога листает, короткий и вертикальный — нет', () => {
    const { onSelect } = show(1);
    const frame = screen.getByTestId('gallery-frame');
    const swipe = (x0: number, y0: number, x1: number, y1: number) => {
      fireEvent.touchStart(frame, { touches: [{ clientX: x0, clientY: y0 }] });
      fireEvent.touchEnd(frame, { changedTouches: [{ clientX: x1, clientY: y1 }] });
    };
    swipe(300, 100, 300 - SWIPE_MIN - 10, 110);
    expect(onSelect).toHaveBeenLastCalledWith('c-video');
    swipe(100, 100, 100 + SWIPE_MIN + 10, 100);
    expect(onSelect).toHaveBeenLastCalledWith('a-comic');
    onSelect.mockClear();
    swipe(100, 100, 120, 100);
    swipe(100, 100, 40, 300);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('один элемент: стрелок нет, клавиши не листают', () => {
    const { onSelect } = show(0, [art]);
    expect(screen.getByText('01 / 01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Следующее медиа' })).toBeNull();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('YouTube через youtube-nocookie; при листании плеер убирается — видео останавливается', () => {
    const { rerender } = show(2);
    const frame = screen.getByTitle('Синематик');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('src')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/abcDEF_12-x\?/);
    rerender(0);
    expect(screen.queryByTitle('Синематик')).toBeNull();
  });

  it('закрытие: ×, Esc, клик по затемнению; клик внутри окна не закрывает', () => {
    const { onClose } = show(0);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть галерею' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('gallery-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('картинка не загрузилась — сообщение и ссылка на источник', () => {
    show(1);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText(/Картинка не загрузилась/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Источник ↗' })).toHaveLength(2);
  });

  it('фокус: на «закрыть» при открытии, Tab не выходит из окна, после закрытия — обратно на карточку', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const view = render(
      <I18nProvider initialLang="ru">
        <Gallery items={items} index={0} onSelect={() => undefined} onClose={() => undefined} />
      </I18nProvider>,
    );
    const close = screen.getByRole('button', { name: 'Закрыть галерею' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('link', { name: 'Читать комикс целиком ↗' })).toHaveFocus();
    view.unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  describe('полноэкранный режим', () => {
    const request = vi.fn(() => Promise.resolve());
    beforeEach(() => {
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
      HTMLElement.prototype.requestFullscreen = request;
    });
    afterEach(() => {
      Reflect.deleteProperty(document, 'fullscreenEnabled');
      Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
    });

    it('кнопка разворачивает блок медиа', () => {
      show(0);
      fireEvent.click(screen.getByRole('button', { name: 'Во весь экран' }));
      expect(request).toHaveBeenCalledTimes(1);
    });
  });

  it('без поддержки fullscreen кнопки нет', () => {
    show(0);
    expect(screen.queryByRole('button', { name: 'Во весь экран' })).toBeNull();
  });
});

describe('что показывает галерея', () => {
  it('медиа экрана, с которого открыта; чужое медиа — одно; неизвестное — ничего', () => {
    expect(galleryOf({ screen: { name: 'region', regionId: 'icewrack' } })).toBeNull();
    const region = galleryOf({ screen: { name: 'region', regionId: 'icewrack' }, media: 'icewrack-new-neighbors' });
    expect(region?.items.map((m) => m.id)).toEqual(['icewrack-new-neighbors']);
    expect(region?.index).toBe(0);
    const place = galleryOf({ screen: { name: 'place', regionId: 'icewrack', placeSlug: 'frostreach' }, media: 'frostreach-the-dragon' });
    expect(place?.items.map((m) => m.id)).toEqual(['frostreach-the-dragon']);
    const foreign = galleryOf({ screen: { name: 'world' }, media: 'hells-ascension' });
    expect(foreign).toEqual({ items: [getMedia('hells-ascension')], index: 0 });
    expect(galleryOf({ screen: { name: 'world' }, media: 'nope' })).toBeNull();
  });

  it('счётчик с ведущим нулём', () => {
    expect(counter(0, 3)).toBe('01 / 03');
    expect(counter(11, 12)).toBe('12 / 12');
  });

  it('ссылка на dota2.com — на языке интерфейса, другие источники — как есть', () => {
    expect(mediaSourceUrl(comic, 'en')).toBe('https://www.dota2.com/comic?l=english');
    expect(mediaSourceUrl({ ...comic, sourceUrl: 'https://www.dota2.com/x?l=english' }, 'ru')).toBe('https://www.dota2.com/x?l=russian');
    expect(mediaSourceUrl(art, 'ru')).toBe('https://example.com/art');
  });
});

describe('галерея в приложении', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('карточка открывает галерею на своём элементе; Esc закрывает только её, следующий Esc — на уровень вверх', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const title = getMedia('icewrack-new-neighbors')!.title.ru;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(title) }));
    expect(window.location.hash).toBe('#/r/icewrack?media=icewrack-new-neighbors');
    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();

    const length = window.history.length;
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(window.history.length).toBe(length);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/world');
  });

  it('по прямой ссылке галерея открыта; неизвестное медиа и интро — без галереи', () => {
    window.location.hash = '#/r/icewrack/frostreach?media=frostreach-the-dragon';
    const view = render(<App />);
    expect(screen.getByRole('dialog', { name: getMedia('frostreach-the-dragon')!.title.ru })).toBeInTheDocument();
    view.unmount();

    window.location.hash = '#/r/icewrack?media=nope';
    const unknown = render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull();
    unknown.unmount();

    window.location.hash = '#/?media=hells-ascension';
    render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
