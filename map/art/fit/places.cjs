// Места: ярусы — по углам по смыслу; материк — внутрь своего полигона и на сушу, без слипания.
module.exports = function (L, lab, N, placeRegion, TIERS) {
  const r4 = (v) => Math.round(v * 10000) / 10000;
  const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  const inside = ([x, y], poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const edgeDist = (p, poly) => Math.min(...poly.map((a, i) => segD(p, a, poly[(i + 1) % poly.length])));
  const land = (p) => { const x = Math.floor(p[0] * N), y = Math.floor(p[1] * N); return lab[y * N + x] >= 0; };
  const MARGIN = 0.009;

  // ---- ярусы: эллиптические координаты от угла; s — доля от угла (0) к внешней дуге (1)
  const sky = (s, th) => [1 - 0.42 * s * Math.cos(th), 0.17 * s * Math.sin(th)];
  const skyRing = (s, th) => [1 - (0.42 + 0.28 * s) * Math.cos(th), (0.17 + 0.085 * s) * Math.sin(th)];
  const hell = (s, th) => [0.42 * s * Math.cos(th), 1 - 0.15 * s * Math.sin(th)];
  const deepRing = (s, th) => [(0.42 + 0.3 * s) * Math.cos(th), 1 - (0.15 + 0.095 * s) * Math.sin(th)];
  const T = {
    // Небеса: луны и Солнце — ближе к миру (у внешней дуги), остальное — у Планов
    'Mad Moon': skyRing(0.72, 0.42), "Selemene's Moon": skyRing(0.72, 0.85), 'The Sun': skyRing(0.72, 1.25),
    Olympus: skyRing(0.3, 0.3), Vashundol: skyRing(0.3, 0.75), Ultoria: skyRing(0.3, 1.2),
    // Планы: Пустота и Запределье — у самого угла
    'The Void': sky(0.13, 0.75), 'The Outworld': sky(0.34, 0.45), Cataract: sky(0.34, 1.15), 'Continuum Vault': sky(0.36, 0.8),
    'Fabric of Creation': sky(0.58, 0.22), Claszureme: sky(0.58, 0.55), 'Fae Realm': sky(0.58, 0.88), 'The Dream': sky(0.58, 1.2),
    'Fundamental Plane': sky(0.85, 0.18), 'Primordial Plane': sky(0.85, 0.36), 'Elemental Plane': sky(0.85, 0.54), 'Astral Plane': sky(0.85, 0.72),
    'Land Behind the Wall': sky(0.85, 0.9), 'Ivory Incubarium': sky(0.85, 1.08), 'Heart of Nature': sky(0.85, 1.26), "Light's Keep": sky(0.62, 1.42),
    'Great Seat of Cymurri': sky(0.82, 1.43),
    // Подземье — кольцо ближе к миру
    Aziyog: deepRing(0.5, 0.22), 'Nether Reaches': deepRing(0.5, 0.62), 'The Emerald Abyss': deepRing(0.5, 1.0), 'The Underhollow': deepRing(0.5, 1.38),
    // Преисподние: путь Narrow Maze → Underscape — от края к углу
    'Narrow Maze': hell(0.86, 0.75), 'Seven Hells': hell(0.62, 0.75), Underscape: hell(0.38, 0.75),
    Abysm: hell(0.66, 0.28), Foulfell: hell(0.88, 0.32), 'Court of Ristul': hell(0.66, 1.2), 'Outer Hells': hell(0.88, 1.2), 'Nothl Realm': hell(0.3, 0.3),
  };
  for (const [name, pos] of Object.entries(T)) { if (!L.places[name]) throw new Error('нет места ' + name); L.places[name].pos = pos.map(r4); }
  L.regions.planes.label = sky(0.5, 0.95).map(r4);
  L.regions.heavens.label = skyRing(0.5, 0.55).map(r4);
  L.regions.hells.label = hell(0.55, 0.5).map(r4);
  L.regions.underdark.label = deepRing(0.45, 0.8).map(r4);

  L.places['Ghastly Eyrie'].pos = [0.772, 0.318]; L.places.Midgate.pos = [0.768, 0.348];
  // ---- материк: внутрь полигона и на сушу (для мест суши), шаг к подписи региона
  const okAt = (p, id) => { const poly = L.regions[id].polygon; return inside(p, poly) && edgeDist(p, poly) >= MARGIN && (TIERS.includes(id) || id === 'the-deep' || land(p)); };
  const pull = (p, id, to) => { let q = p.slice(); for (let i = 0; i < 200 && !okAt(q, id); i++) q = [q[0] + (to[0] - q[0]) * 0.05, q[1] + (to[1] - q[1]) * 0.05]; return q; };
  for (const [id, r] of Object.entries(L.regions)) if (!okAt(r.label, id)) { const c = r.polygon.reduce((s, p) => [s[0] + p[0] / r.polygon.length, s[1] + p[1] / r.polygon.length], [0, 0]); r.label = pull(r.label, id, c).map(r4); }
  const moved = [];
  for (const [name, p] of Object.entries(L.places)) { const id = placeRegion[name]; if (!okAt(p.pos, id)) { const before = p.pos; p.pos = pull(p.pos, id, L.regions[id].label).map(r4); moved.push(`${name} ${before} → ${p.pos}`); } }
  // ---- раздвинуть слипшиеся (< 0.014)
  const byRegion = {};
  for (const [name, p] of Object.entries(L.places)) (byRegion[placeRegion[name]] ??= []).push(p);
  for (const [id, ps] of Object.entries(byRegion)) for (let it = 0; it < 60; it++) {
    let any = false;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i].pos, b = ps[j].pos; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d < 0.014) { any = true; const ux = d ? (a[0] - b[0]) / d : 1, uy = d ? (a[1] - b[1]) / d : 0; const k = (0.0145 - d) / 2;
        const na = [a[0] + ux * k, a[1] + uy * k], nb = [b[0] - ux * k, b[1] - uy * k];
        if (okAt(na, id)) ps[i].pos = na.map(r4); if (okAt(nb, id)) ps[j].pos = nb.map(r4); }
    }
    if (!any) break;
  }
  console.log('сдвинуто внутрь:', moved.length); if (process.env.V) console.log(moved.join('\n'));
};
