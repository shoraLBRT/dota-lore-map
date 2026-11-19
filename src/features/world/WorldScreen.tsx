import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '../../app/media';
import { useNavigation } from '../../app/navigation';
import { useSfx } from '../../app/sound';
import { parseHash, serializeRoute, type Screen } from '../../app/router';
import type { Hero } from '../../data/types';
import { getHero, getPlace, getRegion, placeName, world } from '../../data/world';
import { useT } from '../../i18n';
import { HeroChip } from '../hero/HeroChip';
import { HeroProfile, HeroSearch } from '../../app/deferred';
import { ProfileCrumb } from '../hero/ProfileCrumb';
import { PlacePanel } from '../location/PlacePanel';
import { Breadcrumbs } from '../panel/Breadcrumbs';
import { Panel } from '../panel/Panel';
import { Rail } from '../rail/Rail';
import { RegionPanel } from '../region/RegionPanel';
import barStyles from '../search/HeroBar.module.css';
import { HeroPickProvider, HeroPreviewProvider } from '../search/preview';
import { heroScreen, heroSpots, spotScreen } from '../search/search';
import { heroThreads } from '../search/threads';
import { MOBILE_QUERY } from './camera';
import { focusLost, restoreFocus } from './focus';
import { MapStage } from './MapStage';
import { SideLegend } from './SideLegend';
import { useWorldHint, WorldHint } from './WorldHint';
import styles from './WorldScreen.module.css';

/** Зазор между чипом героя и картой со списком регионов на телефоне, px. */
const BAR_GAP = 8;

interface Props {
  screen: Screen;
  /** Под интро: карта размыта и чуть приближена (A1 проявляет её), экран недоступен для мыши и клавиатуры. */
  veiled?: boolean;
  /** Идёт A1: арт проясняется, подписи регионов проявляются каскадом после него (#187). */
  unveiling?: boolean;
}

