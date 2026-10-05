import { PawPrint } from '@/components/icons/Icons';
import bubbleStyles from './MessageBubble.module.css';
import styles from './TypingIndicator.module.css';

/**
 * Animated dots shown while the bot is replying.
 * @return {JSX.Element} The typing bubble.
 */
export default function TypingIndicator() {
  return (
    <div className={bubbleStyles['msg-row']}>
      <div className={`${bubbleStyles.avatar} ${bubbleStyles['avatar--bot']}`}>
        <PawPrint size={14} />
      </div>
      <div className={`${bubbleStyles.bubble} ${bubbleStyles['bubble--bot']} ${styles.typing}`}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  );
}
