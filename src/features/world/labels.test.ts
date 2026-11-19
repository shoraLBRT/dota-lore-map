import { describe, expect, it } from 'vitest';
import { EDGE_GAP, LABEL_PAD_X, LABEL_PAD_Y, labelBox, placeEdgeLabels, placeMarkerLabels, splitLabel, type EdgeLabel, type MarkerLabel } from './labels';
import { world } from '../../data/world';
import { LANGS } from '../../i18n';
import { containScale, polygonBox, WORLD_ASPECT, zoomLevels, type View } from './camera';
import { labelMetrics, overlapsOnZoom, placeRegionLabels, regionLevels } from './labels';
import { levelsOf, regionLabelItems } from './regionLabelLayout';

describe('splitLabel — длинные названия регионов в две строки', () => {
  it('короткое и без пробела — одной строкой', () => {
    expect(splitLabel('Друуд')).toEqual(['Друуд']);
    expect(splitLabel('Стоунхолл')).toEqual(['Стоунхолл']);
    expect(splitLabel('Оченьдлинноеназваниебезпробелов')).toEqual(['Оченьдлинноеназваниебезпробелов']);
  });

  it('длинное — по пробелу, при котором длинная строка короче всего', () => {
    expect(splitLabel('Quoidge and the Fields of Carnage')).toEqual(['Quoidge and the', 'Fields of Carnage']);
    expect(splitLabel('Western Forests')).toEqual(['Western', 'Forests']);
    expect(splitLabel('Хазадальские пустоши')).toEqual(['Хазадальские', 'пустоши']);
  });
});

const m = (key: string, x: number, y: number, extra: Partial<MarkerLabel> = {}): MarkerLabel => ({
  key,
  x,
  y,
  width: 60,
  size: 13,
  ring: 9,
  ...extra,
});

describe('placeMarkerLabels — подписи маркеров не налезают друг на друга', () => {
  it('просторно — все справа от точки (#191)', () => {
    const sides = placeMarkerLabels([m('a', 0, 0), m('b', 200, 0), m('c', 0, 200)]);
    expect([...sides.values()]).toEqual(['right', 'right', 'right']);
  });

  it('у края кадра подпись не выходит за него: ищет другую сторону, нет — прячется', () => {
    const bounds = { left: -100, right: 100, top: -100, bottom: 100 };
    // У правого края — слева; у левого края — справа.
    expect(placeMarkerLabels([m('a', 60, 0)], bounds).get('a')).toBe('left');
    expect(placeMarkerLabels([m('b', -90, 0)], bounds).get('b')).toBe('right');
    // Длинной подписи тесно по бокам — сверху, а у верхнего края — снизу.
    expect(placeMarkerLabels([m('w', 0, 0, { width: 150 })], bounds).get('w')).toBe('top');
    expect(placeMarkerLabels([m('w', 0, -90, { width: 150 })], bounds).get('w')).toBe('bottom');
    // Маркер за краем — без подписи; без bounds — как раньше.
    expect(placeMarkerLabels([m('c', 300, 0)], bounds).get('c')).toBe('hidden');
    expect(placeMarkerLabels([m('c', 300, 0)]).get('c')).toBe('right');
  });

  it('маркер за видимой частью кадра — без подписи, даже если она сама влезла бы (#96)', () => {
    const bounds = { left: -100, right: 100, top: -100, bottom: 100 };
    // Центр чуть левее кадра: подпись справа целиком в кадре, но маркера рядом с ней не видно.
    expect(placeMarkerLabels([m('a', -105, 0)], bounds).get('a')).toBe('hidden');
    expect(placeMarkerLabels([m('a', -105, 0, { must: true })], bounds).get('a')).toBe('hidden');
    // Выбранное место подпись не теряет.
    expect(placeMarkerLabels([m('a', -105, 0, { must: true, selected: true })], bounds).get('a')).toBe('right');
  });

  it('обязательной подписи негде встать — первая сторона, где она не вылезает из кадра', () => {
    const bounds = { left: -100, right: 100, top: -100, bottom: 100 };
    // У правого края сверху, снизу и справа подпись вылезает, а слева мешает кольцо соседа.
    const sides = placeMarkerLabels([m('c', 95, 0, { must: true }), m('w', 65, 0)], bounds);
    expect(sides.get('c')).toBe('left');
  });

  it('справа тесно — следующая сторона: слева, сверху, снизу', () => {
    // b правее a: подпись a справа налезла бы на кольцо b.
    const sides = placeMarkerLabels([m('b', 30, 0), m('a', 0, 0)]);
    expect(sides.get('b')).toBe('right');
    expect(sides.get('a')).toBe('left');
    // Справа и слева соседи — сверху; и сверху — снизу.
    expect(placeMarkerLabels([m('b', 30, 0), m('c', -30, 0), m('a', 0, 0)]).get('a')).toBe('top');
    expect(placeMarkerLabels([m('b', 30, 0), m('c', -30, 0), m('n', 0, -24), m('a', 0, 0)]).get('a')).toBe('bottom');
  });

  it('места нет — подпись прячется, а обязательная встаёт на первую сторону — справа', () => {
    // Плотное кольцо соседей вокруг центра закрывает все четыре стороны.
    const around = [
      m('n', 0, -24),
      m('s', 0, 24),
      m('e', 30, 0),
      m('w', -30, 0),
    ];
    expect(placeMarkerLabels([...around, m('c', 0, 0)]).get('c')).toBe('hidden');
    expect(placeMarkerLabels([m('c', 0, 0, { must: true }), ...around]).get('c')).toBe('right');
  });

  it('обязательной подписи тесно везде — сторона, где она накрывает меньше колец (#98)', () => {
    // Сверху и снизу по два соседа, справа и слева — по одному: выигрывает правая (первая из равных).
    const crowd = [m('n1', -10, -24), m('n2', 10, -24), m('s1', -10, 24), m('s2', 10, 24), m('e', 40, 0), m('w', -40, 0)];
    expect(placeMarkerLabels([m('c', 0, 0, { must: true }), ...crowd]).get('c')).toBe('right');
  });

  it('рамки сторон не пересекают кольцо своего маркера', () => {
    for (const side of ['top', 'bottom', 'right', 'left'] as const) {
      const b = labelBox(side, { width: 60, size: 13, ring: 9 });
      const touchesRing = b.left < 9 && b.right > -9 && b.top < 9 && b.bottom > -9;
      expect(touchesRing, side).toBe(false);
    }
  });
});

