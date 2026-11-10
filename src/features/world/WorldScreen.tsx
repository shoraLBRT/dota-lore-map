import { useNavigation } from '../../app/navigation';
import type { Screen } from '../../app/router';
import { LangSwitch } from '../../components/LangSwitch';
import { getPlace, getRegion, world } from '../../data/world';
import { useT } from '../../i18n';
import { PlacePanel } from '../location/PlacePanel';
import { RegionPanel } from '../region/RegionPanel';
import { MapStage } from './MapStage';
import styles from './WorldScreen.module.css';

/** Экраны «Мир», «Регион», «Место»: карта + правая панель. Неизвестный регион или место — уровень выше. */
export function WorldScreen({ screen }: { screen: Screen }) {
  const { t } = useT();
  const { open } = useNavigation();

  const regionId = screen.name === 'region' || screen.name === 'place' ? screen.regionId : undefined;
  const region = regionId ? getRegion(regionId) : undefined;
  const place = region && screen.name === 'place' ? getPlace(region.id, screen.placeSlug) : undefined;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <LangSwitch />
      </header>
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
