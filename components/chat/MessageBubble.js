import { PawPrint, User } from '@/components/icons/Icons';

export default function MessageBubble({ role, text, image }) {
  const isBot = role === 'bot';
  const lines = text.split('\n');

  return (
    <div className={`msg-row ${isBot ? 'msg-row--bot' : 'msg-row--user'}`}>
      <div className={`avatar ${isBot ? 'avatar--bot' : 'avatar--user'}`}>
        {isBot ? <PawPrint size={14} /> : <User size={14} />}
      </div>
      <div className={`bubble ${isBot ? 'bubble--bot' : 'bubble--user'}`}>
        {image && <img src={image} alt="Attached pet photo" className="bubble__image" />}
        {lines.map((line, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <p key={i}>{line || ' '}</p>
        ))}
      </div>
    </div>
  );
}
