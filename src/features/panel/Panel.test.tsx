import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NavigationProvider } from '../../app/navigation';
import type { Place, Region } from '../../data/types';
import { getRegion, heroesOfRegion, world } from '../../data/world';
import { I18nProvider } from '../../i18n';
import { FeedbackProvider } from '../feedback/FeedbackProvider';
import { PlacePanel } from '../location/PlacePanel';
import { REGION_HEROES, RegionPanel } from '../region/RegionPanel';
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
      <NavigationProvider>
        <FeedbackProvider>{node}</FeedbackProvider>
      </NavigationProvider>
    </I18nProvider>,
  );
}

describe('панель региона (SPEC §5.4)', () => {
  it('реальный регион: заголовок, подзаголовок, герои, характеристики 2×2, описание', () => {
    const icewrack = getRegion('icewrack')!;
    wrap(<RegionPanel region={icewrack} />);
    // Название — в шапке окна (WindowHead, #230), не в тексте панели.
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
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

  it('место без текста, арта и медиа — без пустых блоков и заглушек', () => {
    wrap(<PlacePanel region={bare} place={place} />);
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    // Единственная кнопка — «Нашли ошибку или знаете больше?» (#74): у пустого места она нужнее всего.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Нашли ошибку или знаете больше? Расскажите']);
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

describe('шапка окна (#230, SPEC §5.1 «Правила окон»)', () => {
  it('название и × в одной строке над прокруткой, название — один раз', () => {
    const onClose = vi.fn();
    wrap(
      <Panel label="Пустошь" collapsed={false} onToggle={() => {}} contentKey="k" onClose={onClose}>
        <p>Длинный текст</p>
      </Panel>,
    );
    const panel = screen.getByRole('complementary', { name: 'Пустошь' });
    const [head, scroller] = Array.from(panel.children) as HTMLElement[];
    const row = head!.querySelector('[data-window-head]') as HTMLElement;
    expect(within(row).getByRole('heading', { level: 2, name: 'Пустошь' })).toHaveAttribute('data-panel-heading');
    fireEvent.click(within(row).getByRole('button', { name: 'Закрыть: Пустошь' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getAllByText('Пустошь')).toHaveLength(1);
    expect(within(scroller!).getByText('Длинный текст')).toBeInTheDocument();
    // Старых кнопок нет: ни ромба «Свернуть панель», ни крошек «‹ Мир».
    expect(screen.queryByRole('button', { name: 'Свернуть панель' })).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('прокрутка панели при смене экрана (#99, #238)', () => {
  it('новая панель не прокручивается (без принудительной раскладки), смена экрана — наверх', () => {
    const calls: unknown[] = [];
    const proto = Element.prototype as Element & { scrollTo?: (arg: unknown) => void };
    const saved = proto.scrollTo;
    proto.scrollTo = (arg: unknown) => {
      calls.push(arg);
    };
    try {
      const panel = (key: string) => (
        <I18nProvider initialLang="ru">
          <Panel label="Пустошь" collapsed={false} onToggle={() => {}} contentKey={key} onClose={() => {}}>
            <p>текст</p>
          </Panel>
        </I18nProvider>
      );
      const view = render(panel('a'));
      expect(calls).toEqual([]);
      view.rerender(panel('b'));
      expect(calls).toEqual([{ top: 0 }]);
    } finally {
      proto.scrollTo = saved;
    }
  });
});
