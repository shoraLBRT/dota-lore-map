import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { MESSAGE_LIMIT } from "./message";

// Окно обратной связи в приложении (E17, #73; SPEC §6.9).

const DRAFT = "dota-lore-map.feedback.draft";
const button = () => screen.getByRole("button", { name: "Обратная связь" });
const dialog = () => screen.queryByRole("dialog", { name: "Обратная связь" });

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

describe("окно обратной связи", () => {
  beforeEach(() => {
    window.localStorage.setItem("dota-lore-map.lang", "ru");
    window.location.hash = "#/r/icewrack?hero=crystal_maiden&profile";
  });
  afterEach(() => vi.useRealTimers());

  it("кнопка в левой панели открывает окно: пояснение про публичность и аккаунт, фокус в поле, без затемнения", () => {
    render(<App />);
    expect(button()).toHaveAttribute("aria-expanded", "false");
    const win = openWindow();
    expect(button()).toHaveAttribute("aria-expanded", "true");
    expect(win).toHaveTextContent("опубликовано открыто на GitHub");
    expect(win).toHaveTextContent("аккаунт GitHub");
    expect(
      within(win).getByRole("textbox", { name: "Сообщение" }),
    ).toHaveFocus();
    // Пустое сообщение не отправить.
    expect(
      within(win).getByRole("button", { name: /^Отправить/ }),
    ).toBeDisabled();
    expect(win.parentElement).toBe(document.body);
  });

  it("счётчик и потолок 1000 символов; «Отправить» — ссылка на форму issue с текстом, контекстом и меткой", () => {
    render(<App />);
    const win = openWindow();
    const field = within(win).getByRole("textbox", { name: "Сообщение" });
    fireEvent.change(field, {
      target: { value: "Опечатка в описании\nвторая строка" },
    });
    expect(win).toHaveTextContent(`33 / ${MESSAGE_LIMIT}`);
    const send = within(win).getByRole("link", { name: /^Отправить/ });
    expect(send).toHaveAttribute("target", "_blank");
    expect(send).toHaveAttribute("rel", "noopener noreferrer");
    const url = new URL(send.getAttribute("href")!);
    expect(url.origin + url.pathname).toBe(
      "https://github.com/shoraLBRT/dota-lore-map/issues/new",
    );
    expect(url.searchParams.get("title")).toBe(
      "Отзыв с карты: Опечатка в описании",
    );
    expect(url.searchParams.get("labels")).toBe("feedback");
    const body = url.searchParams.get("body")!;
    expect(body.startsWith("Опечатка в описании\nвторая строка")).toBe(true);
    expect(body).toContain("- Экран: регион");
    expect(body).toContain("- Регион: Айсрак (`icewrack`)");
    expect(body).toContain(
      "- Герой: Crystal Maiden (`crystal_maiden`), профиль открыт",
    );
    expect(body).toContain("- Язык: ru");
    expect(body).toContain("#/r/icewrack?hero=crystal_maiden&profile");

    fireEvent.change(field, {
      target: { value: "я".repeat(MESSAGE_LIMIT + 50) },
    });
    expect((field as HTMLTextAreaElement).value).toHaveLength(MESSAGE_LIMIT);
    expect(win).toHaveTextContent(`${MESSAGE_LIMIT} / ${MESSAGE_LIMIT}`);
  });

  it("Esc закрывает окно первым: профиль и герой остаются, фокус — на кнопке; черновик не теряется", () => {
    render(<App />);
    const win = openWindow();
    const field = within(win).getByRole("textbox", { name: "Сообщение" });
    fireEvent.change(field, { target: { value: "черновик" } });
    expect(window.localStorage.getItem(DRAFT)).toBe("черновик");
    fireEvent.keyDown(field, { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(window.location.hash).toBe(
      "#/r/icewrack?hero=crystal_maiden&profile",
    );
    expect(button()).toHaveFocus();

    const again = openWindow();
    expect(
      within(again).getByRole("textbox", { name: "Сообщение" }),
    ).toHaveValue("черновик");
  });

  it("Esc, когда фокус ушёл из окна, тоже закрывает сначала окно", () => {
    render(<App />);
    openWindow();
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(window.location.hash).toBe(
      "#/r/icewrack?hero=crystal_maiden&profile",
    );
  });

  it("× и клик вне окна закрывают; повторный клик по кнопке — тоже", () => {
    render(<App />);
    let win = openWindow();
    fireEvent.click(within(win).getByRole("button", { name: "Закрыть" }));
    expect(dialog()).toBeNull();
    expect(button()).toHaveFocus();

    win = openWindow();
    tap(win.querySelector("p")!);
    expect(dialog()).not.toBeNull();
    const outside =
      document.querySelector("main") ?? document.body.firstElementChild!;
    // Перетаскивание карты окно не закрывает (#182), тап мимо — закрывает.
    fireEvent.pointerDown(outside, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(outside, { pointerId: 1, clientX: 160, clientY: 100 });
    expect(dialog()).not.toBeNull();
    tap(outside);
    expect(dialog()).toBeNull();

    openWindow();
    tap(button());
    fireEvent.click(button());
    expect(dialog()).toBeNull();
  });

  it("Tab не выходит из окна: с последнего элемента — на первый и обратно", () => {
    render(<App />);
    const win = openWindow();
    const field = within(win).getByRole("textbox", { name: "Сообщение" });
    fireEvent.change(field, { target: { value: "текст" } });
    const close = within(win).getByRole("button", { name: "Закрыть" });
    const send = within(win).getByRole("link", { name: /^Отправить/ });
    send.focus();
    fireEvent.keyDown(send, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(send).toHaveFocus();
  });

  it("после отправки черновик очищен, окно сообщает, что форма открыта в новой вкладке", () => {
    vi.useFakeTimers();
    window.localStorage.setItem(DRAFT, "готовый текст");
    render(<App />);
    const win = openWindow();
    const send = within(win).getByRole("link", { name: /^Отправить/ });
    // Переход по ссылке в jsdom не случается; проверяем, что после клика ссылка ещё на месте.
    send.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(send);
    expect(send).toBeInTheDocument();
    act(() => vi.runAllTimers());
    expect(window.localStorage.getItem(DRAFT)).toBeNull();
    expect(within(win).getByRole("textbox", { name: "Сообщение" })).toHaveValue(
      "",
    );
    expect(within(win).getByRole("status")).toHaveTextContent(
      "Форма открыта в новой вкладке",
    );
  });

  it("по-английски — английские тексты окна и issue", () => {
    window.localStorage.setItem("dota-lore-map.lang", "en");
    window.location.hash = "#/world";
    render(<App />);
    const b = screen.getByRole("button", { name: "Feedback" });
    fireEvent.click(b);
    const win = screen.getByRole("dialog", { name: "Feedback" });
    expect(win).toHaveTextContent("published openly on GitHub");
    fireEvent.change(within(win).getByRole("textbox", { name: "Message" }), {
      target: { value: "Nice map" },
    });
    const url = new URL(
      within(win).getByRole("link", { name: /^Send/ }).getAttribute("href")!,
    );
    expect(url.searchParams.get("title")).toBe(
      "Feedback from the map: Nice map",
    );
    expect(url.searchParams.get("body")).toContain("- Screen: world");
  });

  it("«О проекте» говорит про обратную связь и публичность сообщений", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "О проекте" }));
    expect(screen.getByRole("dialog", { name: "О проекте" })).toHaveTextContent(
      "публикуются открыто как issue на GitHub",
    );
  });
});

