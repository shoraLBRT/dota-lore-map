# Changelog

## [0.5.0](https://github.com/shoraLBRT/dota-lore-map/compare/v0.4.0...v0.5.0) (2026-11-21)


### Features

* **feedback:** send feedback through the deployed worker ([#242](https://github.com/shoraLBRT/dota-lore-map/issues/242)) ([8a985ee](https://github.com/shoraLBRT/dota-lore-map/commit/8a985ee48ab00fbbcf695a9f164c2b2f37fb0f4f))
* **feedback:** send feedback without a GitHub account via a Cloudflare worker ([#236](https://github.com/shoraLBRT/dota-lore-map/issues/236)) ([f354b88](https://github.com/shoraLBRT/dota-lore-map/commit/f354b8881b3aa47fa1d210984ee1e98391b2d43d))
* **intro:** show the map behind the title and enter on click anywhere ([#202](https://github.com/shoraLBRT/dota-lore-map/issues/202)) ([8d7e5a1](https://github.com/shoraLBRT/dota-lore-map/commit/8d7e5a1c2e1d63292256273dd3971ef9220175d6))
* **map:** add depth prototypes behind the depth URL flag ([#226](https://github.com/shoraLBRT/dota-lore-map/issues/226)) ([aa260e4](https://github.com/shoraLBRT/dota-lore-map/commit/aa260e4d6de34eada3d56d534316721e4e2fc19d))
* **map:** blur and dim the frame edges when zoomed in ([#240](https://github.com/shoraLBRT/dota-lore-map/issues/240)) ([176b74e](https://github.com/shoraLBRT/dota-lore-map/commit/176b74efdeb2fa40e0d2e6a7eb34358926852824)), closes [#233](https://github.com/shoraLBRT/dota-lore-map/issues/233)
* **map:** draw place markers as star, diamond and dot with plate-free haloed labels ([#216](https://github.com/shoraLBRT/dota-lore-map/issues/216)) ([9b54d74](https://github.com/shoraLBRT/dota-lore-map/commit/9b54d743e0b47682fa7471500914346e85a33478))
* **map:** fade the region highlight in and out and let its glow breathe ([#214](https://github.com/shoraLBRT/dota-lore-map/issues/214)) ([5d3a7b3](https://github.com/shoraLBRT/dota-lore-map/commit/5d3a7b39e4cc7c20429fb41cfbcc387de7963aca))
* **map:** fill the free area with the region frame and fly the camera to places ([#221](https://github.com/shoraLBRT/dota-lore-map/issues/221)) ([b035654](https://github.com/shoraLBRT/dota-lore-map/commit/b035654954b5b65475f4d0837b79773bd56f9838))
* **map:** part the clouds from the centre on region entry ([#239](https://github.com/shoraLBRT/dota-lore-map/issues/239)) ([8c98738](https://github.com/shoraLBRT/dota-lore-map/commit/8c98738a08874883a554ee162ee47c405c334705))
* **map:** reveal places in the world by significance as the camera zooms in ([#224](https://github.com/shoraLBRT/dota-lore-map/issues/224)) ([b4d3a44](https://github.com/shoraLBRT/dota-lore-map/commit/b4d3a44a263ce49b7bfccf9799751cfb81c544f8))
* **map:** show a first-visit hint that the map can be dragged and zoomed ([#227](https://github.com/shoraLBRT/dota-lore-map/issues/227)) ([d0c32ad](https://github.com/shoraLBRT/dota-lore-map/commit/d0c32ada8906cb9fb932d4b61e221a82d54ab673))
* **map:** show region names by level with crests on the main regions ([#222](https://github.com/shoraLBRT/dota-lore-map/issues/222)) ([9dd2c28](https://github.com/shoraLBRT/dota-lore-map/commit/9dd2c28f2cfb1ae04b1da2c6c6a854fc8bfdc251))
* **map:** show the phone world as a full-screen map with gestures and a regions sheet ([#225](https://github.com/shoraLBRT/dota-lore-map/issues/225)) ([b1355df](https://github.com/shoraLBRT/dota-lore-map/commit/b1355dfac123edabb96d7cda6edb45f5b237e883))
* **map:** show the region tooltip only on its label, compact and hidden while the camera moves ([#217](https://github.com/shoraLBRT/dota-lore-map/issues/217)) ([e782952](https://github.com/shoraLBRT/dota-lore-map/commit/e7829529ac35e5b817ebd195fbcdc65b0e0a81be))
* **rail:** show the language as one menu button and drop the side legend ([#219](https://github.com/shoraLBRT/dota-lore-map/issues/219)) ([5ac548c](https://github.com/shoraLBRT/dota-lore-map/commit/5ac548c367ebf7d9383aafc9f60acb1e52dcc432))


### Bug Fixes

* **feedback:** log why Turnstile rejects a token ([#245](https://github.com/shoraLBRT/dota-lore-map/issues/245)) ([d7bf311](https://github.com/shoraLBRT/dota-lore-map/commit/d7bf3114dfd62077613679f66eebd9bb22cba959))
* **hero:** show a portrait placeholder under the profile header art ([#218](https://github.com/shoraLBRT/dota-lore-map/issues/218)) ([91f35ea](https://github.com/shoraLBRT/dota-lore-map/commit/91f35eab6956d8200a6643b663bdf836de947651))
* **map:** draw map labels in a screen layer so they stay crisp on zoom ([#206](https://github.com/shoraLBRT/dota-lore-map/issues/206)) ([4667d2c](https://github.com/shoraLBRT/dota-lore-map/commit/4667d2c66a1287e7a3c46984960a5ecbfc3729a7))
* **map:** keep labels in step with the map when a render lags behind the gesture ([#241](https://github.com/shoraLBRT/dota-lore-map/issues/241)) ([dbf24c6](https://github.com/shoraLBRT/dota-lore-map/commit/dbf24c6d72fe98d33d2099f14e2c9c96af6319f5))
* **map:** lower max zoom and slow the wheel ([#205](https://github.com/shoraLBRT/dota-lore-map/issues/205)) ([f1afc9b](https://github.com/shoraLBRT/dota-lore-map/commit/f1afc9b0ff5c0fc9012299b31218eda396281ab4))
* **map:** nest zoom levels so the world never reaches the region frame ([#220](https://github.com/shoraLBRT/dota-lore-map/issues/220)) ([632a498](https://github.com/shoraLBRT/dota-lore-map/commit/632a49806d627acba645ce98275c513737c12f18))
* **map:** show region focus ring only for keyboard focus, by region shape ([#213](https://github.com/shoraLBRT/dota-lore-map/issues/213)) ([1f89631](https://github.com/shoraLBRT/dota-lore-map/commit/1f896318133fa4f1a07a6dc131d952ccd93cf93d))
* **map:** soften the region highlight and replace the region frame with a feathered veil ([#204](https://github.com/shoraLBRT/dota-lore-map/issues/204)) ([b9d18aa](https://github.com/shoraLBRT/dota-lore-map/commit/b9d18aac26311fba0408bee978e60689031a4cf7))
* **map:** zoom the camera, not the page, on pinch over map tooltips ([#215](https://github.com/shoraLBRT/dota-lore-map/issues/215)) ([541aba9](https://github.com/shoraLBRT/dota-lore-map/commit/541aba9e2c7c67d002d14543ec9f449d5c9a31a1))
* **ui:** make Esc, close and browser Back one step back for every window ([#229](https://github.com/shoraLBRT/dota-lore-map/issues/229)) ([c6cf8f2](https://github.com/shoraLBRT/dota-lore-map/commit/c6cf8f222a81493d5ae56efc0db7deff6874bdff))


### Performance Improvements

* **intro:** paint the intro before the script loads ([#201](https://github.com/shoraLBRT/dota-lore-map/issues/201)) ([46b8754](https://github.com/shoraLBRT/dota-lore-map/commit/46b87547e496cc9f484f00b19f485aae0c595888))
* **map:** keep the screen label layer unscaled so wheel zoom stays in the frame budget ([#237](https://github.com/shoraLBRT/dota-lore-map/issues/237)) ([905a40b](https://github.com/shoraLBRT/dota-lore-map/commit/905a40b95ad04a3c620d94a7509cfbd099fc74a4))
* **map:** remove jank on world entry, wheel zoom and region flight ([#199](https://github.com/shoraLBRT/dota-lore-map/issues/199)) ([f6b6681](https://github.com/shoraLBRT/dota-lore-map/commit/f6b66816f5312ff6651e9b5623c7bd5f2eeb8e8f))

## [0.4.0](https://github.com/shoraLBRT/dota-lore-map/compare/v0.3.0...v0.4.0) (2026-11-19)


### Features

* add social preview card, README, license and build version for 1.0 ([#177](https://github.com/shoraLBRT/dota-lore-map/issues/177)) ([09bd8aa](https://github.com/shoraLBRT/dota-lore-map/commit/09bd8aa0c2ac70966fd49db18cea45cfb0bcd43f))
* **content:** add Skywrath as a separate continent region ([#159](https://github.com/shoraLBRT/dota-lore-map/issues/159)) ([3025761](https://github.com/shoraLBRT/dota-lore-map/commit/30257619f10132022dd5229bb3bd2d416f351522))
* **content:** decide the remaining comics and merge Crownfall siege and Smoke Harbor ([#160](https://github.com/shoraLBRT/dota-lore-map/issues/160)) ([0510531](https://github.com/shoraLBRT/dota-lore-map/commit/05105314533e4ec9e89acc389e5e0de7936f65a4))
* **content:** pass through official comics and merge their findings ([#154](https://github.com/shoraLBRT/dota-lore-map/issues/154)) ([b4690c9](https://github.com/shoraLBRT/dota-lore-map/commit/b4690c9bf2e2779b0634a9bd1d64aa52a548a114))
* **content:** propose world schema reconciliation of place candidates ([#156](https://github.com/shoraLBRT/dota-lore-map/issues/156)) ([b7a2d3f](https://github.com/shoraLBRT/dota-lore-map/commit/b7a2d3fc70b4aca20801867d6e41cb36c6241992))
* **content:** verify E14 batch 05 heroes and merge their places ([#141](https://github.com/shoraLBRT/dota-lore-map/issues/141)) ([a0cd6c0](https://github.com/shoraLBRT/dota-lore-map/commit/a0cd6c034edbe51944c7bf774dc56b794a67c0fa))
* **content:** verify E14 batch 06 heroes and merge their places ([#142](https://github.com/shoraLBRT/dota-lore-map/issues/142)) ([09da05e](https://github.com/shoraLBRT/dota-lore-map/commit/09da05e0cdedbfc4ed67926c1a1209b7aca1019e))
* **content:** verify E14 batch 07 heroes and merge their places ([#143](https://github.com/shoraLBRT/dota-lore-map/issues/143)) ([8c7ff60](https://github.com/shoraLBRT/dota-lore-map/commit/8c7ff603a9073c346826e9a76ce166b433f78525))
* **content:** verify E14 batch 08 heroes and merge their places ([#144](https://github.com/shoraLBRT/dota-lore-map/issues/144)) ([edb04d1](https://github.com/shoraLBRT/dota-lore-map/commit/edb04d1eef004a4bb9a31d9959a229c8f05518ad))
* **content:** verify E14 batch 09 heroes and merge their places ([#145](https://github.com/shoraLBRT/dota-lore-map/issues/145)) ([92dafd1](https://github.com/shoraLBRT/dota-lore-map/commit/92dafd176c83e10a9bd04d1e9aaa4a6efcddb183))
* **content:** verify E14 batch 10 heroes and merge their places ([#146](https://github.com/shoraLBRT/dota-lore-map/issues/146)) ([27b3ba7](https://github.com/shoraLBRT/dota-lore-map/commit/27b3ba746d9f0bcafa12e5a13b93b15dd57a5170))
* **content:** verify E14 batch 11 heroes and merge their places ([#147](https://github.com/shoraLBRT/dota-lore-map/issues/147)) ([ec37b08](https://github.com/shoraLBRT/dota-lore-map/commit/ec37b08c32e6ed695dbb6695ee00dbdbeb02e259))
* **content:** verify E14 batch 12 heroes and merge their places ([#148](https://github.com/shoraLBRT/dota-lore-map/issues/148)) ([e763577](https://github.com/shoraLBRT/dota-lore-map/commit/e763577e0aafc9ba78c184ff4201ceb29534fd51))
* **content:** verify E14 batch 13 heroes and merge their places ([#149](https://github.com/shoraLBRT/dota-lore-map/issues/149)) ([03e26be](https://github.com/shoraLBRT/dota-lore-map/commit/03e26be0dd96d96d004f8d8d81c661b35190e882))
* **map:** add art tile cut, stitch and lazy tile pyramid layer ([#176](https://github.com/shoraLBRT/dota-lore-map/issues/176)) ([944c4df](https://github.com/shoraLBRT/dota-lore-map/commit/944c4df5d53d825237d588cfb6b6bdf76e4d6949))
* **map:** add atmosphere over world art with parallax clouds, fog and tier glow ([#174](https://github.com/shoraLBRT/dota-lore-map/issues/174)) ([25abf0f](https://github.com/shoraLBRT/dota-lore-map/commit/25abf0fefd33f1416845aa30751945c00389feab))
* **map:** add free camera over full-screen world art ([#171](https://github.com/shoraLBRT/dota-lore-map/issues/171)) ([ddbe79c](https://github.com/shoraLBRT/dota-lore-map/commit/ddbe79ca527949ee751913506c31e5806454d1b3))
* **map:** fit labels, hover tint, clouds and region frames to the world art ([#172](https://github.com/shoraLBRT/dota-lore-map/issues/172)) ([988cf09](https://github.com/shoraLBRT/dota-lore-map/commit/988cf09b25f5d9aad0b1f7bdfcf79bad8d6bada1))
* **map:** fit the world to the square raster art with two continents ([#166](https://github.com/shoraLBRT/dota-lore-map/issues/166)) ([e39403d](https://github.com/shoraLBRT/dota-lore-map/commit/e39403d0847ea68da8f23621a5959df5aaa5de23))
* **map:** redraw hero path threads with tapered ribbon, caravan variant and step-by-step drawing ([#175](https://github.com/shoraLBRT/dota-lore-map/issues/175)) ([5ed9241](https://github.com/shoraLBRT/dota-lore-map/commit/5ed92416649c92d0b9e1e4672574ef9db24c7c84))
* **ui:** smooth interface motion with shared curves, cascades and inertia ([#173](https://github.com/shoraLBRT/dota-lore-map/issues/173)) ([c701259](https://github.com/shoraLBRT/dota-lore-map/commit/c701259b7935ce796a55c96a05a3e109ea94be61))
* **world:** add side legend and shrink thread marks on the phone ([#137](https://github.com/shoraLBRT/dota-lore-map/issues/137)) ([0bc0afd](https://github.com/shoraLBRT/dota-lore-map/commit/0bc0afd19de0ffb7e6f088db826b2f984a05176b))


### Bug Fixes

* **content:** reconcile hero names in place texts with hero-place links ([#162](https://github.com/shoraLBRT/dota-lore-map/issues/162)) ([bc05afd](https://github.com/shoraLBRT/dota-lore-map/commit/bc05afded5ca7b91b026f8ab1661d3bc7d29880a))
* **content:** resolve one-sided hero relations from earlier E14 batches ([#153](https://github.com/shoraLBRT/dota-lore-map/issues/153)) ([b343e5c](https://github.com/shoraLBRT/dota-lore-map/commit/b343e5c78fb4a123086553b8f2e369f1bc50dfb6))
* **links:** retry CDN 503 with ranged GET and backoff ([#140](https://github.com/shoraLBRT/dota-lore-map/issues/140)) ([f840c02](https://github.com/shoraLBRT/dota-lore-map/commit/f840c02f46a25b6277bcd56ec16c73d817d50819))
* **world:** place the region tooltip beside the region instead of over it ([#135](https://github.com/shoraLBRT/dota-lore-map/issues/135)) ([0ec09a3](https://github.com/shoraLBRT/dota-lore-map/commit/0ec09a393683eab922643c625a067182425d0c94))

## [0.3.0](https://github.com/shoraLBRT/dota-lore-map/compare/v0.2.0...v0.3.0) (2026-11-17)


### Features

* **content:** add official media for regions: Crownfall trailers, event and Artifact art ([#133](https://github.com/shoraLBRT/dota-lore-map/issues/133)) ([9ffc251](https://github.com/shoraLBRT/dota-lore-map/commit/9ffc251acf7bcf69b87a4180bb101a67da9a6c7b))

## [0.2.0](https://github.com/shoraLBRT/dota-lore-map/compare/v0.1.0...v0.2.0) (2026-11-17)


### Features

* **app:** show an error screen instead of a blank page ([#131](https://github.com/shoraLBRT/dota-lore-map/issues/131)) ([f0c2a3d](https://github.com/shoraLBRT/dota-lore-map/commit/f0c2a3d04bfaa2a3ca7019d538424dd005b2e86a))
* **hero:** show hero places right under the summary and rename the close button ([#124](https://github.com/shoraLBRT/dota-lore-map/issues/124)) ([99a9511](https://github.com/shoraLBRT/dota-lore-map/commit/99a9511f9157bf2686c496fe1f804d4ae51c59c5))
* **region:** list places in the region panel ([#128](https://github.com/shoraLBRT/dota-lore-map/issues/128)) ([bc84919](https://github.com/shoraLBRT/dota-lore-map/commit/bc849190de2c30e86c6e161a47d795ad95120400))
* **search:** find regions and places, not only heroes ([#130](https://github.com/shoraLBRT/dota-lore-map/issues/130)) ([1907e5e](https://github.com/shoraLBRT/dota-lore-map/commit/1907e5e7a143037d5794330cfdbcc6f8ee11d715))
* **world:** fit the whole world left of the open hero profile ([#126](https://github.com/shoraLBRT/dota-lore-map/issues/126)) ([c14e4a5](https://github.com/shoraLBRT/dota-lore-map/commit/c14e4a5985c407fdb8fb1261f59b2dfc8e16520a))


### Bug Fixes

* **world:** draw the open region frame in its side or tier tone ([#122](https://github.com/shoraLBRT/dota-lore-map/issues/122)) ([4c70f23](https://github.com/shoraLBRT/dota-lore-map/commit/4c70f23c1d4b8167e81dc77cefc610c2f27a125f))
* **world:** keep place labels in frame and make the selected place stand out ([#125](https://github.com/shoraLBRT/dota-lore-map/issues/125)) ([7628011](https://github.com/shoraLBRT/dota-lore-map/commit/762801161afed0ee3cd21a07dc9248825269bc48))
* **world:** put marker labels on a dark plate readable on any background ([#127](https://github.com/shoraLBRT/dota-lore-map/issues/127)) ([285ef9b](https://github.com/shoraLBRT/dota-lore-map/commit/285ef9b2bd42bfeccc861744752ff2eb0cb40d8e))
