# E2 · Промпты для арта карты

Инструменты Claude не генерируют растровые картинки, поэтому арт делает человек в нейросети (Midjourney, Stable Diffusion, DALL·E и т. п.) по этим промптам. Требования — SPEC §8.1 (уровень B) и §9.

## Общие требования

- **Никакого текста на картинке**: ни названий, ни букв, ни рун, ни картушей, ни легенды, ни розы ветров с буквами. Все подписи накладываются в HTML (RU/EN).
- **1:1** (решение владельца 2026-11-18, #163). Мир — не меньше **4096 × 4096 px**, детальные картинки регионов — не меньше **2560 px** по большей стороне.
- **Стиль**: реалистичный рельеф, как с орбиты (вид строго сверху, горы, леса, реки и побережья читаются объёмно); города — в масштабе карты, а не крупными значками. Настроение Dota 2: тёмная палитра, холодный камень, сталь и бронза, тёплый свет в важных местах. Не копируем чужую карту (официальную карту Source 1, фанатские карты, карту League of Legends) — только настроение.
- **Два материка** с проливом между ними с запада на восток: северный — Radiant и центр, южный — Dire.
- **Ярусы — в углах**: правый верхний — ближе к миру небо и облака, в самом углу — космос (звёзды, туманность); левый нижний — ближе к миру пещеры (зелёное свечение), в самом углу — ад и загробье (лава, трещины, багровый дым). Два других угла — открытое море. **Лун на картинке нет**: Безумная Луна и Луна Селемены будут отдельным слоем (уровень A).
- **Место под подписи**: в каждом регионе — относительно спокойные участки (равнина, вода, поляна), без мелкого шума по всей площади.
- **Север — Radiant, юг — Dire**: к северу краски светлее и холоднее (зелень, золото, лёд), к югу — темнее и горячее (охра, багрянец, пепел).

## Как использовать основу

Основа текущего арта — [`map/art/base/schema-base-v5.svg`](../../map/art/base/schema-base-v5.svg) (1:1, построена скриптом `map/art/base/scripts/base5.cjs` из разметки до #163, README там же): материки залиты приглушённым цветом среды, пролив прорезан, ярусы — градиентами в углах. Вариант с номерами регионов — `base-v5-1x1-numbers.png`. Сейчас `map/layout.json` уже подогнан под готовый арт, поэтому для перегенерации основу лучше строить заново из него (`docs/map/schema-base.svg`, `node map/render-schema.mjs`).

1. Перевести основу в PNG нужного размера (браузер, Inkscape или `chrome --headless=new --window-size=4096,4096 --screenshot=base.png <svg>`).
2. **Stable Diffusion**: img2img с `base.png`, denoising 0.55–0.7, плюс ControlNet `seg` или `lineart` с весом 0.6–0.8; генерировать в 1/2 размера и апскейлить до 4096+.
3. **Midjourney / ChatGPT**: загрузить `base.png` как образ (`--iw 1.5–2`, `--ar 1:1 --no text, letters, labels, watermark, frame, moon`). Контуры соблюдаются приблизительно — после генерации подогнать разметку.
4. **Сверка**: береговая линия и пролив должны совпадать с границами регионов в пределах 1 % ширины. Разметку под готовый арт подгоняют скрипты `map/art/fit/` (маска суши → контур → полигоны) и затем `node map/check-layout.mjs`; наложение для проверки — как [`e2-163/overlay.webp`](e2-163/overlay.webp).
5. **Ручная доработка**: убрать случайные буквы и знаки. Исходник — `map/art/world.jpg`, для сайта — `public/art/world-4096.webp` и превью `world-1024.webp` (ffmpeg, libwebp, качество ~78/75).

## Промпт: карта мира

```
A realistic fantasy world seen from orbit, strictly top-down, square 1:1 composition, rich natural relief.
Two continents separated by a winding west-to-east strait, surrounded by a dark sea.
Northern continent: frozen glaciers and a jagged ice range on the north coast; green meadows and lakes
in the north-west; a dark moonlit forest in the north-east; in the center, farmland, rivers and a great
walled imperial city at map scale; grey badlands and a volcano near the strait; cliffs and spires on the
north-east coast.
Southern continent: dense jungle and overgrown ruins in the south-west, a pale bone-white land, a vast
golden desert with ancient ruins, a red rocky plateau, dark jagged mountains, a gloomy marshy coast.
Islands: a tropical archipelago off the west coast, a green island state and a fog-shrouded island in
the east, a deep dark oceanic rift east of the continents.
Top-right corner: clouds and sky near the world, fading into deep space with stars and a nebula in the corner.
Bottom-left corner: caverns with green glow near the world, fading into a hellscape of lava rivers,
glowing cracks and crimson smoke in the corner. The other two corners are open sea.
Style: photoreal relief like satellite imagery with a dark fantasy mood, Dota 2 inspired palette,
the north brighter and colder, the south darker and hotter. Cities at map scale. Calm areas for labels.
No moons, no text, no letters, no labels, no runes, no legend, no compass, no frame, no border, no watermark.
```

Negative prompt (SD): `text, letters, words, labels, typography, runes, signature, watermark, compass rose, legend, frame, border, grid, ui, moon, blurry`.

## Детальные картинки регионов

Шаблон (подставить строку из таблицы ниже). Основа — тот же регион, вырезанный из готовой картинки мира по `camera` из `layout.json` и увеличенный (img2img, denoising 0.4–0.55): так детальная картинка совпадает со стилем и рельефом мира.

```
A detailed realistic fantasy region seen from orbit, strictly top-down, natural relief, 2560 px on the long side.
<БИОМ И ОРИЕНТИРЫ>.
Dark fantasy mood, Dota 2 inspired palette, cities at map scale, detailed relief,
calm open areas for overlay labels and markers.
No text, no letters, no labels, no runes, no frame, no watermark.
```

| Регион | Сторона | Среда (biome) | Визуальные ориентиры для промпта |
|---|---|---|---|
| Небеса | ярус | sky | night sky with stars and nebula, a pale moon and a silver moon, a shattered moon with glowing shards (one radiant gold, one dark red), a blazing sun forge, a celestial palace on clouds, a huge steel bell hanging in the void |
| Семь планов и Пустота | ярус | void | layered translucent planes of existence, violet nebula, a black void with a rim of dim light, an alien world at the edge, a tall wall of light, an ivory egg-like incubator on mountain peaks, a carved-stone royal seat, a glowing tree heart, a hidden fae glade with a great old tree, a sea cascade pouring into the void, a sealed vault floating outside space, a dream mist |
| Айсрак | Radiant | snow | frozen tundra, blue glacier, jagged ice mountain range on the north coast, a fortified ice city, a steaming boiling sea, a northern harbor with ships in ice, pine forest, a black frozen pool |
| Земля Сияющих | Radiant | plains | green rolling hills and meadows, a thousand small lakes, a peaceful village, a violet plateau with an ancient archive library, a castle on a fold of hills, mountain valleys of small inventors with workshops and a coastal bight |
| Скайрат | Radiant | mountains | sheer coastal cliffs and tall stone spires above the clouds, a palace citadel on the highest spire, a crowded lower town at the foot of the cliff, a fortified lowland gate with a watchtower, a hanging prison cage on a spire |
| Лес Найтсильвер | Radiant | forest | silver moonlit forest, glowing night flowers, a white moon temple, a shrine among ancient trees |
| Стоунхолл | Radiant | city | great walled stone capital, farmland, rivers and mills, many towns and lakes around, a lake to the north, plains to the west, a besieged fortress town on the eastern edge |
| Вольные города | Radiant | city | a tall white spire city, a rose-covered city, merchant towns with mixed architecture, foggy iron foundry |
| Кладд и острова | Radiant | islands | island kingdom with a fortified port, a trembling volcanic islet, half-sunken islands, a narrow channel between cliffs |
| Западные леса | Radiant | forest | dense ancient forest on the west coast, a forest village, a sacred vale with a seer's grove, a bay, tangled mangrove wood |
| Слом и Эльзе | Radiant | plains | two rival kingdoms with castles, a road with taverns between them, stony hills |
| Квойдж и Поля Бойни | нейтрально | plains | a harbor city on the east coast, smoky port, a great cathedral, to the south a scarred endless battlefield with craters, broken weapons and banners |
| Хазадальские пустоши | нейтрально | desert | grey-ochre badlands, nomad tribal camps, a dark fortress on a crag |
| Срединные королевства | нейтрально | plains | patchwork of small kingdoms, an academy of magic, a hidden temple, a hidden insect hive, a fiery mountain with a stepped ziggurat on its slope, a sun throne palace, a sacred font |
| Неизведанные земли | нейтрально | fog | an island hidden in thick white fog, only vague silhouettes of cliffs and trees |
| Ховен и Нишай | Dire | forest | a huge dark forest at the foot of bleeding red hills, black tar streams flowing down, a land of earthquakes with cracked ground, a red mountain |
| Сверкающая пустошь | Dire | desert | vast golden desert glittering with crystal sand, dunes, ruins of a desert empire, ancient rift-shadow ruins, bone ruins, a singing canyon, an oasis city |
| Империя Костей | Dire | desert | pale land where palace, towers, roads and even the forest are made of bone, ruins of a gleaming city |
| Друуд | Dire | desert | red rocky desert plateau, centaur clan camps, arena ring, a wind-scoured crater battlefield |
| Феллстрат | Dire | jungle | steaming tropical jungle with monsoon rain, overgrown ancient empire ruins, misty mountains, a jungle city, murky roots swamp |
| Глубины | Dire | sea | deep dark ocean, sunken cities on the seabed, coral reefs, a sunken treasury, a glowing infernal hollow far below, bioluminescence |
| Тропические острова | Dire | islands | tropical archipelago, an island of masks with a mask temple, ivory-white isles, a bay, acid-green jungles, ash-covered islets |
| Тенистый берег | Dire | swamp | gloomy coastline, tidal marshes, ruined shore city, a vigil keep with a colonnade |
| Томо'кан и Окраины | Dire | swamp | misty dark forest, a dread marsh, a kingdom beyond the marsh, edge of a desert, fallen glowing stones |
| Стонущие горы | Dire | mountains | dark wailing mountains with wind, a ruined city, a fortress of flares, mountain monasteries, a lone great mountain, a wild road, a jade upland |
| Подземье | ярус | volcanic | underground caverns under magma, a city among volcano roots, emerald glowing abyss caves, tectonic depths |
| Семь Преисподних и загробье | ярус | hell | seven layers of hell, a demon prison, a narrow maze of souls overseen by a dark court, an underscape, outer hells, a pale realm of the dead |

Цвета сред в `schema-base.svg` соответствуют этой таблице. Описания среды для интерфейса (`biome`, `ambient`) — в `content/regions/` (эпик E1), здесь — только указания для художника.

## В4: объёмные ориентиры (уровень A)

**Решено владельцем 2026-11-11: после MVP.** Объёмные ориентиры (3D-модели или 2.5D-спрайты цитаделей, храмов, кристаллов) требуют отдельного арта для каждого места в одном стиле, согласования с картинкой мира и отдельного слоя в `MapStage`, а инструмента генерации у нас нет даже для плоского арта. Целевой уровень MVP — B: нарисованная карта с рельефом + детальные картинки регионов. Ориентиры можно добавить в следующей итерации как слой спрайтов поверх карты по координатам мест из `layout.json`, не меняя формат. Окончательное решение — за владельцем продукта.
