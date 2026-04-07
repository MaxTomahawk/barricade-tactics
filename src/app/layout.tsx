import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Barricade Tactics',
  description: 'Multiplayer implementation of the classic board game "Barricade"',
  icons: {
     icon: 'data:image/svg+xml;utf8,<svg viewBox="-0.5 -0.5 1.0 1.0" xmlns="http://www.w3.org/2000/svg"><rect x="-0.45" y="-0.45" width="0.9" height="0.9" fill="none" rx="0.2" stroke="%23ef4444" stroke-width="0.08"></rect><text x="0" y="0" font-family="sans-serif" font-size="0.45" font-weight="bold" fill="%23ef4444" text-anchor="middle" dominant-baseline="central">BT</text></svg>'
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-body antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
