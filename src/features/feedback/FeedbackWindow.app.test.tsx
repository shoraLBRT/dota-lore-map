import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { MESSAGE_LIMIT } from './message';

// Окно обратной связи в приложении (E17, #73; SPEC §6.9); прямая отправка в функцию — #75.

const DRAFT = 'dota-lore-map.feedback.draft';
const button = () => screen.getByRole('button', { name: 'Обратная связь' });
const dialog = () => screen.queryByRole('dialog', { name: 'Обратная связь' });

/** Нажать и отпустить на месте. */
function tap(el: Element) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: 100, clientY: 100 });
}

function openWindow() {
  const b = button();
  b.focus();
  fireEvent.click(b);
  return dialog()!;
}

describe('окно обратной связи', () => {
  beforeEach(() => {
    // Отправка ссылкой (#73) — и тогда, когда в .env уже вписан адрес функции отзыва (#75).
    vi.stubEnv('VITE_FEEDBACK_URL', '');
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    window.location.hash = '#/r/icewrack?hero=crystal_maiden&profile';
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('кнопка в левой панели открывает окно: пояснение про публичность и аккаунт, фокус в поле, без затемнения', () => {
    render(<App />);
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    const win = openWindow();
    expect(button()).toHaveAttribute('aria-expanded', 'true');
    expect(win).toHaveTextContent('опубликовано открыто на GitHub');
    expect(win).toHaveTextContent('аккаунт GitHub');
    expect(within(win).getByRole('textbox', { name: 'Сообщение' })).toHaveFocus();
    // Пустое сообщение не отправить.
    expect(within(win).getByRole('button', { name: /^Отправить/ })).toBeDisabled();
    expect(win.parentElement).toBe(document.body);
  });

  it('счётчик и потолок 1000 символов; «Отправить» — ссылка на форму issue с текстом, контекстом и меткой', () => {
    render(<App />);
    const win = openWindow();
    const field = within(win).getByRole('textbox', { name: 'Сообщение' });
    fireEvent.change(field, { target: { value: 'Опечатка в описании\nвторая строка' } });
    expect(win).toHaveTextContent(`33 / ${MESSAGE_LIMIT}`);
    const send = within(win).getByRole('link', { name: /^Отправить/ });
    expect(send).toHaveAttribute('target', '_blank');
    expect(send).toHaveAttribute('rel', 'noopener noreferrer');
    const url = new URL(send.getAttribute('href')!);
    expect(url.origin + url.pathname).toBe('https://github.com/shoraLBRT/dota-lore-map/issues/new');
    expect(url.searchParams.get('title')).toBe('Отзыв с карты: Опечатка в описании');
    expect(url.searchParams.get('labels')).toBe('feedback');
    const body = url.searchParams.get('body')!;
    expect(body.startsWith('Опечатка в описании\nвторая строка')).toBe(true);
    expect(body).toContain('- Экран: регион');
    expect(body).toContain('- Регион: Айсрак (`icewrack`)');
    expect(body).toContain('- Герой: Crystal Maiden (`crystal_maiden`), профиль открыт');
    expect(body).toContain('- Язык: ru');
    expect(body).toContain('#/r/icewrack?hero=crystal_maiden&profile');

    fireEvent.change(field, { target: { value: 'я'.repeat(MESSAGE_LIMIT + 50) } });
    expect((field as HTMLTextAreaElement).value).toHaveLength(MESSAGE_LIMIT);
    expect(win).toHaveTextContent(`${MESSAGE_LIMIT} / ${MESSAGE_LIMIT}`);
  });

  it('Esc закрывает окно первым: профиль и герой остаются, фокус — на кнопке; черновик не теряется', () => {
    render(<App />);
    const win = openWindow();
    const field = within(win).getByRole('textbox', { name: 'Сообщение' });
    fireEvent.change(field, { target: { value: 'черновик' } });
    expect(window.localStorage.getItem(DRAFT)).toBe('черновик');
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(dialog()).toBeNull();
    expect(window.location.hash).toBe('#/r/icewrack?hero=crystal_maiden&profile');
    expect(button()).toHaveFocus();

    const again = openWindow();
    expect(within(again).getByRole('textbox', { name: 'Сообщение' })).toHaveValue('черновик');
  });

  it('Esc, когда фокус ушёл из окна, тоже закрывает сначала окно', () => {
    render(<App />);
    openWindow();
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog()).toBeNull();
    expect(window.location.hash).toBe('#/r/icewrack?hero=crystal_maiden&profile');
  });

  it('× и клик вне окна закрывают; повторный клик по кнопке — тоже', () => {
    render(<App />);
    let win = openWindow();
    fireEvent.click(within(win).getByRole('button', { name: 'Закрыть' }));
    expect(dialog()).toBeNull();
    expect(button()).toHaveFocus();

    win = openWindow();
    tap(win.querySelector('p')!);
    expect(dialog()).not.toBeNull();
    const outside = document.querySelector('main') ?? document.body.firstElementChild!;
    // Перетаскивание карты окно не закрывает (#182), тап мимо — закрывает.
    fireEvent.pointerDown(outside, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(outside, { pointerId: 1, clientX: 160, clientY: 100 });
    expect(dialog()).not.toBeNull();
    tap(outside);
    expect(dialog()).toBeNull();

    openWindow();
    tap(button());
    fireEvent.click(button());
    expect(dialog()).toBeNull();
  });

  it('Tab не выходит из окна: с последнего элемента — на первый и обратно', () => {
    render(<App />);
    const win = openWindow();
    const field = within(win).getByRole('textbox', { name: 'Сообщение' });
    fireEvent.change(field, { target: { value: 'текст' } });
    const close = within(win).getByRole('button', { name: 'Закрыть' });
    const send = within(win).getByRole('link', { name: /^Отправить/ });
    send.focus();
    fireEvent.keyDown(send, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(send).toHaveFocus();
  });

  it('после отправки черновик очищен, окно сообщает, что форма открыта в новой вкладке', () => {
    vi.useFakeTimers();
    window.localStorage.setItem(DRAFT, 'готовый текст');
    render(<App />);
    const win = openWindow();
    const send = within(win).getByRole('link', { name: /^Отправить/ });
    // Переход по ссылке в jsdom не случается; проверяем, что после клика ссылка ещё на месте.
    send.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(send);
    expect(send).toBeInTheDocument();
    act(() => vi.runAllTimers());
    expect(window.localStorage.getItem(DRAFT)).toBeNull();
    expect(within(win).getByRole('textbox', { name: 'Сообщение' })).toHaveValue('');
    expect(within(win).getByRole('status')).toHaveTextContent('Форма открыта в новой вкладке');
  });

  it('по-английски — английские тексты окна и issue', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'en');
    window.location.hash = '#/world';
    render(<App />);
    const b = screen.getByRole('button', { name: 'Feedback' });
    fireEvent.click(b);
    const win = screen.getByRole('dialog', { name: 'Feedback' });
    expect(win).toHaveTextContent('published openly on GitHub');
    fireEvent.change(within(win).getByRole('textbox', { name: 'Message' }), { target: { value: 'Nice map' } });
    const url = new URL(within(win).getByRole('link', { name: /^Send/ }).getAttribute('href')!);
    expect(url.searchParams.get('title')).toBe('Feedback from the map: Nice map');
    expect(url.searchParams.get('body')).toContain('- Screen: world');
  });

  it('«О проекте» говорит про обратную связь и публичность сообщений', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'О проекте' }));
    expect(screen.getByRole('dialog', { name: 'О проекте' })).toHaveTextContent('публикуются открыто как issue на GitHub');
  });
});