describe("«Нашли ошибку?» у блоков (#74)", () => {
  const LINK = "Нашли ошибку или знаете больше? Расскажите";
  const link = () => screen.getByRole("button", { name: LINK });
  const sendUrl = (win: HTMLElement) =>
    new URL(
      within(win)
        .getByRole("link", { name: /^Отправить/ })
        .getAttribute("href")!,
    );

  beforeEach(() => {
    window.localStorage.setItem("dota-lore-map.lang", "ru");
    window.localStorage.removeItem(DRAFT);
  });

  it("панель региона: строка в конце, окно о регионе с выбором вида, issue с блоком и метками", () => {
    window.location.hash = "#/r/icewrack";
    render(<App />);
    const l = link();
    expect(l).toHaveAttribute("data-feedback-opener");
    l.focus();
    fireEvent.click(l);
    const win = dialog()!;
    expect(win).toHaveTextContent("Регион: Айсрак");
    const kinds = within(win).getByRole("group", { name: "Что это" });
    expect(within(kinds).getByRole("radio", { name: "Ошибка" })).toBeChecked();
    const field = within(win).getByRole("textbox", { name: "Сообщение" });
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: "Не тот год основания" } });
    let url = sendUrl(win);
    expect(url.searchParams.get("title")).toBe(
      "Ошибка в «Айсрак»: Не тот год основания",
    );
    expect(url.searchParams.get("labels")).toBe("feedback,content-fix");
    const body = url.searchParams.get("body")!;
    expect(body).toContain("- Блок: регион Айсрак (`icewrack`)");
    expect(body).toContain("- Вид: ошибка");
    expect(body).toContain("- Язык: ru");
    expect(body).toContain("#/r/icewrack");

    fireEvent.click(within(kinds).getByRole("radio", { name: "Дополнение" }));
    url = sendUrl(win);
    expect(url.searchParams.get("title")).toBe(
      "Дополнение к «Айсрак»: Не тот год основания",
    );
    expect(url.searchParams.get("body")).toContain("- Вид: дополнение");
    fireEvent.click(within(kinds).getByRole("radio", { name: "Другое" }));
    expect(sendUrl(win).searchParams.get("title")).toBe(
      "Отзыв о «Айсрак»: Не тот год основания",
    );

    // Esc закрывает окно, экран остаётся, фокус — на строке, которая его открыла.
    fireEvent.keyDown(field, { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(window.location.hash).toBe("#/r/icewrack");
    expect(link()).toHaveFocus();
  });

  it("панель места и профиль героя — свой блок; общая кнопка — без блока и без выбора вида", () => {
    window.location.hash = "#/r/icewrack/the-barrier";
    const view = render(<App />);
    fireEvent.click(link());
    let win = dialog()!;
    expect(win).toHaveTextContent("Место: Барьер");
    fireEvent.change(within(win).getByRole("textbox", { name: "Сообщение" }), {
      target: { value: "x" },
    });
    expect(sendUrl(win).searchParams.get("body")).toContain(
      "- Блок: место Барьер (`icewrack/the-barrier`)",
    );
    fireEvent.click(within(win).getByRole("button", { name: "Закрыть" }));
    view.unmount();

    window.location.hash = "#/r/icewrack?hero=crystal_maiden&profile";
    render(<App />);
    fireEvent.click(link());
    win = dialog()!;
    expect(win).toHaveTextContent("Герой: Crystal Maiden");
    expect(sendUrl(win).searchParams.get("title")).toBe(
      "Ошибка в «Crystal Maiden»: x",
    );
    // Общая кнопка левой панели — переключатель: закрывает окно, а открывает его без блока.
    fireEvent.click(button());
    expect(dialog()).toBeNull();
    fireEvent.click(button());
    win = dialog()!;
    expect(within(win).queryByRole("group")).toBeNull();
    expect(sendUrl(win).searchParams.get("labels")).toBe("feedback");
    expect(sendUrl(win).searchParams.get("title")).toBe("Отзыв с карты: x");
  });

  // Листание при открытом окне — в Gallery.test (здесь у медиа региона один элемент).
  it("медиа в галерее: окно поверх галереи, Esc закрывает сначала окно, фокус — на строке в галерее", () => {
    window.location.hash = "#/r/icewrack?media=icewrack-new-neighbors";
    render(<App />);
    const gallery = screen.getByRole("dialog", { name: "«Новые соседи»" });
    const l = within(gallery).getByRole("button", { name: LINK });
    l.focus();
    fireEvent.click(l);
    const win = dialog()!;
    expect(win).toHaveTextContent("Медиа: «Новые соседи»");
    const field = within(win).getByRole("textbox", { name: "Сообщение" });
    fireEvent.change(field, { target: { value: "Неверная подпись" } });
    const url = sendUrl(win);
    expect(url.searchParams.get("title")).toBe(
      "Ошибка в «Новые соседи»: Неверная подпись",
    );
    expect(url.searchParams.get("body")).toContain(
      "- Блок: медиа «Новые соседи» (`icewrack-new-neighbors`)",
    );
    fireEvent.keyDown(field, { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "«Новые соседи»" }),
    ).toBeInTheDocument();
    expect(within(gallery).getByRole("button", { name: LINK })).toHaveFocus();
  });

  it("по-английски — строка, подпись блока, виды и заголовок issue на английском", () => {
    window.localStorage.setItem("dota-lore-map.lang", "en");
    window.location.hash = "#/r/icewrack";
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Spotted a mistake or know more? Tell us",
      }),
    );
    const win = screen.getByRole("dialog", { name: "Feedback" });
    expect(win).toHaveTextContent("Region: Icewrack");
    const kinds = within(win).getByRole("group", { name: "What is it" });
    for (const name of ["Mistake", "Addition", "Other"])
      expect(within(kinds).getByRole("radio", { name })).toBeInTheDocument();
    fireEvent.change(within(win).getByRole("textbox", { name: "Message" }), {
      target: { value: "Wrong date" },
    });
    const url = new URL(
      within(win).getByRole("link", { name: /^Send/ }).getAttribute("href")!,
    );
    expect(url.searchParams.get("title")).toBe(
      "Mistake in “Icewrack”: Wrong date",
    );
    expect(url.searchParams.get("body")).toContain(
      "- Block: region Icewrack (`icewrack`)",
    );
    expect(url.searchParams.get("body")).toContain("- Kind: mistake");
  });
});
