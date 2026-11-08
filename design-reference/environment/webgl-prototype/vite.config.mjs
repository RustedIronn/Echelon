import { mergeConfig } from 'vite';
import base from '../../../vite.config.js';

// Compile the isolated preview without changing the productivity application's entry.
export default mergeConfig(base, {
  build: {
    outDir: 'dist/environment-prototype',
    emptyOutDir: true,
    rollupOptions: { input: 'landscape-preview.html' },
  },
});
