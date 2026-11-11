# Архитектура

Решения, обязательные для всех, кто пишет код. Функциональные требования — в [SPEC.md](SPEC.md). Изменить решение можно только правкой этого файла в отдельном PR с объяснением.

## A1. Стек

| Что | Решение |
|---|---|
| Сборка | Vite, статический сайт без бэкенда |
| UI | React 18 + TypeScript (`strict: true`), без UI-библиотек |
| Стили | CSS Modules + CSS custom properties (токены из дизайн-системы, `src/styles/tokens.css`) |
| Состояние | React context + `useReducer` для навигации; без Redux/Zustand |
| Анимации | CSS transitions / Web Animations API; без анимационных библиотек |
| Частицы | `<canvas>` поверх карты, свой небольшой движок |
| Тесты | Vitest + @testing-library/react (jsdom) |
| Линт | ESLint (typescript-eslint, react-hooks) |
| Node | 22 LTS, npm |

## A2. Структура репозитория

```
research/e1/        исследование лора: heroes.json, regions.json, hero-places.json, build.py (источник правды о регионах, местах и героях)
content/            тексты: content/regions/<regionId>.json (RU/EN описания, характеристики, тексты мест); content/media.json (медиа галереи)
map/                геометрия карты: map/layout.json (полигоны, позиции, камеры), арт в map/art/
scripts/            build-data.mjs — собирает research + content + map в src/data/world.generated.json
src/
  app/              корень приложения, роутинг, провайдеры
  features/         экраны и крупные блоки: intro, world, region, location, gallery, search, panel
  components/       переиспользуемые компоненты дизайн-системы
  data/             типы данных, загрузка, world.generated.json (генерируется, коммитится)
  i18n/             словарь интерфейса ru.json / en.json, хук useT()
  styles/           tokens.css, global.css
public/             статические ассеты (шрифты, звуки, арт карты после оптимизации)
docs/               SPEC, ARCHITECTURE, PROJECT_STATE, исследования
```

## A3. Данные

- **Источник правды** — JSON в `research/e1/`, `content/`, `map/`. Приложение их напрямую не читает.
- `npm run data` (`scripts/build-data.mjs`) сливает их в **один** файл `src/data/world.generated.json` и валидирует. Файл коммитится, чтобы сборка не зависела от скриптов.
- Отсутствующий контент (нет описания, нет позиции на карте) — не ошибка: приложение просто не показывает блок или маркер. Ошибка — ссылка на несуществующий регион, место или героя.
- Тексты — объекты `{ "ru": "...", "en": "..." }`. Тип в TS: `Localized`.
- В русских текстах названия героев пишутся латиницей, точно как в `research/e1/heroes.json` (как в русском клиенте игры); личные имена персонажей — кириллицей.

### Формат `content/regions/<regionId>.json`
```jsonc
{
  "id": "icewrack",
  "subtitle": { "ru": "...", "en": "..." },
  "biome": "snow",               // snow | forest | jungle | desert | mountains | plains | swamp | sea | islands | volcanic | city | sky | void | hell | fog
  "ambient": { "type": "snow", "density": 0.6 },   // snow | ash | embers | fog | rain | sparkles | stars | leaves | sand | none
  "traits": {
    "rule":  { "ru": "...", "en": "..." },
    "magic": { "ru": "...", "en": "..." },
    "biome": { "ru": "...", "en": "..." }
  },
  "description": { "ru": "...", "en": "..." },
  "media": ["icewrack-new-neighbors"],   // необязательно: id из content/media.json, ≤ 3
  "places": {
    "<Place name из research/e1/regions.json>": {
      "name": { "ru": "...", "en": "..." },
      "type": { "ru": "...", "en": "..." },
      "description": { "ru": "...", "en": "..." },
      "media": ["frostreach-the-dragon"]   // необязательно, ≤ 3
    }
  }
}
```
Сторона (`side`) и название региона берутся из `research/e1/regions.json`.

