import { spawn } from 'node:child_process';
import { createServer } from 'vite';

// Isolated real engine and Vite surface; never reuse another QA session's ports.
const engine = spawn(process.execPath, ['../../bin/serve.mjs'], {
  env: { ...process.env, PORT: '14887', TEACHER_TOKEN: 'e2e-teacher-token' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
engine.stdout.pipe(process.stdout);
const proxy = (prefix) => ({ target: 'http://127.0.0.1:14887', rewrite: (path) => path.replace(prefix, '') });
const server = await createServer({
  server: { port: 4473, strictPort: true, host: '127.0.0.1', proxy: {
    '/learner/api': proxy('/learner/api'),
    '/teacher/api': { ...proxy('/teacher/api'), headers: { authorization: 'Bearer e2e-teacher-token' } },
  } },
});
await server.listen();
const close = async () => { engine.kill(); await server.close(); process.exit(); };
process.on('SIGTERM', close);
process.on('SIGINT', close);
engine.on('exit', (code) => { if (code) process.exit(code); });
