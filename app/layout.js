import '@/styles/globals.css';

export const metadata = {
  title: 'Bloodhound — Pet Blood Donor Chat',
  description: 'Find and register blood donors for pets in need, right from chat.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#ff5d7a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