describe('labelBox — рамка подписи маркера (#191)', () => {
  it('рамка — текст плюс поля под ореол, у кольца с прежним зазором', () => {
    const b = labelBox('top', { width: 60, size: 13, ring: 9 });
    expect(b.right - b.left).toBe(60 + 2 * LABEL_PAD_X);
    expect(b.bottom - b.top).toBe(13 + 2 * LABEL_PAD_Y);
    expect(b.bottom).toBe(-12);
    const r = labelBox('right', { width: 60, size: 13, ring: 9 });
    expect(r.left).toBe(12);
    expect(r.right).toBe(12 + 60 + 2 * LABEL_PAD_X);
  });
});

const e = (key: string, x: number, y: number, width = 160, height = 40): EdgeLabel => ({ key, x, y, width, height });
/** Кадр 1440×900 без левой полосы и панели (492 px) — как на ноутбуке. */
const FRAME = { left: 8, top: 8, right: 1440 - 64 - 492 - 8, bottom: 900 - 8 };

describe('placeEdgeLabels — метки «нить за краем» в видимой части кадра (#64)', () => {
  it('просторно — по центру своей точки', () => {
    expect(placeEdgeLabels([e('a', 400, 300)], FRAME).get('a')).toEqual({ left: 320, top: 280 });
  });

  it('у края — целиком внутри кадра: не уходит под левую полосу, под панель и под шторку', () => {
    const at = placeEdgeLabels([e('l', 28, 300), e('r', FRAME.right - 20, 500), e('b', 400, 880)], FRAME);
    expect(at.get('l')).toEqual({ left: 8, top: 280 });
    expect(at.get('r')).toEqual({ left: FRAME.right - 160, top: 480 });
    expect(at.get('b')).toEqual({ left: 320, top: FRAME.bottom - 40 });
  });

  it('метка шире кадра — от его левого края', () => {
    const narrow = { left: 8, top: 8, right: 108, bottom: 500 };
    expect(placeEdgeLabels([e('w', 50, 200)], narrow).get('w')).toEqual({ left: 8, top: 180 });
  });

  it('метки не налезают друг на друга: следующая отходит вниз или вверх', () => {
    const items = [e('a', 28, 300), e('b', 28, 310), e('c', 28, 305)];
    const at = placeEdgeLabels(items, FRAME);
    const boxes = items.map((m) => ({ ...at.get(m.key)!, w: m.width, h: m.height }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [p, q] = [boxes[i]!, boxes[j]!];
        const apart =
          p.left + p.w + EDGE_GAP <= q.left || q.left + q.w + EDGE_GAP <= p.left || p.top + p.h + EDGE_GAP <= q.top || q.top + q.h + EDGE_GAP <= p.top;
        expect(apart, `${i}/${j}`).toBe(true);
      }
      expect(boxes[i]!.left).toBeGreaterThanOrEqual(FRAME.left);
    }
    expect(at.get('a')).toEqual({ left: 8, top: 280 });
    // b у своей точки налезла бы на a — на шаг в высоту метки ниже.
    expect(at.get('b')!.top).toBe(290 + 40 + EDGE_GAP);
  });

  it('в углу, где вниз нельзя, — отходит вверх', () => {
    const at = placeEdgeLabels([e('a', 28, 880), e('b', 28, 880)], FRAME);
    expect(at.get('a')!.top).toBe(FRAME.bottom - 40);
    expect(at.get('b')!.top).toBe(FRAME.bottom - 40 - 40 - EDGE_GAP);
  });
});
describe('названия регионов по уровням (#189, SPEC §8.6)', () => {
  const drawn = world.regions.filter((r) => r.layout);
  const levels = levelsOf(drawn);
  const boxes = drawn.map((r) => polygonBox(r.layout!.polygon));

  it('первый уровень — 8–10 главных регионов; ярусы и земли без мест — третий', () => {
    const first = drawn.filter((r) => levels.get(r.id) === 1);
    expect(first.length).toBeGreaterThanOrEqual(8);
    expect(first.length).toBeLessThanOrEqual(10);
    for (const r of drawn) if (r.tier !== 'continent' || r.places.length === 0) expect(levels.get(r.id)).toBe(3);
    expect(levels.get('uncharted')).toBe(3);
  });

  it('уровни по весу; при равенстве — по порядку данных', () => {
    const rs = ['a', 'b', 'c'].map((id) => ({ id, tier: 'continent', places: [1] }));
    const l = regionLevels([...rs, { id: 't', tier: 'upper', places: [1] }], (r) => (r.id === 'c' ? 5 : 1));
    expect([...l.entries()]).toEqual([['a', 1], ['b', 1], ['c', 1], ['t', 3]]);
  });

  it('размеры: в полном кадре первый уровень ≥ 18 px с гербом 40–48 px; на телефоне ≥ 12 px', () => {
    const full = labelMetrics(1, 900);
    expect(full.font).toBeGreaterThanOrEqual(18);
    expect(full.crest).toBeGreaterThanOrEqual(40);
    expect(full.crest).toBeLessThanOrEqual(48);
    expect(labelMetrics(1, 375).font).toBeGreaterThanOrEqual(12);
    expect(labelMetrics(2, 900).crest).toBe(0);
  });

  it('overlapsOnZoom — точки расходятся с приближением, рамки нет', () => {
    const box = { left: -10, right: 10, top: -5, bottom: 5 };
    const w = { width: 1000, height: 1000 };
    // 15 px при zoom 1, 30 px при zoom 2: рамки по 20 px касаются до zoom 2.
    expect(overlapsOnZoom(box, [0.5, 0.5], box, [0.515, 0.5], w, 1, 1.2)).toBe(true);
    expect(overlapsOnZoom(box, [0.5, 0.5], box, [0.515, 0.5], w, 1.4, 3)).toBe(false);
    expect(overlapsOnZoom(box, [0.5, 0.5], box, [0.5, 0.52], w, 1, 3)).toBe(false);
  });

  it('placeRegionLabels — под гербом; тесно — справа или слева; второму уровню тесно — появляется позже, на потолке — не появляется', () => {
    const w = { width: 1000, height: 1000 };
    const m1 = labelMetrics(1, 900);
    const m2 = labelMetrics(2, 900);
    const item = (id: string, x: number, y: number, from: number, metrics = m1) => ({ id, x, y, width: 80, lines: 1, metrics, from });
    // Второй герб прямо под первым: первому — сбоку, второму — под гербом.
    const spots = placeRegionLabels([item('a', 0.5, 0.5, 1), item('b', 0.5, 0.56, 1)], w, 2);
    expect(spots.get('a')!.side).toBe('right');
    expect(spots.get('b')!.side).toBe('bottom');
    // Название второго уровня на гербе первого: видно только с того зума, где они разошлись.
    const late = placeRegionLabels([item('a', 0.5, 0.5, 1), item('c', 0.5, 0.52, 1.35, m2)], w, 3).get('c')!;
    expect(late.from).toBeGreaterThan(1.35);
    expect(late.from).toBeLessThanOrEqual(3);
    // Не расходятся и на потолке — не показывается.
    expect(placeRegionLabels([item('a', 0.5, 0.5, 1), item('c', 0.5, 0.501, 1.35, m2)], w, 1.5).get('c')!.from).toBe(Infinity);
  });

  // Кадры как у useCamera: слой покрывает кадр; телефон — мир со списком, камера стоит.
  const sizes = [
    { name: '1440×900', width: 1440 - 64, height: 900, phone: false },
    { name: '1280×720', width: 1280 - 64, height: 720, phone: false },
    { name: '768×1024', width: 768 - 64, height: 1024, phone: false },
    { name: '375×812', width: 375, height: 812 - 44, phone: true },
  ];
  for (const s of sizes) {
    for (const lang of LANGS) {
      it(`${s.name}, ${lang}: названия и гербы не пересекаются ни на одном зуме мира`, () => {
        const layerWidth = Math.max(s.width, s.height * WORLD_ASPECT);
        const view: View = { width: s.width, height: s.height, layerWidth, layerHeight: layerWidth / WORLD_ASPECT, inset: 0 };
        const fitted = layerWidth * containScale(view);
        const zoomFrom = s.phone ? Math.min(s.width, s.height) / layerWidth : 1;
        const zoomMax = s.phone ? zoomFrom : zoomLevels(boxes, view).zoomMax;
        const items = regionLabelItems(drawn, { name: (r) => r.name[lang], levels, widths: {}, fitted, zoomFrom });
        const worldPx = { width: layerWidth, height: layerWidth / WORLD_ASPECT };
        const spots = placeRegionLabels(items, worldPx, zoomMax);
        const rects = items.flatMap((m) => {
          const spot = spots.get(m.id)!;
          return [spot.box, ...(spot.crest ? [spot.crest] : [])].map((b) => ({ m, b, from: spot.from }));
        });
        const bad: string[] = [];
        for (let z = zoomFrom; z <= zoomMax + 1e-9; z += 0.01) {
          const shown = rects
            .filter((r) => r.from <= z + 1e-9)
            .map(({ m, b }) => {
              const x = m.x * worldPx.width * z;
              const y = m.y * worldPx.height * z;
              return { id: m.id, left: x + b.left, right: x + b.right, top: y + b.top, bottom: y + b.bottom };
            });
          for (let i = 0; i < shown.length; i++)
            for (let j = i + 1; j < shown.length; j++) {
              const a = shown[i]!;
              const b = shown[j]!;
              if (a.id !== b.id && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) bad.push(`${a.id}×${b.id}@${z.toFixed(2)}`);
            }
        }
        expect([...new Set(bad.map((x) => x.split('@')[0]))]).toEqual([]);
        // Первого уровня — не больше 12, и он виден с самого дальнего зума: на компьютере — весь, на телефоне — не меньше 8.
        const first = items.filter((m) => levels.get(m.id) === 1);
        const always = items.filter((m) => spots.get(m.id)!.from <= zoomFrom + 1e-9);
        expect(always.length).toBeLessThanOrEqual(12);
        expect(always.every((m) => levels.get(m.id) === 1)).toBe(true);
        if (s.phone) expect(always.length).toBeGreaterThanOrEqual(6);
        else expect(always.length).toBe(first.length);
        // Остальные на компьютере появляются при приближении, не позже потолка мира.
        if (!s.phone) expect(items.filter((m) => spots.get(m.id)!.from === Infinity).map((m) => m.id)).toEqual([]);
      });
    }
  }
});
