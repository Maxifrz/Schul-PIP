import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // The renderer is served by the app's own schulpip://app protocol, so assets are relative.
  base: './',
  build: { outDir: 'dist', emptyOutDir: true, target: 'chrome130' },
  server: { port: 5173, strictPort: true },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
