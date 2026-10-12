import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Locale } from '@arthome/core';

export const metadata: Metadata = {
  title: 'Arthome',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={Locale.FR}>
      <body>{children}</body>
    </html>
  );
}
