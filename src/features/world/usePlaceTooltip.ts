import { useCallback, useId, useMemo, useState, type RefObject } from 'react';
import type { Hero, Region } from '../../data/types';

/**
 * Места открытого региона и подсказка героев места (S2/S3, SPEC §6.3): маркер под наведением мыши
 * (не пальца) или под фокусом показывает героев места.
 */
export function usePlaceTooltip(
  active: Region | undefined,
  svgRef: RefObject<SVGSVGElement | null>,
  heroesOfSpot: (regionId: string, placeSlug: string) => Hero[],
) {
  const id = useId();
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const spots = useMemo(() => active?.places.filter((p) => p.pos) ?? [], [active]);
  const spotId = active ? (hover ?? focus) : null;
  const spot = spots.find((p) => p.slug === spotId);
  const heroes = useMemo(() => (active && spot ? heroesOfSpot(active.id, spot.slug) : []), [active, spot, heroesOfSpot]);
  const getAnchor = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !spot?.pos) return null;
    const rect = svg.getBoundingClientRect();
    const [x, y] = spot.pos;
    return { x: rect.left + x * rect.width, y: rect.top + y * rect.height };
  }, [spot, svgRef]);
  return { id, spots, spotId, spot, heroes, getAnchor, setHover, setFocus };
}
