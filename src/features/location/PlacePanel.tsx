import { useNavigation } from '../../app/navigation';
import { Divider } from '../../components/Divider';
import { HeroList } from '../../components/HeroList';
import { Paragraphs } from '../../components/Paragraphs';
import type { Place, Region } from '../../data/types';
import { heroesOfPlace, placeName } from '../../data/world';
import { useT } from '../../i18n';
import { Breadcrumbs } from '../panel/Breadcrumbs';
import { useHeroPreview } from '../search/preview';
import { MediaCards } from '../panel/MediaCards';
import { panelStyles } from '../panel/Panel';

/**
 * Содержимое панели места S3 (SPEC §5.5): шапка-картинка (если есть арт), название, тип, герои,
 * описание, медиа, крошки «‹ Регион». Место без арта и медиа — только текст и герои.
 */
export function PlacePanel({ region, place }: { region: Region; place: Place }) {
  const { l, lang, t } = useT();
  const { route, open, navigate } = useNavigation();
  const preview = useHeroPreview();

  return (
    <>
      {place.art && <img className={panelStyles.header} src={place.art} alt="" />}
      <h2>{placeName(place, lang)}</h2>
      {place.text?.type && <p className={panelStyles.type}>{l(place.text.type)}</p>}
      <HeroList heroes={heroesOfPlace(region.id, place.slug)} onPreview={preview} />
      {place.text?.description && <Paragraphs text={l(place.text.description)} />}
      <MediaCards
        title={t('panel.placeMedia')}
        items={place.media}
        onOpen={(media) => navigate({ ...route, media })}
      />
      <Divider />
      <Breadcrumbs text={l(region.name)} onClick={() => open({ name: 'region', regionId: region.id })} />
    </>
  );
}
