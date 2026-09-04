import { PawPrint, RotateCcw, HelpCircle } from '@/components/icons/Icons';
import styles from './ChatHeader.module.css';

export default function ChatHeader({ onRestart, onHelp, disabled }) {
  return (
    <header className={styles['chat-header']}>
      <div className={styles['chat-header__brand']}>
        <span className={styles['chat-header__logo']}>
          <PawPrint size={20} />
        </span>
        <div>
          <div className={styles['chat-header__title']}>Bloodhound</div>
          <div className={styles['chat-header__subtitle']}>
            <span className={styles['chat-header__status-dot']} />
            Always on
          </div>
        </div>
      </div>
      <div className={styles['chat-header__actions']}>
        <button type="button" className="icon-btn" onClick={onHelp} disabled={disabled} aria-label="Help" title="Help">
          <HelpCircle size={18} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onRestart}
          disabled={disabled}
          aria-label="Restart"
          title="Restart"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </header>
  );
}
