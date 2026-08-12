import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const dynamic = 'force-dynamic'

// Sans-serif — corpo de texto
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
// Serifa elegante — títulos
const playfairDisplay = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' });

export const metadata: Metadata = {
  title: 'Meu Club Nutri.AI',
  description: 'Plataforma de nutrição gamificada com IA',
};

import { Providers } from '@/components/Providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfairDisplay.variable}`}>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
