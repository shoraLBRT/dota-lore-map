import { describe, expect, it, vi } from 'vitest';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';
import { anchorPoint, cameraInverse, placeAnchors } from './screenAnchors';

const NS = 'http://www.w3.org/2000/svg';

function svgWith(...attrs: Record<string, string>[]) {
  const svg = document.createElementNS(NS, 'svg');
  for (const a of attrs) {
    const g = document.createElementNS(NS, 'g');
    for (const [k, v] of Object.entries(a)) g.setAttribute(k, v);
    svg.appendChild(g);
  }
  return svg;
}

describe('screenAnchors (#231)', () => {
  it('точка сцены под камерой — там же, куда её ставит transform слоя карты (`cameraTransform`)', () => {
    // translate(0%, -50%) scale(2): центр сцены по y уходит на половину высоты вверх, x — в два раза дальше от нуля.
    const frame = { camera: { x: 0.25, y: 0.5, zoom: 2 }, layerWidth: 800 };
    expect(anchorPoint(frame, STAGE_WIDTH / 4, STAGE_HEIGHT / 2)).toEqual([STAGE_WIDTH / 2, STAGE_HEIGHT / 2]);
    // Сдвиг под панель — px слоя, в единицах сцены при zoom 1: 240 px слоя шириной 800 — 480 единиц.
    const [x] = anchorPoint({ ...frame, offset: 240 }, STAGE_WIDTH / 4, 0);
    expect(x).toBeCloseTo(STAGE_WIDTH / 2 - 480);
  });

  it('группа в экранных px: масштаб не зависит от приближения, меняется только сдвиг', () => {
    const svg = svgWith({ 'data-at': '800 400' }, { 'data-at': '800 400', 'data-k': '1.5' }, { 'data-at': '800 400', 'data-at-zoom': '' });
    const [px, grown, stage] = [...svg.children];
    placeAnchors(svg, { camera: { x: 0.5, y: 0.5, zoom: 1 }, layerWidth: 800 });
    expect(px!.getAttribute('transform')).toBe('translate(800 400) scale(2)');
    placeAnchors(svg, { camera: { x: 0.5, y: 0.5, zoom: 3 }, layerWidth: 800 });
    expect(px!.getAttribute('transform')).toMatch(/ scale\(2\)$/);
    expect(grown!.getAttribute('transform')).toMatch(/ scale\(3\)$/);
    expect(stage!.getAttribute('transform')).toMatch(/ scale\(3\)$/);
  });

  it('тот же кадр DOM не трогает', () => {
    const svg = svgWith({ 'data-at': '10 20' });
    const frame = { camera: { x: 0.5, y: 0.5, zoom: 1.5 }, layerWidth: 1600 };
    placeAnchors(svg, frame);
    const set = vi.spyOn(svg.firstElementChild!, 'setAttribute');
    placeAnchors(svg, frame);
    expect(set).not.toHaveBeenCalled();
  });

  it('обратный кадр: сдвиг и масштаб камеры с обратным знаком, в обратном порядке', () => {
    expect(cameraInverse({ camera: { x: 0.25, y: 0.5, zoom: 2 }, layerWidth: 800 })).toBe('scale(0.5) translate(0%, 50%)');
    expect(cameraInverse({ camera: { x: 0.5, y: 0.5, zoom: 1 }, offset: 240, offsetY: -40, layerWidth: 800 })).toBe(
      'scale(1) translate(calc(0% + 240px), calc(0% - 40px))',
    );
  });
});