describe('«Нашли ошибку?» у блоков (#74)', () => {
  const LINK = 'Нашли ошибку или знаете больше? Расскажите';
  const link = () => screen.getByRole('button', { name: LINK });
  const sendUrl = (win: HTMLElement) => new URL(within(win).getByRole('link', { name: /^Отправить/ }).getAttribute('href')!);

  beforeEach(() => {
    vi.stubEnv('VITE_FEEDBACK_URL', '');
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    window.localStorage.removeItem(DRAFT);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('панель региона: строка в конце, окно о регионе с выбором вида, issue с блоком и метками', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const l = link();
    expect(l).toHaveAttribute('data-feedback-opener');
    l.focus();
    fireEvent.click(l);
    const win = dialog()!;
    expect(win).toHaveTextContent('Регион: Айсрак');
    const kinds = within(win).getByRole('group', { name: 'Что это' });
    expect(within(kinds).getByRole('radio', { name: 'Ошибка' })).toBeChecked();
    const field = within(win).getByRole('textbox', { name: 'Сообщение' });
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: 'Не тот год основания' } });
    let url = sendUrl(win);
    expect(url.searchParams.get('title')).toBe('Ошибка в «Айсрак»: Не тот год основания');
    expect(url.searchParams.get('labels')).toBe('feedback,content-fix');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('- Блок: регион Айсрак (`icewrack`)');
    expect(body).toContain('- Вид: ошибка');
    expect(body).toContain('- Язык: ru');
    expect(body).toContain('#/r/icewrack');

    fireEvent.click(within(kinds).getByRole('radio', { name: 'Дополнение' }));
    url = sendUrl(win);
    expect(url.searchParams.get('title')).toBe('Дополнение к «Айсрак»: Не тот год основания');
    expect(url.searchParams.get('body')).toContain('- Вид: дополнение');
    fireEvent.click(within(kinds).getByRole('radio', { name: 'Другое' }));
    expect(sendUrl(win).searchParams.get('title')).toBe('Отзыв о «Айсрак»: Не тот год основания');

    // Esc закрывает окно, экран остаётся, фокус — на строке, которая его открыла.
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(dialog()).toBeNull();
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(link()).toHaveFocus();
  });

  it('панель места и профиль героя — свой блок; общая кнопка — без блока и без выбора вида', () => {
    window.location.hash = '#/r/icewrack/the-barrier';
    const view = render(<App />);
    fireEvent.click(link());
    let win = dialog()!;
    expect(win).toHaveTextContent('Место: Барьер');
    fireEvent.change(within(win).getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'x' } });
    expect(sendUrl(win).searchParams.get('body')).toContain('- Блок: место Барьер (`icewrack/the-barrier`)');
    fireEvent.click(within(win).getByRole('button', { name: 'Закрыть' }));
    view.unmount();

    window.location.hash = '#/r/icewrack?hero=crystal_maiden&profile';
    render(<App />);
    fireEvent.click(link());
    win = dialog()!;
    expect(win).toHaveTextContent('Герой: Crystal Maiden');
    expect(sendUrl(win).searchParams.get('title')).toBe('Ошибка в «Crystal Maiden»: x');
    // Общая кнопка левой панели — переключатель: закрывает окно, а открывает его без блока.
    fireEvent.click(button());
    expect(dialog()).toBeNull();
    fireEvent.click(button());
    win = dialog()!;
    expect(within(win).queryByRole('group')).toBeNull();
    expect(sendUrl(win).searchParams.get('labels')).toBe('feedback');
    expect(sendUrl(win).searchParams.get('title')).toBe('Отзыв с карты: x');
  });

  // Листание при открытом окне — в Gallery.test (здесь у медиа региона один элемент).
  it('медиа в галерее: окно поверх галереи, Esc закрывает сначала окно, фокус — на строке в галерее', () => {
    window.location.hash = '#/r/icewrack?media=icewrack-new-neighbors';
    render(<App />);
    const gallery = screen.getByRole('dialog', { name: '«Новые соседи»' });
    const l = within(gallery).getByRole('button', { name: LINK });
    l.focus();
    fireEvent.click(l);
    const win = dialog()!;
    expect(win).toHaveTextContent('Медиа: «Новые соседи»');
    const field = within(win).getByRole('textbox', { name: 'Сообщение' });
    fireEvent.change(field, { target: { value: 'Неверная подпись' } });
    const url = sendUrl(win);
    expect(url.searchParams.get('title')).toBe('Ошибка в «Новые соседи»: Неверная подпись');
    expect(url.searchParams.get('body')).toContain('- Блок: медиа «Новые соседи» (`icewrack-new-neighbors`)');
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(dialog()).toBeNull();
    expect(screen.getByRole('dialog', { name: '«Новые соседи»' })).toBeInTheDocument();
    expect(within(gallery).getByRole('button', { name: LINK })).toHaveFocus();
  });

  it('по-английски — строка, подпись блока, виды и заголовок issue на английском', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'en');
    window.location.hash = '#/r/icewrack';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Spotted a mistake or know more? Tell us' }));
    const win = screen.getByRole('dialog', { name: 'Feedback' });
    expect(win).toHaveTextContent('Region: Icewrack');
    const kinds = within(win).getByRole('group', { name: 'What is it' });
    for (const name of ['Mistake', 'Addition', 'Other']) expect(within(kinds).getByRole('radio', { name })).toBeInTheDocument();
    fireEvent.change(within(win).getByRole('textbox', { name: 'Message' }), { target: { value: 'Wrong date' } });
    const url = new URL(within(win).getByRole('link', { name: /^Send/ }).getAttribute('href')!);
    expect(url.searchParams.get('title')).toBe('Mistake in “Icewrack”: Wrong date');
    expect(url.searchParams.get('body')).toContain('- Block: region Icewrack (`icewrack`)');
    expect(url.searchParams.get('body')).toContain('- Kind: mistake');
  });
});

