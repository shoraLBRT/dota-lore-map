import { DiamondButton } from '../../components/DiamondButton';
import { useT } from '../../i18n';
import crumbStyles from '../panel/Blocks.module.css';

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
