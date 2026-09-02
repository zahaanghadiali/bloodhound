import { PawPrint } from '@/components/icons/Icons';

export default function TypingIndicator() {
  return (
    <div className="msg-row msg-row--bot">
      <div className="avatar avatar--bot">
        <PawPrint size={14} />
      </div>
      <div className="bubble bubble--bot typing">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}
