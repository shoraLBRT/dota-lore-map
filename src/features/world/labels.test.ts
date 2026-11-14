import { describe, expect, it } from 'vitest';
import { clampLabelX, EDGE_GAP, labelBox, placeEdgeLabels, placeMarkerLabels, splitLabel, type EdgeLabel, type MarkerLabel } from './labels';

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

describe('clampLabelX — подпись не выходит за край карты', () => {
  it('внутри карты — на месте', () => {
    expect(clampLabelX(800, 200)).toBe(800);
  });

  it('у края — сдвигается внутрь на половину ширины и отступ', () => {
    expect(clampLabelX(1580, 200)).toBe(1600 - 8 - 100);
    expect(clampLabelX(20, 200)).toBe(8 + 100);
  });

  it('шире карты — по центру', () => {
    expect(clampLabelX(100, 1700)).toBe(800);
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
  it('просторно — все сверху', () => {
    const sides = placeMarkerLabels([m('a', 0, 0), m('b', 200, 0), m('c', 0, 200)]);
    expect([...sides.values()]).toEqual(['top', 'top', 'top']);
  });

  it('у края кадра подпись не выходит за него: ищет другую сторону, нет — прячется', () => {
    const bounds = { left: -100, right: 100, top: -100, bottom: 100 };
    // У верхнего края — снизу; у левого края, где и сверху, и снизу вылезает — справа.
    expect(placeMarkerLabels([m('a', 0, -80)], bounds).get('a')).toBe('bottom');
    expect(placeMarkerLabels([m('b', -90, 0)], bounds).get('b')).toBe('right');
    // Маркер за краем — без подписи; без bounds — как раньше.
    expect(placeMarkerLabels([m('c', 300, 0)], bounds).get('c')).toBe('hidden');
    expect(placeMarkerLabels([m('c', 300, 0)]).get('c')).toBe('top');
  });

  it('соседу сверху тесно — следующая сторона: снизу, справа, слева', () => {
    // b прямо над a: подпись a сверху налезла бы на кольцо b.
    const sides = placeMarkerLabels([m('b', 0, -30), m('a', 0, 0)]);
    expect(sides.get('b')).toBe('top');
    expect(sides.get('a')).toBe('bottom');
  });

  it('места нет — подпись прячется, а обязательная встаёт сверху', () => {
    // Плотное кольцо соседей вокруг центра закрывает все четыре стороны.
    const around = [
      m('n', 0, -24),
      m('s', 0, 24),
      m('e', 30, 0),
      m('w', -30, 0),
    ];
    expect(placeMarkerLabels([...around, m('c', 0, 0)]).get('c')).toBe('hidden');
    expect(placeMarkerLabels([m('c', 0, 0, { must: true }), ...around]).get('c')).toBe('top');
  });

  it('рамки сторон не пересекают кольцо своего маркера', () => {
    for (const side of ['top', 'bottom', 'right', 'left'] as const) {
      const b = labelBox(side, { width: 60, size: 13, ring: 9 });
      const touchesRing = b.left < 9 && b.right > -9 && b.top < 9 && b.bottom > -9;
      expect(touchesRing, side).toBe(false);
    }
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