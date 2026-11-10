# E2 · Промпты для арта карты

Инструменты Claude не генерируют растровые картинки, поэтому арт делает человек в нейросети (Midjourney, Stable Diffusion, DALL·E и т. п.) по этим промптам. Требования — SPEC §8.1 (уровень B) и §9.

## Общие требования

- **Никакого текста на картинке**: ни названий, ни букв, ни рун, ни картушей, ни легенды, ни розы ветров с буквами. Все подписи накладываются в HTML (RU/EN).
- **16:10**. Мир — не меньше **4096 × 2560 px**, детальные картинки регионов — не меньше **2560 × 1600 px**.
- **Стиль**: нарисованная фэнтези-карта с рельефом (горы, леса, реки, побережья видны объёмно, вид сверху под небольшим углом), в духе Dota 2: тёмная палитра, холодный камень, сталь и бронза, тёплый свет в важных местах. Не копируем чужую карту (официальную карту Source 1, фанатские карты, карту League of Legends) — только настроение.
- **Ярусы**: сверху — полоса небес и космоса (звёзды, туманность, луны), снизу — огненный разлом (лава, трещины, багровый дым). Обе — во всю ширину, у верхних и нижних 13 % картинки.
- **Место под подписи**: в каждом регионе — относительно спокойные участки (равнина, вода, поляна), без мелкого шума по всей площади.
- **Север — Radiant, юг — Dire**: к северу краски светлее и холоднее (зелень, золото, лёд), к югу — темнее и горячее (охра, багрянец, пепел). Переход мягкий, без линии.

## Как использовать схему

[`schema-base.svg`](schema-base.svg) — та же геометрия, что в [`map/layout.json`](../../map/layout.json), но без текста и маркеров: регионы залиты цветом среды. Это основа для генерации, чтобы готовая картинка совпала с разметкой.

1. Перевести в PNG нужного размера, например:
   `chrome --headless=new --hide-scrollbars --window-size=4096,2560 --screenshot=base.png docs/map/schema-base.svg`
   (или открыть SVG в браузере / Inkscape и экспортировать).
2. **Stable Diffusion (рекомендуется)**: img2img с `base.png`, denoising 0.55–0.7, плюс ControlNet — `seg` или `lineart` (контуры берутся из той же картинки) с весом 0.6–0.8. Генерировать в 1/2 размера и апскейлить до 4096 (Tiled upscale / Ultimate SD Upscale), чтобы рельеф не «плыл».
3. **Midjourney**: загрузить `base.png` как image prompt (`--iw 1.5–2`) и указать `--ar 16:10 --no text, letters, labels, watermark, frame`. Контуры будут соблюдены приблизительно — после генерации проверить и при необходимости подвинуть полигоны в `layout.json`.
4. **DALL·E / редакторы с inpaint**: генерировать мир целиком по промпту ниже, затем дорабатывать отдельные регионы через выделение области и inpaint.
5. **Сверка**: наложить `docs/map/schema.svg` поверх результата с прозрачностью 50 %. Береговая линия и крупные хребты должны совпадать с границами регионов ± 1–2 % ширины. Если арт ушёл сильно — проще поправить `layout.json` (и прогнать `node map/check-layout.mjs`), чем перегенерировать.
6. **Ручная доработка**: убрать случайные буквы и знаки, выровнять швы между ярусами и материком, сохранить в `map/art/world.png` (исходник), оптимизация в WebP/AVIF — отдельная задача (SPEC §9 п. 5).

## Промпт: карта мира

```
A hand-painted fantasy world map, top-down view with gentle 3D relief, 16:10 wide.
One large continent in the middle of a dark sea, with three island groups: a misty fog-shrouded
island in the far north-east corner, a green island state in the eastern sea, a tropical
archipelago off the south-west coast. In the south-east sea, glowing ruins of sunken cities
visible through deep dark water.
North of the continent: frozen tundra, glaciers and a jagged ice mountain range on the northern coast;
green meadows and hills with many small lakes in the north-west; a silvery moonlit forest in the north-east;
in the center-north, farmland, rivers and walled cities of a great empire.
Center: plains and small kingdoms, grey barren badlands, a scarred battlefield plain.
West: dense ancient forests along the coast. South-west: steaming tropical jungle with overgrown ruins,
a pale land where trees and towers are made of bone, a misty dark forest and marshes.
South: a vast golden equatorial desert with ancient ruins, red rocky plateau of the centaur clans,
dark wailing mountains with monasteries, a gloomy coastline with tidal marshes.
Top edge: a band of night sky and cosmos — stars, nebula, moons, a shattered moon, floating sky citadel.
Bottom edge: a band of the abyss — a fiery rift, lava rivers, glowing cracks, crimson smoke.
Style: dark fantasy, Dota 2 inspired, dark stone and steel, bronze accents, warm light in key places,
the north brighter and colder (green, gold, ice), the south darker and hotter (ochre, crimson, ash).
Painterly, detailed relief, clear coastlines, calm areas for overlay labels.
No text, no letters, no labels, no runes, no legend, no compass, no frame, no border, no watermark.
```

Negative prompt (SD): `text, letters, words, labels, typography, runes, signature, watermark, compass rose, legend, frame, border, grid, ui, modern, photo, blurry`.

## Детальные картинки регионов

Шаблон (подставить строку из таблицы ниже). Основа — тот же регион, вырезанный из готовой картинки мира по `camera` из `layout.json` и увеличенный (img2img, denoising 0.4–0.55): так детальная картинка совпадает со стилем и рельефом мира.

