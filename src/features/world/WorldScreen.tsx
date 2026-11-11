import { useEffect, useRef } from 'react';
import { useNavigation } from '../../app/navigation';
import type { Screen } from '../../app/router';
import { getPlace, getRegion, world } from '../../data/world';
import { useT } from '../../i18n';
import { PlacePanel } from '../location/PlacePanel';
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
  const { t } = useT();
  const { open } = useNavigation();
  const rootRef = useRef<HTMLDivElement>(null);

  // React 18 не знает атрибут inert — ставим свойство DOM напрямую.
  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = veiled;
  }, [veiled]);

  const regionId = screen.name === 'region' || screen.name === 'place' ? screen.regionId : undefined;
  const region = regionId ? getRegion(regionId) : undefined;
  const place = region && screen.name === 'place' ? getPlace(region.id, screen.placeSlug) : undefined;

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
          />
        </main>
        {region && (place ? <PlacePanel region={region} place={place} /> : <RegionPanel region={region} />)}
      </div>
    </div>
  );
}
