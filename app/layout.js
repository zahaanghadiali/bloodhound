export const metadata = {
  title: 'Bloodhound',
  description: 'Find and register blood donors for pets in need.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
