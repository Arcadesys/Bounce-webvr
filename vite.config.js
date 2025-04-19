import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'src',
  server: {
    open: true,
    port: 3000,
    host: true,
    strictPort: true,
    watch: {
      usePolling: true
    },
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@components': path.resolve(__dirname, './src/components'),
      '@styles': path.resolve(__dirname, './src/styles')
    }
  },
  build: {
    outDir: '../dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/setup.js',
      ]
    },
    deps: {
      inline: [/three/, /cannon-es/, /tone/]
    }
  },
  // Add debug options
  logLevel: 'info',
  clearScreen: false
}); 