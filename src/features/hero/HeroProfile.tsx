import { useId, useMemo, useState } from 'react';
import { useNavigation } from '../../app/navigation';
import { serializeRoute } from '../../app/router';
import { DiamondButton } from '../../components/DiamondButton';
import { EventIcon } from '../../components/EventIcon';
import { HeroPortrait } from '../../components/HeroPortrait';
import { Paragraphs } from '../../components/Paragraphs';
import type { Hero } from '../../data/types';
import { getPlace, getRegion, heroCrop, heroUrl, placeName } from '../../data/world';
import { useT } from '../../i18n';
import { heroBlock } from '../feedback/context';
import { FeedbackLink } from '../feedback/FeedbackLink';
import crumbStyles from '../panel/Blocks.module.css';
import { MediaCards } from '../panel/MediaCards';
import { useHeroPreview } from '../search/preview';
import { spotName, spotScreen, type Spot } from '../search/search';
import type { HeroThreads, StepKind } from '../search/threads';
import styles from './HeroProfile.module.css';
import { heroMedia, heroRelations, profilePlaces } from './profile';

interface Props {
  hero: Hero;
  spots: Spot[];
  /** Нити героя на карте (#67); есть — под местами легенда «как читать нити». */
  threads?: HeroThreads;
  /** Открыть профиль другого героя (связи): камера остаётся, карта показывает, где он. */
  onPick: (hero: Hero) => void;
}

/**
 * Профиль героя в правой панели, на телефоне — в шторке (E15, SPEC §6.8): шапка-арт, имя, ссылка на dota2.com,
 * описание, места по порядку пути с легендой нитей, арты (галерея), «Связан с», строка «Нашли ошибку?» (§6.9). Пустые блоки не рисуются — партии E14 идут постепенно.
 */
