import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavigationProvider, useNavigation } from "./navigation";

type Nav = ReturnType<typeof useNavigation>;

function setup() {
  const ref: { nav: Nav | null } = { nav: null };
  function Probe() {
    ref.nav = useNavigation();
    return null;
  }
  render(
    <NavigationProvider>
      <Probe />
    </NavigationProvider>,
  );
  return () => ref.nav!;
}

describe("навигация: очередь на время анимации камеры (SPEC §7.1)", () => {
  it("без анимации open переходит сразу", () => {
    const nav = setup();
    act(() => nav().open({ name: "world" }));
    expect(window.location.hash).toBe("#/world");
    expect(nav().route.screen).toEqual({ name: "world" });
  });

  it("во время анимации переходы ждут, после неё выполняется последний", async () => {
    const nav = setup();
    act(() => nav().open({ name: "world" }));
    let release = () => {};
    act(() => {
      release = nav().hold();
    });
    act(() => nav().open({ name: "region", regionId: "icewrack" }));
    act(() => nav().open({ name: "region", regionId: "tomokan" }));
    expect(window.location.hash).toBe("#/world");

    act(() => release());
    expect(window.location.hash).toBe("#/r/tomokan");
    // Повторный release ничего не ломает.
    act(() => release());
    act(() => nav().open({ name: "world" }));
    await waitFor(() => expect(window.location.hash).toBe("#/world"));
  });

  it("переход извне (кнопка «назад» браузера) отменяет очередь", async () => {
    const nav = setup();
    act(() => nav().open({ name: "world" }));
    let release = () => {};
    act(() => {
      release = nav().hold();
    });
    act(() => nav().open({ name: "region", regionId: "icewrack" }));
    await act(async () => {
      window.location.hash = "#/r/tomokan";
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(nav().route.screen).toEqual({ name: "region", regionId: "tomokan" });
    act(() => release());
    expect(window.location.hash).toBe("#/r/tomokan");
  });
});

describe("навигация: закрыть — шаг назад по истории (A5, #182)", () => {
  it("переход на адрес прошлой записи — history.back(), запись не добавляется", async () => {
    const nav = setup();
    act(() => nav().open({ name: "world" }));
    act(() => nav().open({ name: "region", regionId: "icewrack" }));
    act(() =>
      nav().open({ name: "place", regionId: "icewrack", placeSlug: "cobalt" }),
    );
    const length = window.history.length;
    act(() => nav().open({ name: "region", regionId: "icewrack" }));
    // Состояние — сразу, адрес — после шага назад.
    expect(nav().route.screen).toEqual({
      name: "region",
      regionId: "icewrack",
    });
    await waitFor(() => expect(window.location.hash).toBe("#/r/icewrack"));
    expect(window.history.length).toBe(length);
    // Ещё шаг вверх — снова назад, в мир.
    act(() => nav().open({ name: "world" }));
    await waitFor(() => expect(window.location.hash).toBe("#/world"));
    expect(window.history.length).toBe(length);
  });

  it("два перехода подряд, пока идёт шаг назад, — оба выполняются по порядку", async () => {
    const nav = setup();
    act(() => nav().open({ name: "world" }));
    act(() => nav().open({ name: "region", regionId: "icewrack" }));
    act(() =>
      nav().open({ name: "place", regionId: "icewrack", placeSlug: "cobalt" }),
    );
    act(() => nav().open({ name: "region", regionId: "icewrack" }));
    act(() => nav().open({ name: "world" }));
    expect(nav().route.screen).toEqual({ name: "world" });
    await waitFor(() => expect(window.location.hash).toBe("#/world"));
  });

  it("закрытие галереи — шаг назад: следующий «назад» ведёт на прошлый экран, а не на копию", async () => {
    const nav = setup();
    act(() => nav().open({ name: "world" }));
    act(() => nav().open({ name: "region", regionId: "icewrack" }));
    act(() =>
      nav().navigate({
        screen: { name: "region", regionId: "icewrack" },
        media: "a",
      }),
    );
    act(() =>
      nav().navigate(
        { screen: { name: "region", regionId: "icewrack" }, media: "b" },
        { replace: true },
      ),
    );
    act(() =>
      nav().navigate(
        { screen: { name: "region", regionId: "icewrack" } },
        { replace: true },
      ),
    );
    await waitFor(() => expect(window.location.hash).toBe("#/r/icewrack"));
    await act(async () => {
      window.history.back();
      await waitFor(() => expect(window.location.hash).toBe("#/world"));
    });
    expect(nav().route.screen).toEqual({ name: "world" });
  });

  it("закрытие профиля без прошлой записи — замена: «назад» его не открывает снова", async () => {
    const nav = setup();
    act(() => nav().open({ name: "world" }));
    act(() => nav().open({ name: "region", regionId: "icewrack" }));
    act(() =>
      nav().navigate({
        screen: { name: "region", regionId: "icewrack" },
        hero: "tusk",
        profile: true,
      }),
    );
    act(() =>
      nav().navigate(
        { screen: { name: "region", regionId: "icewrack" }, hero: "tusk" },
        { replace: true },
      ),
    );
    expect(window.location.hash).toBe("#/r/icewrack?hero=tusk");
    await act(async () => {
      window.history.back();
      await waitFor(() => expect(window.location.hash).toBe("#/r/icewrack"));
    });
    expect(nav().route).toEqual({
      screen: { name: "region", regionId: "icewrack" },
    });
  });
});
