import { RotateCcw, HelpCircle } from '@/components/icons/Icons';
import styles from './ChatHeader.module.css';

/**
 * Header of the chat window with the brand and the help and restart buttons.
 * @param {{onRestart: function(): void, onHelp: function(): void, disabled:
 *     boolean}} props Button handlers, and whether the buttons are disabled.
 * @return {JSX.Element} The header.
 */
export default function ChatHeader({ onRestart, onHelp, disabled }) {
  return (
    <header className={styles['chat-header']}>
      <div className={styles['chat-header__brand']}>
        <img className={styles['chat-header__logo']} src="/logo.png" alt="" />
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
