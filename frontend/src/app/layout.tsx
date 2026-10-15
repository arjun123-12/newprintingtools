import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './globals.css';
import '@/css/hero.css';
import { Providers } from './providers';
import { ConditionalShell } from '@/components/customer/ConditionalShell';

export const metadata: Metadata = {
  title: 'Erry Imprints | Commercial & Retail Custom Online Printing',
  description:
    'High-impact custom printing for Australian businesses. Premium business cards, flyers, banners, signage, and merchandise with instant live pricing and fast dispatch.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU" className="font-sans text-[16px]">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans antialiased text-base">
        <Providers>
          <ConditionalShell>{children}</ConditionalShell>
        </Providers>
      </body>
    </html>
  );
}