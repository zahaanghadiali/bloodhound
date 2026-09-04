import { PawPrint, User } from '@/components/icons/Icons';
import styles from './MessageBubble.module.css';

export default function MessageBubble({ role, text, image }) {
  const isBot = role === 'bot';
  const lines = text.split('\n');

  return (
    <div className={`${styles['msg-row']}${isBot ? '' : ` ${styles['msg-row--user']}`}`}>
      <div className={`${styles.avatar} ${isBot ? styles['avatar--bot'] : styles['avatar--user']}`}>
        {isBot ? <PawPrint size={14} /> : <User size={14} />}
      </div>
      <div className={`${styles.bubble} ${isBot ? styles['bubble--bot'] : styles['bubble--user']}`}>
        {image && <img src={image} alt="Attached pet photo" className={styles['bubble__image']} />}
        {lines.map((line, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <p key={i}>{line || ' '}</p>
        ))}
      </div>
    </div>
  );
}
