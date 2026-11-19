// Подписи на карте (SPEC §5.3, §6.3; аудит E13 — docs/research/E13-ux-audit.md).
// Названия регионов: длинные — в две строки и не выходят за край карты.
// Подписи маркеров: не налезают друг на друга — каждая встаёт сверху, снизу, справа или слева от маркера,
// а если места нет — прячется до наведения, фокуса или выбора места.


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
  /** Выбранное место: подпись остаётся, даже если центр маркера за видимой частью кадра. */
  selected?: boolean;
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

/**
 * Поля рамки подписи маркера по бокам и сверху-снизу от текста, px: место под обводку-ореол (#191, SPEC §8.6;
 * MarkersLayer.module.css: .markerLabel, stroke-width 3.5 — по 1.75 px наружу).
 */
export const LABEL_PAD_X = 2;
export const LABEL_PAD_Y = 1;

/**
 * Рамка подписи для стороны `side` в координатах группы маркера (0, 0 — центр маркера): ширина текста
 * и кегль плюс поля под ореол `LABEL_PAD_X`, `LABEL_PAD_Y`.
 */
export function labelBox(side: Exclude<LabelSide, 'hidden'>, m: Pick<MarkerLabel, 'width' | 'size' | 'ring'>): Box {
  const h = m.size + 2 * LABEL_PAD_Y;
  const w = m.width + 2 * LABEL_PAD_X;
  const d = m.ring + LABEL_GAP;
  switch (side) {
    case 'top':
      return { left: -w / 2, right: w / 2, top: -d - h, bottom: -d };
    case 'bottom':
      return { left: -w / 2, right: w / 2, top: d, bottom: d + h };
    case 'right':
      return { left: d, right: d + w, top: -h / 2, bottom: h / 2 };
    case 'left':
      return { left: -d - w, right: -d, top: -h / 2, bottom: h / 2 };
  }
}

/** Порядок сторон подписи (#191): сбоку от точки, при нехватке места — сверху и снизу. */
const SIDES = ['right', 'left', 'top', 'bottom'] as const;

const overlap = (a: Box, b: Box) =>
  a.left < b.right + PAD && b.left < a.right + PAD && a.top < b.bottom + PAD && b.top < a.bottom + PAD;

const inside = (b: Box, f: Box) => b.left >= f.left && b.right <= f.right && b.top >= f.top && b.bottom <= f.bottom;

const shift = (b: Box, x: number, y: number): Box => ({
  left: b.left + x,
  right: b.right + x,
  top: b.top + y,
  bottom: b.bottom + y,
});

/**
 * Жадная расстановка подписей маркеров: по порядку `items` (важные — первыми) каждая подпись
 * встаёт на первую свободную сторону — справа, слева, сверху, снизу. Мешают ей уже поставленные подписи
 * и фигуры всех маркеров. Нет места — `hidden`, а обязательная подпись (`must`) — на первую сторону в кадре или справа.
 * `bounds` — видимая часть кадра в тех же единицах: подпись, вылезающая за неё, ищет другую сторону;
 * маркер, центр которого за её пределами, подписи не получает (кроме выбранного места, #96).
 */