### Формат `content/media.json`
Медиа галереи (SPEC §5.6, §10) — один файл на весь мир; регион и место ссылаются на медиа по `id` (поле `media` выше), поэтому одно медиа можно показать в нескольких местах.
```jsonc
{
  "note": "...",
  "media": [
    {
      "id": "frostreach-the-dragon",          // kebab-case, уникален
      "type": "image",                        // image | youtube
      "src": "https://cdn.steamstatic.com/...",   // только у image: https-ссылка или относительный путь к ассету
      "youtubeId": "xxxxxxxxxxx",             // только у youtube: 11 символов, встраивание через youtube-nocookie.com
      "title":       { "ru": "...", "en": "..." },
      "subtitle":    { "ru": "Комикс", "en": "Comic" },   // тип: Комикс | Синематик | Арт | Трейлер
      "description": { "ru": "...", "en": "..." },         // необязательно
      "credit": "Valve Corporation",          // правообладатель (SPEC §15)
      "sourceUrl": "https://www.dota2.com/..."   // страница источника, https
    }
  ]
}
```
- Только официальные материалы Valve (SPEC §11.2): комиксы и страницы dota2.com, синематики и трейлеры с YouTube-канала Dota 2, официальный арт. Каждая ссылка проверяется вручную перед добавлением; сомнительное не добавляем. Тексты — свои слова.
- Картинки в репозиторий не копируем: `src` — прямая ссылка на CDN Valve (как портреты в A6). Нет прямой официальной ссылки — медиа не добавляем.
- Ошибка: неизвестный `id` в ссылке, больше 3 медиа у региона или места, повтор id, нет ни `src`, ни `youtubeId`, `src` у видео или `youtubeId` у картинки, `http://` в `src`/`sourceUrl`, нет `credit`, неполный перевод. Предупреждение: медиа ни к чему не привязано.
- В `world.generated.json`: `World.media` (все медиа), `Region.media` и `Place.media` — списки id. Нет медиа — поля нет.

### Формат `research/e1/hero-aliases.json`
Алиасы для поиска героя (SPEC §6.5) — отдельно от `heroes.json`, потому что тот повторяет официальный список Valve, а алиасы — наши словарные данные.
```jsonc
{ "note": "...", "aliases": { "<hero key>": ["Пудж", "Butcher", "Мясник"] } }
```
- Что кладём: кириллическое написание имени, общеизвестные сокращения и прозвища сообщества (`CM`, `КМ`, `Войд`), личные имена персонажей (`Rylai`, `Райлай`). Сомнительное не добавляем.
- Сравнение без учёта регистра, `ё`/`е` и лишних пробелов (`normalizeAlias` в `scripts/build-data.mjs`); поиск в приложении нормализует так же.
- Ошибка: неизвестный ключ героя, пустая строка, повтор внутри героя, совпадение с именем героя. Предупреждение: один алиас у нескольких героев. Проверяют и `build-data.mjs`, и `build.py`.
- В `world.generated.json` — поле `Hero.aliases` (нет алиасов — поля нет).

### Формат `map/layout.json`
Координаты нормированы: `x, y ∈ [0, 1]` относительно картинки мира с соотношением сторон **16:10** (`aspect: 1.6`).
```jsonc
{
  "aspect": 1.6,
  "bands": { "upper": [0, 0.13], "abyss": [0.87, 1] },   // полосы ярусов по y
  "regions": {
    "<regionId>": {
      "polygon": [[x, y], ...],          // замкнутый контур, без самопересечений
      "label": [x, y],                   // якорь названия и подсказки
      "camera": { "x": 0.2, "y": 0.3, "zoom": 3 }   // центр кадра и масштаб при приближении
    }
  },
  "places": { "<Place name>": { "pos": [x, y] } }
}
```
- `camera.zoom = z`: кадр 16:10 показывает `1/z` ширины и высоты мира; центр уже ограничен так, чтобы кадр не выходил за картинку.
- Соседние регионы на суше делят границу (общие вершины), полигоны не пересекаются; места — внутри полигона своего региона, между местами одного региона ≥ 0.012. Проверка — `node map/check-layout.mjs`, схема — `node map/render-schema.mjs` → `docs/map/schema.svg` (подробности — [map/README.md](map/README.md)).

