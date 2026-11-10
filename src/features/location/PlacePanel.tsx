import { useNavigation } from '../../app/navigation';
import { DiamondButton } from '../../components/DiamondButton';
import { Divider } from '../../components/Divider';
import { HeroList } from '../../components/HeroList';
import { Paragraphs } from '../../components/Paragraphs';
import type { Place, Region } from '../../data/types';
import { heroesOfPlace, placeName } from '../../data/world';
import { useT } from '../../i18n';
import { Panel, panelStyles } from '../panel/Panel';

export function PlacePanel({ region, place }: { region: Region; place: Place }) {
  const { l, lang, t } = useT();
  const { open } = useNavigation();
  const name = placeName(place, lang);

  return (
    <Panel label={name}>
      <h2>{name}</h2>
      {place.text?.type && <p className={panelStyles.type}>{l(place.text.type)}</p>}
      <Divider />
      <HeroList heroes={heroesOfPlace(region.id, place.slug)} />
      {place.text?.description && <Paragraphs text={l(place.text.description)} />}
      <Divider />
      <DiamondButton
        icon="back"
        label={t('panel.backTo', { name: l(region.name) })}
        className={panelStyles.back}
        onClick={() => open({ name: 'region', regionId: region.id })}
      >
        {l(region.name)}
      </DiamondButton>
    </Panel>
  );
}
