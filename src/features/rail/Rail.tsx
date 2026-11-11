import { useState, type ButtonHTMLAttributes } from 'react';
import { useNavigation } from '../../app/navigation';
import { useSound } from '../../app/sound';
import { Icon, type IconName } from '../../components/Icon';
import { LangSwitch } from '../../components/LangSwitch';
import { Tooltip } from '../../components/Tooltip';
import { useT } from '../../i18n';
import { AboutDialog } from './AboutDialog';
import styles from './Rail.module.css';

interface RailButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  label: string;
}

/** Кнопка-иконка панели; подпись — подсказка справа, она же доступное имя. */
function RailButton({ icon, label, className, ...rest }: RailButtonProps) {
  return (
    <Tooltip content={label} placement="right" mode="label">
      <button type="button" className={[styles.button, className].filter(Boolean).join(' ')} {...rest}>
        <Icon name={icon} />
      </button>
    </Tooltip>
  );
}

/** Левая вертикальная панель (SPEC §6.1): логотип, глобус, поиск, язык; внизу звук и «О проекте». */
export function Rail({ className }: { className?: string }) {
  const { t } = useT();
  const { route, open } = useNavigation();
  const sound = useSound();
  const [aboutOpen, setAboutOpen] = useState(false);
  const screen = route.screen.name;

  return (
    <nav className={[styles.rail, className].filter(Boolean).join(' ')} aria-label={t('rail.label')}>
      <div className={styles.group}>
        <RailButton icon="logo" label={t('rail.home')} className={styles.logo} onClick={() => open({ name: 'intro' })} />
        <RailButton
          icon="globe"
          label={t('rail.world')}
          aria-current={screen === 'world' ? 'page' : undefined}
          onClick={() => open({ name: 'world' })}
        />
        {/* Поиск героя — E7; пока кнопка-заглушка. */}
        <RailButton icon="search" label={t('rail.search')} aria-disabled="true" />
        <LangSwitch className={styles.lang} />
      </div>
      <div className={styles.group}>
        {/* Звуки — E9; переключатель уже хранит выбор (SPEC §7.4). */}
        <RailButton
          icon={sound.enabled ? 'sound' : 'soundOff'}
          label={t('rail.sound')}
          aria-pressed={sound.enabled}
          onClick={sound.toggle}
        />
        <RailButton
          icon="info"
          label={t('rail.about')}
          aria-haspopup="dialog"
          aria-expanded={aboutOpen}
          onClick={() => setAboutOpen(true)}
        />
      </div>
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    </nav>
  );
}
