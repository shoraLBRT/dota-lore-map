import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '../../app/navigation';
import { serializeRoute, type Screen } from '../../app/router';
import type { Hero } from '../../data/types';
import { getHero, getPlace, getRegion, placeName, world } from '../../data/world';
import { useT } from '../../i18n';
import { PlacePanel } from '../location/PlacePanel';
import { Panel } from '../panel/Panel';
import { Rail } from '../rail/Rail';
import { RegionPanel } from '../region/RegionPanel';
import barStyles from '../search/HeroBar.module.css';
import { HeroBadge } from '../search/HeroBadge';
import { HeroSearch } from '../search/HeroSearch';
import { HeroPreviewProvider } from '../search/preview';
import { heroScreen, heroSpots, spotScreen } from '../search/search';
import { MapStage } from './MapStage';
import styles from './WorldScreen.module.css';

interface Props {
  screen: Screen;
  /** Под интро: карта размыта и чуть приближена (A1 проявляет её), экран недоступен для мыши и клавиатуры. */
  veiled?: boolean;
}

/** Экраны «Мир», «Регион», «Место»: левая панель, карта, правая панель. Неизвестный регион или место — уровень выше. */
export function WorldScreen({ screen, veiled = false }: Props) {
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
  // Свёрнутая панель снова раскрывается при смене региона или места: иначе клик по маркеру «ничего не делает».
  const [fold, setFold] = useState<{ key: string; collapsed: boolean }>({ key: screenKey, collapsed: false });
  const collapsed = fold.key === screenKey && fold.collapsed;

  // Поиск и выбранный герой (SPEC §6.5): `?hero=` в адресе, плашка сверху, приглушение, нити.
  const [searchOpen, setSearchOpen] = useState(false);
  const hero = route.hero ? getHero(route.hero) : undefined;
  const spots = useMemo(() => (hero ? heroSpots(hero) : undefined), [hero]);
  // Нити по наведению на портрет в панели (SPEC §6.6) живут, пока не сменился экран.
  const [preview, setPreview] = useState<{ key: string; hero: Hero } | null>(null);
  const previewHero = preview?.key === screenKey ? preview.hero : null;
  const previewSpots = useMemo(() => (previewHero ? heroSpots(previewHero) : undefined), [previewHero]);
  const onPreview = useCallback((h: Hero | null) => setPreview(h ? { key: screenKey, hero: h } : null), [screenKey]);
  const showPreview = previewSpots !== undefined && previewSpots.length > 1;
  const threads = showPreview ? previewSpots : spots && spots.length > 1 ? spots : undefined;
  const threadsKey = showPreview ? `preview/${previewHero!.key}` : hero?.key;

  const pick = (h: Hero) => {
    setSearchOpen(false);
    navigate({ screen: heroScreen(h), hero: h.key });
  };
  const clearHero = () => navigate({ screen: route.screen });

  return (
    <div
      ref={rootRef}
      className={[styles.screen, veiled && styles.veiled].filter(Boolean).join(' ')}
      aria-hidden={veiled ? 'true' : undefined}
      data-testid="world-screen"
    >
      <h1 className="visually-hidden">{t('app.title')}</h1>
      <Rail className={styles.rail} onSearch={() => setSearchOpen(true)} searchOpen={searchOpen} />
      <div className={styles.body}>
        <main className={styles.map}>
          <MapStage
            regions={world.regions}
            activeRegionId={region?.id}
            activePlaceSlug={place?.slug}
            onSelectRegion={(id) => open({ name: 'region', regionId: id })}
            onSelectPlace={(id, slug) => open({ name: 'place', regionId: id, placeSlug: slug })}
            panel={Boolean(region)}
            onCameraBusy={hold}
            focus={spots}
            threads={threads}
            threadsKey={threadsKey}
            onSelectSpot={(s) => open(spotScreen(s))}
          />
        </main>
        {!veiled && (searchOpen || (hero && spots)) && (
          <div className={[barStyles.bar, region && !collapsed && barStyles.withPanel].filter(Boolean).join(' ')}>
            {searchOpen ? (
              <HeroSearch onPick={pick} onClose={() => setSearchOpen(false)} />
            ) : (
              hero && spots && <HeroBadge hero={hero} spots={spots} onClear={clearHero} />
            )}
          </div>
        )}
        {region && (
          <Panel
            label={place ? placeName(place, lang) : l(region.name)}
            collapsed={collapsed}
            onToggle={() => setFold({ key: screenKey, collapsed: !collapsed })}
            contentKey={screenKey}
          >
            <HeroPreviewProvider value={onPreview}>
              {place ? <PlacePanel region={region} place={place} /> : <RegionPanel region={region} />}
            </HeroPreviewProvider>
          </Panel>
        )}
      </div>
    </div>
  );
}
