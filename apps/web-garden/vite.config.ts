import react from '@vitejs/plugin-react';
import { defineConfig, type Connect, type Plugin } from 'vite';

import { teacherRequestRefusal } from './server/teacher-origin.ts';

// 프록시가 교사 토큰을 붙이므로, 다른 사이트에서 온 요청과 JSON 이 아닌 쓰기는 프록시에 닿기 전에 막는다.
const guardTeacherApi: Connect.NextHandleFunction = (req, res, next) => {
  const refusal = req.url?.startsWith('/teacher/api') ? teacherRequestRefusal(req, false) : null;
  if (!refusal) {
    next();
    return;
  }
  res.statusCode = refusal.status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: refusal.error }));
};

const teacherApiGuard: Plugin = {
  name: 'digimon-garden-teacher-api-guard',
  configureServer(server) {
    server.middlewares.use(guardTeacherApi);
  },
  configurePreviewServer(server) {
    server.middlewares.use(guardTeacherApi);
  },
};

export default defineConfig({
  plugins: [react(), teacherApiGuard],
  server: {
    port: 4273,
    strictPort: true,
    cors: false,
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
    cors: false,
  },
});
