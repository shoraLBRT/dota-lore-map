/** Сдвиг указателя, после которого нажатие — перетаскивание, а не тап (как порог свободной камеры, A4). */
const TAP_SLOP = 5;

/**
 * Тап или клик вне окна (#182): нажали и отпустили почти на месте. Перетаскивание карты, щипок и прокрутка
 * пальцем окно не закрывают — закрывало бы уже нажатие. `inside` — цель нажатия, которую окно пропускает
 * (само окно, кнопка-источник). Возвращает «отписаться».
 */
export function listenOutsideTap(inside: (target: Element) => boolean, onTap: () => void): () => void {
  let down: { id: number; x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    // Второй палец — щипок, а не тап.
    if (down && down.id !== e.pointerId) {
      down = null;
      return;
    }
    const target = e.target;
    down = target instanceof Element && !inside(target) ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
  };
  const onUp = (e: PointerEvent) => {
    const d = down;
    down = null;
    if (d && d.id === e.pointerId && Math.hypot(e.clientX - d.x, e.clientY - d.y) < TAP_SLOP) onTap();
  };
  const onCancel = () => {
    down = null;
  };
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('pointercancel', onCancel, true);
  return () => {
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('pointerup', onUp, true);
    document.removeEventListener('pointercancel', onCancel, true);
  };
}
