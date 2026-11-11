import { useNavigation } from '../../app/navigation';
import { Divider } from '../../components/Divider';
import { HeroList } from '../../components/HeroList';
import { Paragraphs } from '../../components/Paragraphs';
import type { Region } from '../../data/types';
import { heroesOfRegion } from '../../data/world';
import { useT } from '../../i18n';
import { Breadcrumbs } from '../panel/Breadcrumbs';
import { useHeroPreview } from '../search/preview';
import { MediaCards } from '../panel/MediaCards';
import { panelStyles } from '../panel/Panel';
import { Traits } from '../panel/Traits';

/** Сколько портретов видно в панели региона до «+N» (SPEC §5.4 п. 2). */
export const REGION_HEROES = 12;

/**
 * Содержимое панели региона S2 (SPEC §5.4): название, подзаголовок, герои, разделитель,
 * характеристики 2×2, описание, «Подробнее ↗», медиа, крошки «‹ Мир». Пустые блоки не рисуются.
 */
export function RegionPanel({ region }: { region: Region }) {
  const { l, t } = useT();
  const { route, open, navigate } = useNavigation();
  const preview = useHeroPreview();

  return (
    <>
      <h2 tabIndex={-1} data-panel-heading>
        {l(region.name)}
      </h2>
      {region.subtitle && <p className={panelStyles.subtitle}>{l(region.subtitle)}</p>}
      <HeroList heroes={heroesOfRegion(region.id)} max={REGION_HEROES} onPreview={preview} />
      <Divider />
      <Traits region={region} />
      {region.description && <Paragraphs text={l(region.description)} />}
      {region.moreLink && (
        <a className={panelStyles.more} href={region.moreLink} target="_blank" rel="noopener noreferrer">
          {t('panel.more')}
        </a>
      )}
      <MediaCards
        title={t('panel.regionMedia')}
        items={region.media}
        onOpen={(media) => navigate({ ...route, media })}
      />
      <Divider />
      <Breadcrumbs text={t('panel.world')} onClick={() => open({ name: 'world' })} />
    </>
  );
}
