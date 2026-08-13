import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4273,
    strictPort: true,
    proxy: {
      '/teacher/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/teacher\/api/, ''),
        headers: {
          authorization: 'Bearer e2e-teacher-token',
        },
      },
      '/learner/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/learner\/api/, ''),
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4273,
    strictPort: true,
  },
});
