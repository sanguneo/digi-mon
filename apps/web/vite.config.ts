import react from '@vitejs/plugin-react';
import { defineConfig, type UserConfig } from 'vite';

import { teacherApiGuard, teacherApiProxy } from './server/teacher-proxy.ts';

const ENGINE = 'http://127.0.0.1:8787';

export function webConfig(env: Record<string, string | undefined>): UserConfig {
  const allowRemote = env.DIGIMON_REVIEW_REMOTE === '1';
  return {
    plugins: [react(), teacherApiGuard({ token: env.TEACHER_TOKEN ?? 'e2e-teacher-token', allowRemote })],
    server: {
      host: allowRemote ? '0.0.0.0' : '127.0.0.1',
      port: 4173,
      strictPort: true,
      // Vite 기본 CORS 는 다른 localhost 포트의 페이지에 응답을 읽게 해 준다. 교사 토큰이 붙는 응답이라 끈다.
      cors: false,
      proxy: {
        '/teacher/api': teacherApiProxy(ENGINE),
        '/learner/api': {
          target: ENGINE,
          changeOrigin: false,
          rewrite: (path) => path.replace(/^\/learner\/api/, ''),
        },
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
      cors: false,
    },
  };
}

export default defineConfig(() => webConfig(process.env));
