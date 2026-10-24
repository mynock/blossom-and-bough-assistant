/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // PROXY_TARGET may come from the shell or the root .env (CRA read both).
  // Docker sets it to the backend container; locally the API runs on 3001.
  const { PROXY_TARGET } = loadEnv(mode, process.cwd(), 'PROXY_');

  return {
    plugins: [react()],
    define: {
      // draft-js (via fbjs/lib/setImmediate) reads Node's `global`, which CRA's
      // webpack config used to polyfill.
      global: 'globalThis',
    },
    server: {
      port: 3000,
      // Fail loudly instead of drifting onto 3001, where the backend lives.
      strictPort: true,
      // Listen on all interfaces (as CRA did) so the Docker port mapping works.
      host: true,
      watch: {
        // docker-compose.dev.yml sets this for bind-mounted sources.
        usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
      },
      proxy: {
        '/api': {
          target: PROXY_TARGET || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    build: {
      // server/src/server.ts and the root Dockerfile serve /app/build.
      outDir: 'build',
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
      // server/ has its own Jest suite.
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