```
A detailed hand-painted fantasy map region, top-down view with gentle 3D relief, 16:10, 2560 px wide.
<БИОМ И ОРИЕНТИРЫ>.
Dark fantasy, Dota 2 inspired, dark stone and steel, bronze accents, painterly, detailed relief,
calm open areas for overlay labels and markers.
No text, no letters, no labels, no runes, no frame, no watermark.
```

| Регион | Сторона | Среда (biome) | Визуальные ориентиры для промпта |
|---|---|---|---|
| Небеса | ярус | sky | night sky with stars and nebula, a floating citadel among clouds, a pale moon and a silver moon, a shattered moon with glowing shards (one radiant gold, one dark red), a blazing sun forge, a celestial palace on clouds |
| Семь планов и Пустота | ярус | void | layered translucent planes of existence, violet nebula, a black void with a rim of dim light, an alien world at the edge, a tall wall of light, an ivory egg-like incubator, a glowing tree heart, a dream mist |
| Айсрак | Radiant | snow | frozen tundra, blue glacier, jagged ice mountain range on the north coast, a fortified ice city, a steaming boiling sea, a northern harbor with ships in ice, pine forest, a black frozen pool |
| Земля Сияющих | Radiant | plains | green rolling hills and meadows, a thousand small lakes, a peaceful village, a violet plateau with an ancient archive library, a castle on a fold of hills, mountain valleys of small inventors with workshops and a coastal bight |
| Лес Найтсильвер | Radiant | forest | silver moonlit forest, glowing night flowers, a white moon temple, a shrine among ancient trees |
| Стоунхолл | Radiant | city | great walled stone capital, farmland, rivers and mills, many towns and lakes around, a lake to the north, plains to the west |
| Вольные города | Radiant | city | a tall white spire city, a rose-covered city, merchant towns with mixed architecture, foggy iron foundry |
| Кладд и острова | Radiant | islands | island kingdom with a fortified port, a trembling volcanic islet, half-sunken islands, a narrow channel between cliffs |
| Западные леса | Radiant | forest | dense ancient forest on the west coast, a forest village, a sacred vale with a seer's grove, a bay, tangled mangrove wood |
| Слом и Эльзе | Radiant | plains | two rival kingdoms with castles, a road with taverns between them, stony hills |
| Квойдж и Поля Бойни | нейтрально | plains | a harbor city on the east coast, smoky port, a great cathedral, to the south a scarred endless battlefield with craters, broken weapons and banners |
| Хазадальские пустоши | нейтрально | desert | grey-ochre badlands, nomad tribal camps, a dark fortress on a crag |
| Срединные королевства | нейтрально | plains | patchwork of small kingdoms, an academy of magic, a hidden temple, a hidden insect hive, a fiery mountain, a sun throne palace, a sacred font |
| Неизведанные земли | нейтрально | fog | an island hidden in thick white fog, only vague silhouettes of cliffs and trees |
| Ховен и Нишай | Dire | forest | a huge dark forest at the foot of bleeding red hills, black tar streams flowing down, a land of earthquakes with cracked ground, a red mountain |
| Сверкающая пустошь | Dire | desert | vast golden desert glittering with crystal sand, dunes, ruins of a desert empire, ancient rift-shadow ruins, bone ruins, a singing canyon, an oasis city |
| Империя Костей | Dire | desert | pale land where palace, towers, roads and even the forest are made of bone, ruins of a gleaming city |
| Друуд | Dire | desert | red rocky desert plateau, centaur clan camps, arena ring |
| Феллстрат | Dire | jungle | steaming tropical jungle with monsoon rain, overgrown ancient empire ruins, misty mountains, a jungle city, murky roots swamp |
| Глубины | Dire | sea | deep dark ocean, sunken cities on the seabed, coral reefs, a sunken treasury, a glowing infernal hollow far below, bioluminescence |
| Тропические острова | Dire | islands | tropical archipelago, an island of masks with a mask temple, ivory-white isles, a bay, acid-green jungles, ash-covered islets |
| Тенистый берег | Dire | swamp | gloomy coastline, tidal marshes, ruined shore city, a vigil keep with a colonnade |
| Томо'кан и Окраины | Dire | swamp | misty dark forest, a dread marsh, a kingdom beyond the marsh, edge of a desert, fallen glowing stones |
| Стонущие горы | Dire | mountains | dark wailing mountains with wind, a ruined city, a fortress of flares, mountain monasteries, a lone great mountain, a wild road, a jade upland |
| Подземье | ярус | volcanic | underground caverns under magma, a city among volcano roots, emerald glowing abyss caves, tectonic depths |
| Семь Преисподних и загробье | ярус | hell | seven layers of hell, a demon prison, a narrow maze of souls, an underscape, outer hells, a pale realm of the dead |

Цвета сред в `schema-base.svg` соответствуют этой таблице. Описания среды для интерфейса (`biome`, `ambient`) — в `content/regions/` (эпик E1), здесь — только указания для художника.

## В4: объёмные ориентиры (уровень A)

**Рекомендация: не в MVP.** Объёмные ориентиры (3D-модели или 2.5D-спрайты цитаделей, храмов, кристаллов) требуют отдельного арта для каждого места в одном стиле, согласования с картинкой мира и отдельного слоя в `MapStage`, а инструмента генерации у нас нет даже для плоского арта. Целевой уровень MVP — B: нарисованная карта с рельефом + детальные картинки регионов. Ориентиры можно добавить в следующей итерации как слой спрайтов поверх карты по координатам мест из `layout.json`, не меняя формат. Окончательное решение — за владельцем продукта.
