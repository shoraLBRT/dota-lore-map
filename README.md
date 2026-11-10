# Dota 2 Lore Map

Интерактивная карта мира Dota 2: регионы, локации, герои, которые там живут, официальные арты и синематики.
Interactive map of the Dota 2 world: regions, locations, the heroes who live there, official art and cinematics.

- Техническое задание: [docs/SPEC.md](docs/SPEC.md)
- Бэклог: [Issues](../../issues)
- Исследование лора (E1): [docs/research/E1-places.md](docs/research/E1-places.md), данные в [research/e1/](research/e1/)
- Архитектура и стек: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Vite + React 18 + TypeScript, статический сайт на GitHub Pages

## Разработка

Нужны Node 22 и Python 3 (для проверки исследования).

```sh
npm ci              # установить зависимости
npm run dev         # локальный сервер разработки
npm run data        # собрать research/ + content/ + map/ в src/data/world.generated.json
npm run typecheck   # проверка типов TypeScript
npm run lint        # ESLint
npm test            # тесты Vitest
npm run build       # сборка в dist/
npm run preview     # посмотреть собранный dist/
npm run check       # всё перед PR: data → typecheck → lint → test → build → python research/e1/build.py --check
```

После правки `research/e1/`, `content/regions/` или `map/layout.json` запустите `npm run data` и закоммитьте `src/data/world.generated.json` — CI проверяет, что файл актуален.

CI (`.github/workflows/ci.yml`) запускает `npm run check` на каждый PR и push в `main`; push в `main` публикует сайт на GitHub Pages (`.github/workflows/deploy.yml`).

---

**Дисклеймер.** Некоммерческий фанатский проект. Не связан с Valve Corporation и не одобрен ею. Dota 2 и связанные материалы — товарные знаки и собственность Valve Corporation.

**Disclaimer.** Non-commercial fan project. Not affiliated with or endorsed by Valve Corporation. Dota 2 and all related materials are trademarks and property of Valve Corporation.