export function placeMarkerLabels(items: MarkerLabel[], bounds?: Box): Map<string, LabelSide> {
  const rings: Box[] = items.map((m) => ({ left: m.x - m.ring, right: m.x + m.ring, top: m.y - m.ring, bottom: m.y + m.ring }));
  const placed: Box[] = [];
  const result = new Map<string, LabelSide>();
  for (const m of items) {
    if (bounds && !m.selected && (m.x < bounds.left || m.x > bounds.right || m.y < bounds.top || m.y > bounds.bottom)) {
      result.set(m.key, 'hidden');
      continue;
    }
    let side: LabelSide = 'hidden';
    for (const s of SIDES) {
      const box = shift(labelBox(s, m), m.x, m.y);
      if (bounds && !inside(box, bounds)) continue;
      if (placed.some((p) => overlap(p, box))) continue;
      if (rings.some((r, j) => items[j] !== m && overlap(r, box))) continue;
      side = s;
      placed.push(box);
      break;
    }
    if (side === 'hidden' && m.must) {
      // Обязательная подпись: среди сторон, где она не вылезает из кадра, — та, что накрывает меньше
      // подписей и колец (при равенстве — первая по порядку); таких нет — справа.
      const conflicts = (s: (typeof SIDES)[number]) => {
        const box = shift(labelBox(s, m), m.x, m.y);
        return placed.filter((p) => overlap(p, box)).length + rings.filter((r, j) => items[j] !== m && overlap(r, box)).length;
      };
      const fits = SIDES.filter((s) => !bounds || inside(shift(labelBox(s, m), m.x, m.y), bounds));
      side = fits.reduce<(typeof SIDES)[number] | undefined>((best, s) => (best && conflicts(best) <= conflicts(s) ? best : s), undefined) ?? SIDES[0];
      placed.push(shift(labelBox(side, m), m.x, m.y));
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

// ——— Названия регионов по уровням (#189, SPEC §8.6) ———

/** Уровень названия региона: 1 — главные, с гербом, видны всегда; 2 — появляются при приближении; 3 — ярусы и земли без мест, приглушённые. */
export type LabelLevel = 1 | 2 | 3;

/** Сколько регионов в первом уровне. */
export const LEVEL1_COUNT = 10;
/** С этого приближения мира видны названия второго и третьего уровня. */
export const LEVEL2_ZOOM = 1.35;
/** Мир, вписанный в кадр, не уже этого (px) — названия в полный размер; уже — мельче, но не мельче минимума. */
export const LABEL_FULL_SIZE = 768;

interface LevelRegion {
  id: string;
  tier: string;
  places: unknown[];
}

/**
 * Уровни названий (#189): ярусы и регионы без мест — третий; из остальных `LEVEL1_COUNT` с наибольшим
 * весом (`weight` — герои и места региона) — первый, при равенстве — по порядку данных; прочие — второй.
 */
export function regionLevels<R extends LevelRegion>(regions: R[], weight: (r: R) => number): Map<string, LabelLevel> {
  const main = regions.filter((r) => r.tier === 'continent' && r.places.length > 0);
  const ranked = main.map((r, i) => ({ r, i, w: weight(r) })).sort((a, b) => b.w - a.w || a.i - b.i);
  const first = new Set(ranked.slice(0, LEVEL1_COUNT).map((x) => x.r.id));
  const levels = new Map<string, LabelLevel>();
  for (const r of regions) levels.set(r.id, first.has(r.id) ? 1 : main.includes(r) ? 2 : 3);
  return levels;
}

/** Размеры названия на экране, px: кегль, герб (0 — без герба), высота строки. */
export interface LabelMetrics {
  font: number;
  crest: number;
  line: number;
}

/** Полные размеры по уровням (кегль, герб) и наименьший кегль на узком кадре, px. */
const LEVEL_SIZE: Record<LabelLevel, { font: number; crest: number; min: number }> = {
  1: { font: 20, crest: 44, min: 12 },
  2: { font: 15, crest: 0, min: 11 },
  3: { font: 14, crest: 0, min: 10 },
};
/** Наименьший герб на узком кадре, px. */
const CREST_MIN = 20;

/** Размеры названия уровня `level`, когда мир, вписанный в кадр, шириной `fitted` px. */
export function labelMetrics(level: LabelLevel, fitted: number): LabelMetrics {
  const k = fitted > 0 ? Math.min(1, fitted / LABEL_FULL_SIZE) : 1;
  const s = LEVEL_SIZE[level];
  const font = Math.max(s.min, Math.round(s.font * k));
  return { font, crest: s.crest ? Math.max(CREST_MIN, Math.round(s.crest * k)) : 0, line: Math.round(font * 10.5) / 10 };
}

/** Зазор между гербом и названием, px. */
export const CREST_GAP = 3;
/** Поля рамки названия под ореол (обводка и `--map-halo-filter`), px. */
const NAME_PAD = 3;
/** Отступ названия от края мира, px. */
const WORLD_MARGIN = 6;
/** Просвет между названиями и гербами, px. */
const NAME_SPACE = 2;

/** Сторона названия: у герба — под ним, справа или слева; без герба — по центру точки, выше или ниже неё. */
export type NameSide = 'bottom' | 'right' | 'left' | 'center' | 'above' | 'below';

export interface RegionLabelItem {
  id: string;
  /** Точка названия (`layout.label`), доли мира. */
  x: number;
  y: number;
  /** Ширина самой длинной строки, px, и число строк. */
  width: number;
  lines: number;
  metrics: LabelMetrics;
  /** С какого приближения название видно. */
  from: number;
}

export interface RegionLabelSpot {
  side: NameSide;
  /** Рамка названия относительно точки, px экрана (без герба). */
  box: Box;
  /** Рамка герба относительно точки, px; без герба — null. */
  crest: Box | null;
  /** С какого приближения название видно на самом деле; Infinity — на этом кадре не показывается. */
  from: number;
}

/** Рамка названия стороны `side` относительно точки, px. */
export function nameBox(side: NameSide, m: Pick<RegionLabelItem, 'width' | 'lines' | 'metrics'>): Box {
  const w = m.width + 2 * NAME_PAD;
  const h = m.lines * m.metrics.line + 2 * NAME_PAD;
  const r = m.metrics.crest / 2 + CREST_GAP;
  switch (side) {
    case 'bottom':
      return { left: -w / 2, right: w / 2, top: r, bottom: r + h };
    case 'right':
      return { left: r, right: r + w, top: -h / 2, bottom: h / 2 };
    case 'left':
      return { left: -r - w, right: -r, top: -h / 2, bottom: h / 2 };
    case 'center':
      return { left: -w / 2, right: w / 2, top: -h / 2, bottom: h / 2 };
    case 'above':
      return { left: -w / 2, right: w / 2, top: -h - NAME_SPACE, bottom: -NAME_SPACE };
    case 'below':
      return { left: -w / 2, right: w / 2, top: NAME_SPACE, bottom: h + NAME_SPACE };
  }
}

/** Рамка герба диаметром `c` относительно точки; без герба — null. */
export const crestBox = (c: number): Box | null => (c > 0 ? { left: -c / 2, right: c / 2, top: -c / 2, bottom: c / 2 } : null);

/**
 * Пересекаются ли рамки `a` и `b` (относительно точек `pa`, `pb`, доли мира) хотя бы при одном приближении из
 * [z0, z1]; `world` — размер мира в px при zoom 1. Рамки — в px экрана и не растут с приближением, а точки
 * расходятся: каждое из четырёх условий пересечения линейно по zoom, поэтому ответ точный, без перебора.
 */
export function overlapsOnZoom(
  a: Box,
  pa: readonly [number, number],
  b: Box,
  pb: readonly [number, number],
  world: { width: number; height: number },
  z0: number,
  z1: number,
  pad = 0,
): boolean {
  let lo = z0;
  let hi = z1;
  let open = true;
  // Условие p·z < q сужает [lo, hi].
  const less = (p: number, q: number) => {
    if (Math.abs(p) < 1e-9) {
      if (q <= 0) open = false;
    } else if (p > 0) hi = Math.min(hi, q / p - 1e-9);
    else lo = Math.max(lo, q / p + 1e-9);
  };
  const ax = pa[0] * world.width;
  const bx = pb[0] * world.width;
  const ay = pa[1] * world.height;
  const by = pb[1] * world.height;
  less(ax - bx, b.right + pad - a.left);
  less(bx - ax, a.right + pad - b.left);
  less(ay - by, b.bottom + pad - a.top);
  less(by - ay, a.bottom + pad - b.top);
  return open && lo <= hi;
}

/** Порядок сторон: у герба — под ним, затем справа и слева; без герба — по центру, выше, ниже, справа, слева. */
const CREST_SIDES: NameSide[] = ['bottom', 'right', 'left'];
const PLAIN_SIDES: NameSide[] = ['center', 'above', 'below', 'right', 'left'];
/** Шаг, на который отодвигается порог появления названия, которому негде встать, — приближение мира. */
export const LEVEL_STEP = 0.1;

/**
 * Расстановка названий регионов (#189, SPEC §8.6). По порядку `items` (первый уровень — первым) название встаёт на
 * первую сторону, где во всём своём диапазоне приближений [from, zoomMax] не задевает уже поставленные названия,
 * гербы видимых регионов и край мира. Негде — порог появления `from` растёт шагами `LEVEL_STEP`; не нашлось места
 * и на потолке мира — название с гербом не показывается на этом кадре (`hidden`; регион — в списке и с клавиатуры).
 * `world` — размер мира в px при zoom 1. Считается раз на кадр, язык и измерения, не на кадр анимации.
 */
export function placeRegionLabels(
  items: RegionLabelItem[],
  world: { width: number; height: number },
  zoomMax: number,
): Map<string, RegionLabelSpot> {
  const spots = new Map<string, RegionLabelSpot>();
  /** Порог появления каждого названия (растёт, если негде встать); Infinity — не показывается. */
  const from = new Map(items.map((m) => [m.id, m.from]));
  const until = (m: RegionLabelItem) => Math.max(from.get(m.id)!, zoomMax);
  const at = (m: RegionLabelItem) => [m.x, m.y] as const;
  const crests = items.flatMap((m) => {
    const box = crestBox(m.metrics.crest);
    return box ? [{ m, box }] : [];
  });
  const placed: { m: RegionLabelItem; box: Box }[] = [];
  for (const m of items) {
    const others = [...placed, ...crests.filter((c) => c.m !== m && from.get(c.m.id)! < Infinity)];
    const crest = crestBox(m.metrics.crest);
    const free = (box: Box, z: number) => {
      const own = crest ? [box, crest] : [box];
      return others.every((o) => {
        const z0 = Math.max(z, from.get(o.m.id)!);
        const z1 = Math.min(Math.max(z, zoomMax), until(o.m));
        return z0 > z1 || own.every((b) => !overlapsOnZoom(b, at(m), o.box, at(o.m), world, z0, z1, NAME_SPACE));
      });
    };
    // Край мира — на самом дальнем зуме диапазона: ближе мир растёт быстрее, чем отходит название.
    const inWorld = (b: Box, z: number) => {
      const x = m.x * world.width * z;
      const y = m.y * world.height * z;
      return (
        x + b.left >= WORLD_MARGIN &&
        x + b.right <= world.width * z - WORLD_MARGIN &&
        y + b.top >= WORLD_MARGIN &&
        y + b.bottom <= world.height * z - WORLD_MARGIN
      );
    };
    const sides = (crest ? CREST_SIDES : PLAIN_SIDES).map((side) => ({ side, box: nameBox(side, m) }));
    let pick: (typeof sides)[number] | undefined;
    let z = m.from;
    for (; z <= Math.max(m.from, zoomMax) + 1e-9; z += LEVEL_STEP) {
      pick = sides.find((s) => inWorld(s.box, z) && free(s.box, z));
      if (pick) break;
    }
    if (!pick) {
      from.set(m.id, Infinity);
      spots.set(m.id, { side: sides[0]!.side, box: sides[0]!.box, crest, from: Infinity });
      continue;
    }
    from.set(m.id, z);
    placed.push({ m, box: pick.box });
    spots.set(m.id, { side: pick.side, box: pick.box, crest, from: z });
  }
  return spots;
}

