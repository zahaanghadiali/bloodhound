import { PawPrint, User } from '@/components/icons/Icons';
import styles from './MessageBubble.module.css';

/**
 * One chat message with its avatar, optional photo and optional file link.
 * @param {{role: string, text: string, image: ?string, file: ?{url: string,
 *     filename: string}}} props role is 'bot' or 'user'; text may contain line
 *     breaks.
 * @return {JSX.Element} The message row.
 */
export default function MessageBubble({ role, text, image, file }) {
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
          <p key={i}>{line || ' '}</p>
        ))}
        {file && (
          <a href={file.url} download={file.filename} target="_blank" rel="noreferrer" className={styles['bubble__file']}>
            Open file
          </a>
        )}
      </div>
    </div>
  );
}
