import type { ReactNode } from 'react';

import { Locale } from '@arthome/core';

export const metadata = {
  title: 'Arthome',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={Locale.FR}>
      <body>{children}</body>
    </html>
  );
}
