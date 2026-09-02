function IconBase({ size = 18, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Send(props) {
  return (
    <IconBase {...props}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </IconBase>
  );
}

export function MapPin(props) {
  return (
    <IconBase {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </IconBase>
  );
}

export function PawPrint(props) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      <circle cx="7" cy="8" r="2.2" />
      <circle cx="12" cy="5.5" r="2.2" />
      <circle cx="17" cy="8" r="2.2" />
      <ellipse cx="12" cy="15" rx="5.5" ry="4.5" />
    </IconBase>
  );
}

export function RotateCcw(props) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </IconBase>
  );
}

export function HelpCircle(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2-3 4" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </IconBase>
  );
}

export function User(props) {
  return (
    <IconBase {...props}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </IconBase>
  );
}

export function LayoutGrid(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </IconBase>
  );
}

export function MessageCircle(props) {
  return (
    <IconBase {...props}>
      <path d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.1A8.5 8.5 0 1 1 21 11.5Z" />
    </IconBase>
  );
}

export function Users(props) {
  return (
    <IconBase {...props}>
      <path d="M17 21a4.5 4.5 0 0 0-10 0" />
      <circle cx="12" cy="10.5" r="3.5" />
      <path d="M21 21a4 4 0 0 0-3.2-4.4" />
      <path d="M16.3 5.1a3.5 3.5 0 0 1 0 6.8" />
    </IconBase>
  );
}

export function Settings(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </IconBase>
  );
}

export function Dog(props) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      <path d="M4 9.5C4 7 6 5 8 5.5c.6.2 1 .8 1.3 1.4.5-.2 1.1-.3 1.7-.3s1.2.1 1.7.3C13 6.3 13.4 5.7 14 5.5 16 5 18 7 18 9.5c0 1-.4 1.8-1 2.4V15c0 2.8-2.2 5-5 5s-5-2.2-5-5v-3.1c-.6-.6-1-1.4-1-2.4Z" />
      <circle cx="9.8" cy="11.3" r="0.9" fill="#fff" />
      <circle cx="14.2" cy="11.3" r="0.9" fill="#fff" />
    </IconBase>
  );
}

export function Cat(props) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      <path d="M6 4 8.2 9h7.6L18 4c.6 2 .9 3.9.9 5.6C18.9 13.7 15.8 17 12 17s-6.9-3.3-6.9-7.4C5.1 7.9 5.4 6 6 4Z" />
      <path d="M12 17c2.8 0 5-1.6 5-3.6 0 2.4-1 4.6-2.4 5.9a3.3 3.3 0 0 1-5.2 0C8 17.9 7 15.8 7 13.4 7 15.4 9.2 17 12 17Z" />
      <circle cx="9.9" cy="10.4" r="0.9" fill="#fff" />
      <circle cx="14.1" cy="10.4" r="0.9" fill="#fff" />
    </IconBase>
  );
}

export function Droplet(props) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      <path d="M12 2c3.5 4.6 7 8.9 7 12.5a7 7 0 1 1-14 0C5 10.9 8.5 6.6 12 2Z" />
    </IconBase>
  );
}

export function Syringe(props) {
  return (
    <IconBase {...props}>
      <path d="m18 2 4 4" />
      <path d="m17 7 3-3" />
      <path d="M19 5 8.5 15.5 6 21l5.5-2.5L22 8" />
      <path d="m9 11 4 4" />
      <path d="m6 21-1.5-1.5" />
    </IconBase>
  );
}

export function Camera(props) {
  return (
    <IconBase {...props}>
      <path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5L16.5 4Z" />
      <circle cx="12" cy="13" r="3.5" />
    </IconBase>
  );
}

export function Search(props) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </IconBase>
  );
}