export function HeroProfile({ hero, spots, threads, onPick }: Props) {
  const { l, lang, t } = useT();
  const { route, open, navigate } = useNavigation();
  const preview = useHeroPreview();
  const [headerFailed, setHeaderFailed] = useState<string | null>(null);
  const media = useMemo(() => heroMedia(hero), [hero]);
  const relations = useMemo(() => heroRelations(hero), [hero]);
  const places = useMemo(() => profilePlaces(hero, spots), [hero, spots]);
  const here = serializeRoute({ screen: route.screen });
  const summary = hero.profile?.summary;

  return (
    <>
      {headerFailed !== hero.key ? (
        <img className={styles.header} src={heroCrop(hero)} alt="" onError={() => setHeaderFailed(hero.key)} />
      ) : (
        <HeroPortrait hero={hero} link={false} className={styles.fallbackPortrait} />
      )}
      <h2 tabIndex={-1} data-panel-heading>
        {hero.name}
      </h2>
      <a
        className={styles.official}
        href={heroUrl(hero, lang)}
        target="_blank"
        rel="noopener noreferrer"
        // Имя ссылки начинается с видимого текста (WCAG 2.5.3 «Label in Name»).
        aria-label={t('hero.badgeLink', { name: hero.name })}
      >
        dota2.com ↗
      </a>
      {summary && <Paragraphs text={l(summary)} />}
      {places.length > 0 && (
        <nav aria-labelledby={`${hero.key}-places`}>
          <h3 id={`${hero.key}-places`}>{t('hero.places')}</h3>
          <ol className={styles.places}>
            {places.map(({ spot, onPath }) => {
              const screen = spotScreen(spot);
              const current = serializeRoute({ screen }) === here;
              const region = regionLine(spot, lang);
              return (
                <li key={spot.key}>
                  <button
                    type="button"
                    className={[styles.place, styles[spot.tone], !onPath && styles.offPath].filter(Boolean).join(' ')}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => open(screen)}
                  >
                    <span className={styles.placeIcon} aria-hidden="true">
                      <EventIcon event={spot.event} />
                    </span>
                    <span className={styles.placeText}>
                      <span className={styles.placeName}>{spotName(spot, lang)}</span>
                      <span className={styles.placeMeta}>
                        {t(`hero.event.${spot.event}`)}
                        {region && ` · ${region}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <Legend spots={spots} threads={threads} />
      <MediaCards title={t('hero.arts')} media={media} onOpen={(id) => navigate({ ...route, media: id })} />
      {relations.length > 0 && (
        <section>
          <h3>{t('hero.relations')}</h3>
          <ul className={styles.relations}>
            {relations.map(({ hero: other, type }) => (
              <li
                key={`${other.key}/${type}`}
                onPointerEnter={() => preview(other)}
                onPointerLeave={(e) => e.pointerType !== 'touch' && preview(null)}
                onFocus={() => preview(other)}
                onBlur={() => preview(null)}
              >
                <button
                  type="button"
                  className={styles.relation}
                  onClick={() => onPick(other)}
                  aria-label={t('hero.openRelation', { name: other.name, type: t(`hero.relation.${type}`) })}
                >
                  <HeroPortrait hero={other} link={false} className={styles.relationPortrait} />
                  <span className={styles.relationText}>
                    <span className={styles.relationName}>{other.name}</span>
                    <span className={styles.relationType}>{t(`hero.relation.${type}`)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <FeedbackLink block={heroBlock(hero)} />
    </>
  );
}

/** Регион места второй строкой; у связи с регионом целиком — нет (название уже регион). */
function regionLine(spot: Spot, lang: 'ru' | 'en'): string | undefined {
  if (!spot.placeSlug) return undefined;
  const region = getRegion(spot.regionId);
  const place = getPlace(spot.regionId, spot.placeSlug);
  if (!region || !place) return undefined;
  const name = region.name[lang];
  return name === placeName(place, lang) ? undefined : name;
}

/** Раскрывающаяся легенда «как читать нити» (#67): виды линий и события, которые есть у этого героя. */
function Legend({ spots, threads }: { spots: Spot[]; threads?: HeroThreads }) {
  const { t } = useT();
  const [legendOpen, setLegendOpen] = useState(false);
  const legendId = useId();
  const steps = threads?.steps ?? [];
  if (steps.length === 0) return null;
  const kinds = new Set(steps.map((s) => s.kind));
  const events = [...new Set(spots.map((s) => s.event))];
  return (
    <div className={styles.legend}>
      <button
        type="button"
        className={styles.legendToggle}
        aria-expanded={legendOpen}
        aria-controls={legendId}
        onClick={() => setLegendOpen((v) => !v)}
      >
        {t('hero.legend')}
        <span aria-hidden="true">{legendOpen ? ' ▴' : ' ▾'}</span>
      </button>
      <ul id={legendId} className={styles.legendList} hidden={!legendOpen}>
        {kinds.has('path') && (
          <li>
            <LineSample kind="path" />
            {t('hero.legendPath')}
          </li>
        )}
        {kinds.has('aside') && (
          <li>
            <LineSample kind="aside" />
            {t('hero.legendAside')}
          </li>
        )}
        {events.map((e) => (
          <li key={e}>
            <EventIcon event={e} className={styles.legendIcon} />
            {t(`hero.event.${e}`)}
          </li>
        ))}
        <li className={styles.legendNote}>{t('hero.legendColor')}</li>
      </ul>
    </div>
  );
}

/** Образец линии для легенды: сплошная со стрелкой — путь, пунктир — прочая связь. */
function LineSample({ kind }: { kind: StepKind }) {
  return (
    <svg className={styles.legendLine} viewBox="0 0 28 12" width="28" height="12" aria-hidden="true" focusable="false">
      <path d="M2 6h22" strokeDasharray={kind === 'aside' ? '4 3' : undefined} />
      {kind === 'path' && <path className={styles.legendArrow} d="M15 2.5 21 6l-6 3.5Z" />}
    </svg>
  );
}

/**
 * Кнопка в шапке профиля (SPEC §6.4, §6.8): «‹ Закрыть профиль» — закрывает профиль и возвращает панель
 * экрана под ним, герой остаётся выбранным; то же делают Esc и «назад» браузера (A11).
 */
export function ProfileCrumb({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const text = t('hero.close');
  return (
    <nav className={crumbStyles.crumbs} aria-label={t('panel.breadcrumbs')}>
      <DiamondButton icon="back" label={text} onClick={onClose}>
        {text}
      </DiamondButton>
    </nav>
  );
}
