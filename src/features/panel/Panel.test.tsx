import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { NavigationProvider } from '../../app/navigation';
import type { Place, Region } from '../../data/types';
import { getRegion, heroesOfRegion, world } from '../../data/world';
import { I18nProvider } from '../../i18n';
import { PlacePanel } from '../location/PlacePanel';
import { REGION_HEROES, RegionPanel } from '../region/RegionPanel';
import { Breadcrumbs } from './Breadcrumbs';
import { Panel } from './Panel';

const bare: Region = {
  id: 'nowhere-land',
  tier: 'continent',
  side: 'dire',
  name: { ru: 'Пустошь', en: 'Waste' },
  geo: '',
  places: [],
  regionHeroes: [],
};

// Настоящие id из content/media.json; неизвестные id карточки пропускают.
const media = (n: number) => (world.media ?? []).slice(0, n).map((m) => m.id);

function wrap(node: React.ReactNode, lang: 'ru' | 'en' = 'ru') {
  return render(
    <I18nProvider initialLang={lang}>
      <NavigationProvider>{node}</NavigationProvider>
    </I18nProvider>,
  );
}

describe('панель региона (SPEC §5.4)', () => {
  it('реальный регион: заголовок, подзаголовок, герои, характеристики 2×2, описание', () => {
    const icewrack = getRegion('icewrack')!;
    wrap(<RegionPanel region={icewrack} />);
    expect(screen.getByRole('heading', { level: 2, name: icewrack.name.ru })).toBeInTheDocument();
    expect(screen.getByText(icewrack.subtitle!.ru)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /официальная страница/ })).toHaveLength(heroesOfRegion('icewrack').length);

    const terms = screen.getAllByRole('term').map((el) => el.textContent);
    expect(terms).toEqual(['Сторона', 'Власть', 'Магия', 'Среда']);
    expect(screen.getByText(icewrack.traits!.rule!.ru)).toBeInTheDocument();
    // Крошка «назад» — в шапке панели, а не в содержимом (SPEC §6.4).
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('пустые блоки не показываются; характеристик нет — «Неизвестно», сторона известна всегда', () => {
    wrap(<RegionPanel region={bare} />);
    expect(screen.queryByRole('heading', { name: 'Герои' })).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Медиа в регионе' })).toBeNull();
    expect(screen.getByText('Dire')).toBeInTheDocument();
    expect(screen.getAllByText('Неизвестно')).toHaveLength(3);
  });

  it('«Подробнее ↗» — внешняя ссылка в новой вкладке; медиа — не больше 3 карточек, клик открывает ?media', () => {
    wrap(<RegionPanel region={{ ...bare, moreLink: 'https://example.org/lore', media: media(5) }} />);
    const more = screen.getByRole('link', { name: 'Подробнее ↗' });
    expect(more).toHaveAttribute('href', 'https://example.org/lore');
    expect(more).toHaveAttribute('target', '_blank');
    expect(more.getAttribute('rel')).toMatch(/noopener/);

    const section = screen.getByRole('heading', { name: 'Медиа в регионе' }).closest('section')!;
    const cards = within(section).getAllByRole('button');
    expect(cards).toHaveLength(3);
    // Сетка знает, сколько карточек: одна-две — шире (аудит E13).
    expect(section.querySelector('ul')).toHaveAttribute('data-count', '3');
    fireEvent.click(cards[1]!);
    expect(window.location.hash).toBe(`#/?media=${media(2)[1]}`);
  });

  it('«+N» раскрывает весь список героев', () => {
    // У Планов героев больше, чем помещается до «+N».
    const all = heroesOfRegion('planes');
    expect(all.length).toBeGreaterThan(REGION_HEROES);
    wrap(<RegionPanel region={getRegion('planes')!} />);
    const links = () => screen.getAllByRole('link', { name: /официальная страница/ });
    expect(links()).toHaveLength(REGION_HEROES);
    expect(screen.getByRole('button', { name: `+${all.length - REGION_HEROES}: показать всех героев (${all.length})` })).toHaveTextContent(
      `+${all.length - REGION_HEROES}`,
    );
    fireEvent.click(screen.getByRole('button', { name: `+${all.length - REGION_HEROES}: показать всех героев (${all.length})` }));
    expect(links()).toHaveLength(all.length);
  });
});

