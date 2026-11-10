import { useNavigation } from '../../app/navigation';
import { serializeRoute } from '../../app/router';
import { DiamondButton } from '../../components/DiamondButton';
import { Divider } from '../../components/Divider';
import { HeroList } from '../../components/HeroList';
import { Paragraphs } from '../../components/Paragraphs';
import type { Region } from '../../data/types';
import { heroesOfRegion, placeName } from '../../data/world';
import { useT } from '../../i18n';
import { Panel, panelStyles } from '../panel/Panel';

export function RegionPanel({ region }: { region: Region }) {
  const { l, lang, t } = useT();
  const { route, open } = useNavigation();
  const name = l(region.name);

  return (
    <Panel label={name}>
      <h2>{name}</h2>
      {region.subtitle && <p className={panelStyles.subtitle}>{l(region.subtitle)}</p>}
      <Divider />
      <HeroList heroes={heroesOfRegion(region.id)} />
      {region.description && <Paragraphs text={l(region.description)} />}
      {region.places.length > 0 && (
        <section>
          <Divider />
          <h3>{t('panel.places')}</h3>
          <ul>
            {region.places.map((p) => (
              <li key={p.slug}>
                <a
                  href={serializeRoute({
                    screen: { name: 'place', regionId: region.id, placeSlug: p.slug },
                    hero: route.hero,
                  })}
                >
                  {placeName(p, lang)}
                </a>
                {p.capital && ` (${t('panel.capital')})`}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Divider />
      <DiamondButton
        icon="back"
        label={t('panel.backToWorld')}
        className={panelStyles.back}
        onClick={() => open({ name: 'world' })}
      >
        {t('panel.world')}
      </DiamondButton>
    </Panel>
  );
}
