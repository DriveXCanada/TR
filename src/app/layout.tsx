import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Field Operations — Team Rubicon Canada',
  description: 'Disaster-relief field kitchen operations console. Powered by DriveX.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#CE1126',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
