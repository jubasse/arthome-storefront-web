import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import base from '@arthome/tooling/vitest';

export default defineConfig({
  ...base,
  plugins: [react()],
  test: {
    ...base.test,
    environment: 'jsdom',
    include: [...base.test.include, 'tools/**/*.spec.mjs'],
  },
});
