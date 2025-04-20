import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  }
}); 