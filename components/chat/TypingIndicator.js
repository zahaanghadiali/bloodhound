import { PawPrint } from '@/components/icons/Icons';
import bubbleStyles from './MessageBubble.module.css';
import styles from './TypingIndicator.module.css';

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
