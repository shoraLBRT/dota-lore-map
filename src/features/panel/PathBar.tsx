import type { Screen } from '../../app/router';
import type { Place, Region } from '../../data/types';
import { placeName } from '../../data/world';
import { useT } from '../../i18n';
import styles from './PathBar.module.css';

interface Props {
  region?: Region;
  place?: Place;
  /** Открыт профиль героя — последнее звено. */
  heroName?: string;
  /** Перейти на звено пути (кроме последнего — где мы сейчас). */
  onGo: (screen: Screen) => void;
  /** Нижний край строки — метки «нить за краем» встают под неё (`coverTop` карты). */
  measureRef?: (el: HTMLElement | null) => void;
}

/**
 * Строка пути вверху карты (#230, Н1, Н10; SPEC §5.1 «Правила окон»): «Мир › Регион › Место › Герой»,
 * каждое звено, кроме текущего, ведёт туда. Одно место для «назад» на всех экранах: крошек в шапках панелей нет.
 * Кнопка «Мир» — всегда первая, одного вида и в одном и том же месте: левый верхний угол карты (на телефоне — под
 * верхней полосой, над шторкой), отдельно от окна. Строка в одну линию: длинные названия обрезаются, а не
 * переносятся, — высота и место кнопки не меняются.
 */
export function PathBar({ region, place, heroName, onGo, measureRef }: Props) {
  const { l, lang, t } = useT();
  const steps: { label: string; screen?: Screen }[] = [{ label: t('panel.world'), screen: { name: 'world' } }];
  if (region) steps.push({ label: l(region.name), screen: { name: 'region', regionId: region.id } });
  if (region && place) steps.push({ label: placeName(place, lang), screen: { name: 'place', regionId: region.id, placeSlug: place.slug } });
  if (heroName) steps.push({ label: heroName });
  return (
    <nav ref={measureRef} className={styles.path} aria-label={t('panel.path')} data-testid="path-bar">
      <ol className={styles.list}>
        {steps.map((s, i) => {
          const target = s.screen;
          return (
            <li key={s.label} className={[styles.step, i === 0 && styles.home].filter(Boolean).join(' ')}>
              {i === steps.length - 1 || !target ? (
                <span className={styles.current} aria-current="location">
                  {s.label}
                </span>
              ) : (
                <button type="button" className={styles.link} onClick={() => onGo(target)}>
                  {s.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
