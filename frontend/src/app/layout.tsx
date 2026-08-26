import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { ConditionalShell } from '@/components/customer/ConditionalShell';

export const metadata: Metadata = {
  title: 'PrintStore  | Commercial & Retail Custom Online Printing',
  description:
    'High-impact custom printing for n businesses. Premium business cards, flyers, banners, signage, and merchandise with instant live pricing and fast dispatch.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col antialiased">
        <Providers>
          <ConditionalShell>{children}</ConditionalShell>
        </Providers>
      </body>
    </html>
  );
}