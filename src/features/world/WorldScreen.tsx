import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '../../app/navigation';
import { serializeRoute, type Screen } from '../../app/router';
import { getPlace, getRegion, placeName, world } from '../../data/world';
import { useT } from '../../i18n';
import { PlacePanel } from '../location/PlacePanel';
import { Panel } from '../panel/Panel';
import { Rail } from '../rail/Rail';
import { RegionPanel } from '../region/RegionPanel';
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
  const { open, hold } = useNavigation();
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

  return (
    <div
      ref={rootRef}
      className={[styles.screen, veiled && styles.veiled].filter(Boolean).join(' ')}
      aria-hidden={veiled ? 'true' : undefined}
      data-testid="world-screen"
    >
      <h1 className="visually-hidden">{t('app.title')}</h1>
      <Rail className={styles.rail} />
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
          />
        </main>
        {region && (
          <Panel
            label={place ? placeName(place, lang) : l(region.name)}
            collapsed={collapsed}
            onToggle={() => setFold({ key: screenKey, collapsed: !collapsed })}
            contentKey={screenKey}
          >
            {place ? <PlacePanel region={region} place={place} /> : <RegionPanel region={region} />}
          </Panel>
        )}
      </div>
    </div>
  );
}
