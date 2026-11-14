// Подписи на карте (SPEC §5.3, §6.3; аудит E13 — docs/research/E13-ux-audit.md).
// Названия регионов: длинные — в две строки и не выходят за край карты.
// Подписи маркеров: не налезают друг на друга — каждая встаёт сверху, снизу, справа или слева от маркера,
// а если места нет — прячется до наведения, фокуса или выбора места.

import { STAGE_WIDTH } from './camera';

/** Длиннее — название региона переносится на две строки. */
export const WRAP_AFTER = 14;

/**
 * Делит название на одну или две строки: по пробелу, при котором длинная строка короче всего.
 * Короткие названия и названия без пробела — одной строкой.
 */
export function splitLabel(text: string, max = WRAP_AFTER): string[] {
  if (text.length <= max) return [text];
  let best: [string, string] | null = null;
  for (let i = text.indexOf(' '); i > 0; i = text.indexOf(' ', i + 1)) {
    const pair: [string, string] = [text.slice(0, i), text.slice(i + 1)];
    if (!best || Math.max(pair[0].length, pair[1].length) < Math.max(best[0].length, best[1].length)) best = pair;
  }
  return best ?? [text];
}

/** Отступ подписи региона от края карты, единицы SVG. */
export const STAGE_MARGIN = 8;

/** Центр подписи шириной `width` (единицы SVG), сдвинутый так, чтобы она целиком была на карте. */
export function clampLabelX(x: number, width: number, margin = STAGE_MARGIN, stage = STAGE_WIDTH): number {
  const half = width / 2;
  if (width + 2 * margin >= stage) return stage / 2;
  return Math.min(Math.max(x, margin + half), stage - margin - half);
}

/** Куда встала подпись маркера; `hidden` — места нет, подпись видна только при наведении, фокусе и выборе. */
export type LabelSide = 'top' | 'bottom' | 'right' | 'left' | 'hidden';