describe('отправка без аккаунта GitHub (#75)', () => {
  const ENDPOINT = 'https://feedback.example/';
  let options: Record<string, (value?: string) => unknown>;
  let fetchMock: ReturnType<typeof vi.fn>;
  const turnstile = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };

  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    window.location.hash = '#/r/icewrack';
    vi.stubEnv('VITE_FEEDBACK_URL', ENDPOINT);
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
    turnstile.render.mockImplementation((_el: HTMLElement, o: typeof options) => {
      options = o;
      return 'widget-1';
    });
    window.turnstile = turnstile;
    fetchMock = vi.fn(async () =>
      Response.json({ number: 42, url: 'https://github.com/shoraLBRT/dota-lore-map/issues/42' }, { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete window.turnstile;
  });

  /** Окно открыто, Turnstile отрисован и выдал токен. */
  async function openPassed() {
    render(<App />);
    const win = openWindow();
    await act(async () => {});
    expect(turnstile.render).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ sitekey: 'site-key', language: 'ru' }));
    act(() => void options.callback!('token-1'));
    return win;
  }

  it('аккаунт не нужен: «Отправить» — кнопка, отзыв уходит в функцию с токеном, черновик очищен, ссылка на issue', async () => {
    const win = await openPassed();
    expect(win).toHaveTextContent('Аккаунт не нужен');
    expect(win).not.toHaveTextContent('Нужен аккаунт GitHub');
    const field = within(win).getByRole('textbox', { name: 'Сообщение' });
    const send = within(win).getByRole('button', { name: 'Отправить' });
    expect(send).toBeDisabled();
    fireEvent.change(field, { target: { value: 'Опечатка в описании' } });
    expect(within(win).queryByRole('link', { name: /^Отправить/ })).toBeNull();
    await act(async () => void fireEvent.click(send));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    const sent = JSON.parse(init.body as string);
    expect(sent.title).toBe('Отзыв с карты: Опечатка в описании');
    expect(sent.body).toContain('- Регион: Айсрак (`icewrack`)');
    expect(sent.labels).toEqual(['feedback']);
    expect(sent.token).toBe('token-1');

    expect(field).toHaveValue('');
    expect(window.localStorage.getItem(DRAFT)).toBeNull();
    const status = within(win).getByRole('status');
    expect(status).toHaveTextContent('Отзыв отправлен: issue #42');
    expect(within(status).getByRole('link', { name: 'Открыть на GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/shoraLBRT/dota-lore-map/issues/42',
    );
    // Токен одноразовый: после отправки — новый.
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1');
  });

  it('функция не ответила — сообщение и запасной путь, форма issue на GitHub; черновик цел', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    const win = await openPassed();
    fireEvent.change(within(win).getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Опечатка' } });
    await act(async () => void fireEvent.click(within(win).getByRole('button', { name: 'Отправить' })));
    const alert = within(win).getByRole('alert');
    expect(alert).toHaveTextContent('Не удалось отправить');
    const link = within(alert).getByRole('link', { name: /форму issue на GitHub/ });
    expect(link.getAttribute('href')!.startsWith('https://github.com/shoraLBRT/dota-lore-map/issues/new?title=')).toBe(true);
    expect(window.localStorage.getItem(DRAFT)).toBe('Опечатка');
  });

  it('Turnstile нужен человек — окно просит отметить флажок', async () => {
    const win = await openPassed();
    act(() => void options['before-interactive-callback']!());
    expect(within(win).getByRole('status')).toHaveTextContent('Отметьте флажок');
  });

  it('Turnstile не загрузился — окно работает по-старому, ссылкой на форму issue', async () => {
    delete window.turnstile;
    const append = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      queueMicrotask(() => (node as HTMLScriptElement).onerror?.(new Event('error')));
      return node;
    });
    render(<App />);
    const win = openWindow();
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ src: expect.stringContaining('challenges.cloudflare.com/turnstile') }));
    await act(async () => {});
    expect(win).toHaveTextContent('Нужен аккаунт GitHub');
    fireEvent.change(within(win).getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Опечатка' } });
    expect(within(win).getByRole('link', { name: /^Отправить/ })).toBeInTheDocument();
    append.mockRestore();
  });

  it('без открытого окна скрипт Turnstile не грузится', () => {
    delete window.turnstile;
    const append = vi.spyOn(document.head, 'appendChild');
    render(<App />);
    expect(append).not.toHaveBeenCalledWith(expect.objectContaining({ src: expect.stringContaining('turnstile') }));
    append.mockRestore();
  });
});