## A4. Карта и камера

- Один слой карты `MapStage`: картинка мира (или процедурная заглушка, пока нет арта) + SVG-оверлей в той же системе координат (`viewBox="0 0 1600 1000"`, нормированные координаты × 1600/1000).
- Камера — CSS `transform: translate() scale()` на слое карты, анимация через Web Animations API. Длительности — из SPEC §7.1.
- Заглушка арта: полигоны регионов, залитые цветом биома, с текстурой через SVG-фильтр `feTurbulence`. Позволяет делать всё приложение до готовности арта (E2).

## A5. Навигация и адреса

Решение по В2 (SPEC §17): **да**, у каждого состояния свой адрес, через hash — работает на GitHub Pages без серверных правил.

| Экран | Адрес |
|---|---|
| Интро | `#/` |
| Мир | `#/world` |
| Регион | `#/r/<regionId>` |
| Место | `#/r/<regionId>/<placeSlug>` |
| Выбранный герой | `?hero=<heroKey>` поверх любого адреса |
| Галерея | `?media=<mediaId>` поверх адреса региона/места |

`placeSlug` — имя места в kebab-case (`"Tomo'kan"` → `tomokan`).

## A6. Герои

- Ключ героя — `key` из `research/e1/heroes.json` (`antimage`, `crystal_maiden`).
- Портреты — решение по В7: **ссылаемся на CDN Valve** (`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/<key>.png`), с запасной заглушкой при ошибке загрузки. Не копируем в репозиторий.
- Ссылка на страницу героя: `https://www.dota2.com/hero/<slug>?l=<russian|english>`, где `slug` — английское имя в нижнем регистре без пробелов и знаков.

## A7. Деплой и проверки

- GitHub Actions: на каждый PR — `npm ci && npm run check`; на push в `main` — сборка и деплой на GitHub Pages (`base: '/dota-lore-map/'`).
- `npm run check` = `data` (сборка и валидация данных) + `typecheck` + `lint` + `test` + `build` + `python research/e1/build.py --check`.
- Ничего не мержится с красным CI.

## A8. Дизайн-система

- Токены (SPEC §8.2) — только в `src/styles/tokens.css` на `:root`; компоненты берут значения через `var(--…)`, цвета в коде не пишем. Исключение — заливка биомов процедурной заглушки карты (`features/world/biomes.ts`), её заменит нарисованная карта E2/E4.
- База (фон, типографика, фокус-кольцо `--accent`, скроллбары, `prefers-reduced-motion`) — `src/styles/global.css`. При reduced motion токены длительностей переопределяются: переходы камеры и интро — 200 мс, наведение и панель — мгновенно.
- Шрифты (решение В6) — Google Fonts через `<link>` в `index.html`, `display=swap`, с запасными системными:
  - `--font-display`: **Cormorant SC** — засечки с острыми клиновидными концами и настоящие капители с полной кириллицей ближе всех свободных шрифтов к заголовкам Valve (Trajan-подобным).
  - `--font-body`: **Manrope** — гротеск с кириллицей, хорошо читается мелким кеглем на тёмном фоне.
- Компоненты интерфейса — `src/components/` (CSS Modules): `Button` (primary/ghost, срезанные углы `clip-path`), `DiamondButton` (закрыть/свернуть/назад), `Divider` (линия с ромбами), `HeroPortrait` (портрет по A6, заглушка при ошибке), `PanelFrame` (рамка правой панели), `Tooltip`.
- Подсветка регионов на карте — цвет стороны с прозрачностью (`--radiant-glow`, `--dire-glow`, `--neutral-glow`), SPEC §8.3.