describe('панель места (SPEC §5.5)', () => {
  const place: Place = { name: 'Nowhere', slug: 'nowhere', capital: false, placement: 'ours' };

  it('место без текста, арта и медиа — только название, без пустых блоков и заглушек', () => {
    wrap(<PlacePanel region={bare} place={place} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Nowhere' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('место с текстом, шапкой и медиа', () => {
    wrap(
      <PlacePanel
        region={bare}
        place={{
          ...place,
          art: '/art.webp',
          text: { type: { ru: 'Крепость', en: 'Fortress' }, description: { ru: 'Текст места.', en: 'Text.' } },
          media: media(1),
        }}
      />,
      'en',
    );
    expect(screen.getByText('Fortress')).toBeInTheDocument();
    expect(screen.getByText('Text.')).toBeInTheDocument();
    expect(document.querySelector('img[src="/art.webp"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Media in this place' })).toBeInTheDocument();
  });
});

describe('сворачивание панели (SPEC §5.4)', () => {
  function Harness() {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <Panel label="Пустошь" collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} contentKey="k">
        <button type="button">Внутри</button>
      </Panel>
    );
  }

  it('кнопка-ромб сворачивает и разворачивает, свёрнутое содержимое недоступно', () => {
    wrap(<Harness />);
    const toggle = screen.getByRole('button', { name: 'Свернуть панель' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('complementary', { name: 'Пустошь' });
    expect(toggle).toHaveAttribute('aria-controls', panel.id);

    fireEvent.click(toggle);
    const expand = screen.getByRole('button', { name: 'Развернуть панель' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('panel-dock').className).toMatch(/collapsed/);
    expect(screen.queryByRole('button', { name: 'Внутри' })).toBeNull();
    expect((panel.parentElement as HTMLElement & { inert?: boolean }).inert).toBe(true);

    fireEvent.click(expand);
    expect(screen.getByRole('button', { name: 'Внутри' })).toBeInTheDocument();
    expect(screen.getByTestId('panel-dock').className).not.toMatch(/collapsed/);
  });
});

describe('крошка «назад» в шапке панели (SPEC §6.4)', () => {
  const place: Place = { name: 'Nowhere', slug: 'nowhere', capital: false, placement: 'ours' };

  it('регион: «‹ Мир» ведёт в мир; место: «‹ Регион» ведёт в регион; RU и EN', () => {
    const { unmount } = wrap(<Breadcrumbs region={bare} />);
    const crumbs = screen.getByRole('navigation', { name: 'Навигация по уровням' });
    fireEvent.click(within(crumbs).getByRole('button', { name: '‹ Мир' }));
    expect(window.location.hash).toBe('#/world');
    unmount();

    wrap(<Breadcrumbs region={bare} place={place} />, 'en');
    fireEvent.click(screen.getByRole('button', { name: '‹ Waste' }));
    expect(window.location.hash).toBe('#/r/nowhere-land');
  });

  it('шапка стоит над прокруткой: до кнопки не надо листать, рядом — «Свернуть»', () => {
    wrap(
      <Panel label="Пустошь" collapsed={false} onToggle={() => {}} contentKey="k" back={<Breadcrumbs region={bare} />}>
        <p>Длинный текст</p>
      </Panel>,
    );
    const panel = screen.getByRole('complementary', { name: 'Пустошь' });
    const [head, scroller] = Array.from(panel.children) as HTMLElement[];
    expect(within(head!).getByRole('button', { name: '‹ Мир' })).toBeInTheDocument();
    expect(within(scroller!).queryByRole('button', { name: '‹ Мир' })).toBeNull();
    expect(within(scroller!).getByText('Длинный текст')).toBeInTheDocument();
    // Порядок фокуса: «Свернуть» → «‹ Мир» → содержимое.
    const buttons = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(buttons).toEqual(['Свернуть панель', '‹ Мир']);
  });
});