export interface MarkerLabel {
  key: string;
  /** Центр маркера в экранных px (точнее — в единицах группы маркера: 1 единица = 1 px). */
  x: number;
  y: number;
  /** Ширина текста и кегль, px. */
  width: number;
  size: number;
  /** Радиус кольца маркера, px. */
  ring: number;
  /** Подпись видна всегда (столица, выбранное место): нет свободной стороны — встаёт сверху. */
  must?: boolean;
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Зазор между подписью и кольцом, px. */
export const LABEL_GAP = 3;
/** Минимальный просвет между подписями, px. */
const PAD = 2;

/** Рамка подписи для стороны `side` в координатах группы маркера (0, 0 — центр маркера). */
export function labelBox(side: Exclude<LabelSide, 'hidden'>, m: Pick<MarkerLabel, 'width' | 'size' | 'ring'>): Box {
  const h = m.size;
  const d = m.ring + LABEL_GAP;
  switch (side) {
    case 'top':
      return { left: -m.width / 2, right: m.width / 2, top: -d - h, bottom: -d };
    case 'bottom':
      return { left: -m.width / 2, right: m.width / 2, top: d, bottom: d + h };
    case 'right':
      return { left: d, right: d + m.width, top: -h / 2, bottom: h / 2 };
    case 'left':
      return { left: -d - m.width, right: -d, top: -h / 2, bottom: h / 2 };
  }
}

const SIDES = ['top', 'bottom', 'right', 'left'] as const;

const overlap = (a: Box, b: Box) =>
  a.left < b.right + PAD && b.left < a.right + PAD && a.top < b.bottom + PAD && b.top < a.bottom + PAD;

const shift = (b: Box, x: number, y: number): Box => ({
  left: b.left + x,
  right: b.right + x,
  top: b.top + y,
  bottom: b.bottom + y,
});

/**
 * Жадная расстановка подписей маркеров: по порядку `items` (важные — первыми) каждая подпись
 * встаёт на первую свободную сторону — сверху, снизу, справа, слева. Мешают ей уже поставленные подписи
 * и кольца всех маркеров. Нет места — `hidden`, а обязательная подпись (`must`) — сверху.
 * `bounds` — видимая часть кадра в тех же единицах: подпись, вылезающая за неё, ищет другую сторону.
 */
export function placeMarkerLabels(items: MarkerLabel[], bounds?: Box): Map<string, LabelSide> {
  const rings: Box[] = items.map((m) => ({ left: m.x - m.ring, right: m.x + m.ring, top: m.y - m.ring, bottom: m.y + m.ring }));
  const placed: Box[] = [];
  const result = new Map<string, LabelSide>();
  for (const m of items) {
    let side: LabelSide = 'hidden';
    for (const s of SIDES) {
      const box = shift(labelBox(s, m), m.x, m.y);
      if (bounds && (box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom)) continue;
      if (placed.some((p) => overlap(p, box))) continue;
      if (rings.some((r, j) => items[j] !== m && overlap(r, box))) continue;
      side = s;
      placed.push(box);
      break;
    }
    if (side === 'hidden' && m.must) {
      side = 'top';
      placed.push(shift(labelBox('top', m), m.x, m.y));
    }
    result.set(m.key, side);
  }
  return result;
}

/** Метка «нить за краем» (SPEC §6.6): точка, где нить уходит из кадра, и размер метки, px. */
export interface EdgeLabel {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Просвет между метками «нить за краем», px. */
export const EDGE_GAP = 4;
/** Сколько шагов в сторону метка ищет свободное место, прежде чем встать поверх соседки. */
const EDGE_TRIES = 6;

/** Отрезок длиной `size` с центром как можно ближе к `c`, целиком внутри [min, max]; не влезает — от `min`. */
const clampSpan = (c: number, size: number, min: number, max: number) =>
  size >= max - min ? min : Math.min(Math.max(c - size / 2, min), max - size);

/**
 * Расстановка меток «нить за краем» (#64): каждая — по центру своей точки, но целиком внутри `frame`
 * (видимая часть кадра: правее левой полосы, левее панели, выше шторки). Мешают ей уже поставленные метки
 * (по порядку `items`): тогда она отходит на шаг в высоту метки вверх или вниз, затем на шаг в ширину
 * вправо или влево — до `EDGE_TRIES` шагов. Места нет нигде — встаёт как без соседок.
 * Возвращает левый верхний угол каждой метки в px кадра.
 */
export function placeEdgeLabels(items: EdgeLabel[], frame: Box): Map<string, { left: number; top: number }> {
  const placed: Box[] = [];
  const result = new Map<string, { left: number; top: number }>();
  for (const m of items) {
    // Шаги отсчитываются от уже прижатой к кадру метки: иначе у края шаг «съедается» прижатием.
    const cx = clampSpan(m.x, m.width, frame.left, frame.right) + m.width / 2;
    const cy = clampSpan(m.y, m.height, frame.top, frame.bottom) + m.height / 2;
    const at = (dx: number, dy: number): Box => {
      const left = clampSpan(cx + dx, m.width, frame.left, frame.right);
      const top = clampSpan(cy + dy, m.height, frame.top, frame.bottom);
      return { left, top, right: left + m.width, bottom: top + m.height };
    };
    const free = (b: Box) =>
      !placed.some((p) => b.left < p.right + EDGE_GAP && p.left < b.right + EDGE_GAP && b.top < p.bottom + EDGE_GAP && p.top < b.bottom + EDGE_GAP);
    const stepY = m.height + EDGE_GAP;
    const stepX = m.width + EDGE_GAP;
    const candidates = [at(0, 0)];
    for (let k = 1; k <= EDGE_TRIES; k++) {
      candidates.push(at(0, k * stepY), at(0, -k * stepY), at(k * stepX, 0), at(-k * stepX, 0));
    }
    const box = candidates.find(free) ?? candidates[0]!;
    placed.push(box);
    result.set(m.key, { left: box.left, top: box.top });
  }
  return result;
}