/** Экраны «Мир», «Регион», «Место»: левая панель, карта, правая панель. Неизвестный регион или место — уровень выше. */
export function WorldScreen({ screen, veiled = false, unveiling = false }: Props) {
  const { l, lang, t } = useT();
  const { route, open, hold, navigate } = useNavigation();
  const rootRef = useRef<HTMLDivElement>(null);

  // React 18 не знает атрибут inert — ставим свойство DOM напрямую.
  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = veiled;
  }, [veiled]);

  const regionId = screen.name === 'region' || screen.name === 'place' ? screen.regionId : undefined;
  const region = regionId ? getRegion(regionId) : undefined;
  const place = region && screen.name === 'place' ? getPlace(region.id, screen.placeSlug) : undefined;
  const screenKey = serializeRoute({ screen });
  const hero = route.hero ? getHero(route.hero) : undefined;
  // Профиль героя (E15, SPEC §6.8, A15) открыт флагом `profile` в адресе: панель показывает его поверх панели экрана.
  // Без флага герой только выбран — подсветка, нити и плашка-чип сверху, а в панели регион или место.
  // Переход на другой экран (`open`) флаг снимает: видна панель того места, куда пришли, герой остаётся.
  const profileOpen = Boolean(hero && route.profile);
  const panelKey = profileOpen ? `hero/${hero!.key}` : screenKey;
  // Свёрнутая панель снова раскрывается при смене региона, места или героя: иначе клик «ничего не делает».
  const [fold, setFold] = useState<{ key: string; collapsed: boolean }>({ key: panelKey, collapsed: false });
  const collapsed = fold.key === panelKey && fold.collapsed;

  // Клавиатура (SPEC §14): если при переходе фокус пропал вместе с элементом, ставим его на заголовок
  // панели или туда, откуда пришли (ARCHITECTURE A14). Экраны — по ключу адреса, а не по объекту.
  // Регион открыт из списка под картой (телефон, #39): назад в мир — фокус на тот же пункт списка.
  const listOrigin = useRef<string | null>(null);
  const prevKey = useRef(screenKey);
  useEffect(() => {
    const prev = prevKey.current;
    prevKey.current = screenKey;
    if (veiled || !rootRef.current || prev === screenKey) return;
    restoreFocus(rootRef.current, parseHash(prev).screen, parseHash(screenKey).screen, {
      listRegionId: listOrigin.current,
    });
  }, [screenKey, veiled]);

  // Профиль открыт или сменился герой: фокус — на имя героя (заголовок панели), как при переходе вниз;
  // профиль закрыт — если фокус пропал вместе с ним: на заголовок панели экрана, а в мире — на чип героя (A14, SPEC §6.8).
  const profileKey = profileOpen ? hero!.key : null;
  const prevProfile = useRef(profileKey);
  useEffect(() => {
    const prev = prevProfile.current;
    prevProfile.current = profileKey;
    if (veiled || !rootRef.current || prev === profileKey) return;
    if (!profileKey && !focusLost(document.activeElement)) return;
    const target =
      rootRef.current.querySelector<HTMLElement>('[data-panel-heading]') ??
      rootRef.current.querySelector<HTMLElement>('[data-hero-chip]');
    target?.focus({ preventScroll: true });
  }, [profileKey, veiled]);

  // Звук открытия панели (SPEC §7.4): из мира в регион или место, открытие профиля; переходы внутри панели — без него.
  const sfx = useSfx();
  const panelOpen = (Boolean(region) || profileOpen) && !veiled;
  useEffect(() => {
    if (panelOpen) sfx('panel');
  }, [panelOpen, sfx]);

  // Поиск и выбранный герой (SPEC §6.5): `?hero=` в адресе, профиль или чип сверху, приглушение, нити.
  const [searchOpen, setSearchOpen] = useState(false);
  const spots = useMemo(() => (hero ? heroSpots(hero) : undefined), [hero]);
  // Герой под наведением или фокусом — портрет в панели или вариант поиска (SPEC §6.6, #66): нити, если мест
  // несколько, и всегда — где он на карте. Живёт, пока не сменился экран.
  const [preview, setPreview] = useState<{ key: string; hero: Hero } | null>(null);
  // Вариант поиска — отдельно: закрытый поиск не должен снимать портрет, на который ушёл фокус.
  const [searchPreview, setSearchPreview] = useState<Hero | null>(null);
  const previewHero = searchOpen && searchPreview ? searchPreview : preview?.key === screenKey ? preview.hero : null;
  const previewSpots = useMemo(() => (previewHero ? heroSpots(previewHero) : undefined), [previewHero]);
  // Строка места в панели региона под наведением или фокусом (#99): маркер подсвечен. Живёт, пока не сменился экран.
  const [placeLit, setPlaceLit] = useState<{ key: string; slug: string } | null>(null);
  const litPlace = placeLit?.key === screenKey ? placeLit.slug : undefined;
  const onPreviewPlace = useCallback((slug: string | null) => setPlaceLit(slug ? { key: screenKey, slug } : null), [screenKey]);
  const onPreview = useCallback((h: Hero | null) => setPreview(h ? { key: screenKey, hero: h } : null), [screenKey]);
  // Нити (#67): шаги пути и прочие связи; наведение важнее выбора.
  const heroLines = useMemo(() => (hero && spots ? heroThreads(hero, spots) : undefined), [hero, spots]);
  const previewLines = useMemo(
    () => (previewHero && previewSpots ? heroThreads(previewHero, previewSpots) : undefined),
    [previewHero, previewSpots],
  );
  const threads = previewLines ?? heroLines;
  const threadsKey = previewLines ? `preview/${previewHero!.key}` : hero?.key;

  // Подсказка «выберите регион» при первом входе: гаснет от первого наведения, фокуса или нажатия на регион,
  // а также если пользователь уже ушёл из мира (тап на телефоне сразу открывает регион).
  const hint = useWorldHint();
  const { dismiss: dismissHint } = hint;
  const inRegion = Boolean(region) && !veiled;
  useEffect(() => {
    if (inRegion) dismissHint();
  }, [inRegion, dismissHint]);
  const onMapEvent = (e: { target: EventTarget }) => {
    if (e.target instanceof Element && e.target.closest('[data-region]')) dismissHint();
  };
  // Телефон (#39): в мире под картой список регионов — он сам и есть подсказка, строка внизу кадра не нужна.
  const mobile = useMediaQuery(MOBILE_QUERY);
  const showHint = !veiled && screen.name === 'world' && !searchOpen && !hero && !mobile;
  // Легенда сторон (#102): в мире на широком экране; не под интро и не при открытом профиле.
  const showLegend = !veiled && screen.name === 'world' && !profileOpen && !mobile;

  // Поле поиска или чип героя сверху кадра: метки «нить за краем» встают под них (#64),
  // на телефоне карта со списком регионов — под чип.
  const [barBottom, setBarBottom] = useState(0);
  const barObserver = useRef<ResizeObserver | null>(null);
  const barRef = useCallback((el: HTMLDivElement | null) => {
    barObserver.current?.disconnect();
    barObserver.current = null;
    if (!el) {
      setBarBottom(0);
      return;
    }
    const measure = () => setBarBottom(el.offsetTop + el.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    barObserver.current = new ResizeObserver(measure);
    barObserver.current.observe(el);
  }, []);

  const showChip = !veiled && !searchOpen && Boolean(hero) && !profileOpen;
  const topInset = mobile && showChip && barBottom > 0 ? barBottom + BAR_GAP : 0;

  const pick = (h: Hero) => {
    setSearchOpen(false);
    navigate({ screen: heroScreen(h), hero: h.key, profile: true });
  };
  const clearHero = () => navigate({ screen: route.screen });
  // Закрыть профиль, оставив героя выбранным (крошка, Esc); открыть снова — чип.
  const closeProfile = () => hero && navigate({ screen: route.screen, hero: hero.key });
  const openProfile = () => hero && navigate({ screen: route.screen, hero: hero.key, profile: true });
  // Портрет героя где угодно — в подсказке региона (#65), в панели региона или места, в «Связан с» профиля —
  // открывает его профиль (E15, SPEC §6.8). Камера остаётся: из мира не приближается, в регионе и месте
  // герой виден подсветкой и нитями с метками «за краем».
  const pickHere = (h: Hero) => {
    setSearchOpen(false);
    navigate({ screen: route.screen, hero: h.key, profile: true });
  };

  // Значок медиа на карте (#69): галерея на экране, которому медиа принадлежит, — места или региона (A5);
  // герой остаётся выбранным, как при открытии из панели.
  const openMedia = (regionId: string, target: { mediaId: string; placeSlug?: string }) => {
    setSearchOpen(false);
    const next: Screen = target.placeSlug
      ? { name: 'place', regionId, placeSlug: target.placeSlug }
      : { name: 'region', regionId };
    navigate(route.hero ? { screen: next, hero: route.hero, media: target.mediaId } : { screen: next, media: target.mediaId });
  };

  return (
    <div
      ref={rootRef}
      className={[styles.screen, veiled && styles.veiled, unveiling && styles.unveiling].filter(Boolean).join(' ')}
      aria-hidden={veiled ? 'true' : undefined}
      data-testid="world-screen"
    >
      <h1 className="visually-hidden">{t('app.title')}</h1>
      <Rail className={styles.rail} onSearch={() => setSearchOpen(true)} searchOpen={searchOpen} />
      <div className={styles.body}>
        <main className={styles.map} onPointerOver={onMapEvent} onFocus={onMapEvent} onPointerDown={onMapEvent}>
          <MapStage
            deferArt={veiled}
            regions={world.regions}
            activeRegionId={region?.id}
            activePlaceSlug={place?.slug}
            onSelectRegion={(id, source) => {
              // Клик по пустому месту карты в месте (S3 → S2) источника не передаёт — origin не трогаем.
              if (source) listOrigin.current = source === 'list' ? id : null;
              open({ name: 'region', regionId: id });
            }}
            onSelectPlace={(id, slug) => open({ name: 'place', regionId: id, placeSlug: slug })}
            // Свёрнутый профиль в мире кадр не закрывает: карта снова на весь кадр (#97).
            panel={Boolean(region) || (profileOpen && !collapsed)}
            onCameraBusy={hold}
            focus={spots}
            threads={threads}
            threadsKey={threadsKey}
            preview={previewSpots}
            litPlace={litPlace}
            onPickHero={pickHere}
            onSelectSpot={(s) => open(spotScreen(s))}
            onOpenMedia={openMedia}
            regionList={mobile}
            topInset={topInset}
            coverTop={barBottom}
          />
        </main>
        {showHint && <WorldHint state={hint.state} />}
        {showLegend && <SideLegend />}
        {!veiled && (searchOpen || showChip) && (
          <div
            ref={barRef}
            className={[barStyles.bar, showChip && barStyles.chipBar, (region || profileOpen) && !collapsed && barStyles.withPanel]
              .filter(Boolean)
              .join(' ')}
          >
            {searchOpen ? (
              <HeroSearch
                onPick={pick}
                onOpen={(screen) => {
                  setSearchOpen(false);
                  open(screen);
                }}
                onClose={() => setSearchOpen(false)}
                onPreview={setSearchPreview}
              />
            ) : (
              hero && <HeroChip hero={hero} onOpen={openProfile} onClear={clearHero} />
            )}
          </div>
        )}
        {(profileOpen || region) && (
          <Panel
            label={profileOpen ? hero!.name : place ? placeName(place, lang) : l(region!.name)}
            collapsed={collapsed}
            onToggle={() => setFold({ key: panelKey, collapsed: !collapsed })}
            contentKey={panelKey}
            back={profileOpen ? <ProfileCrumb onClose={closeProfile} /> : <Breadcrumbs region={region!} place={place} />}
          >
            <HeroPreviewProvider value={onPreview}>
              <HeroPickProvider value={pickHere}>
                {profileOpen && hero && spots ? (
                  <HeroProfile hero={hero} spots={spots} threads={heroLines} onPick={pickHere} />
                ) : place ? (
                  <PlacePanel region={region!} place={place} />
                ) : (
                  <RegionPanel region={region!} onPreviewPlace={onPreviewPlace} />
                )}
              </HeroPickProvider>
            </HeroPreviewProvider>
          </Panel>
        )}
      </div>
    </div>
  );
}
