import { createReadStream, existsSync } from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface WebHostOptions {
  engineOrigin: string;
  teacherToken?: string;
  staticRoot?: string;
}

const PRIVILEGED_KEYS = new Set([
  'includeAnswers',
  'includeFeedback',
  'manualEvaluations',
]);
const DEFAULT_STATIC_ROOT = fileURLToPath(new URL('../dist', import.meta.url));
const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sanitizeLearnerUrl(url: URL): URL {
  const sanitized = new URL(url);
  for (const key of PRIVILEGED_KEYS) sanitized.searchParams.delete(key);
  return sanitized;
}

function sanitizeLearnerBody(body: Buffer, contentType: string | undefined): Uint8Array {
  if (body.length === 0 || !contentType?.includes('application/json')) {
    return new Uint8Array(body);
  }
  const parsed: unknown = JSON.parse(body.toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return new Uint8Array(body);
  }
  const sanitized = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => !PRIVILEGED_KEYS.has(key)),
  );
  return new TextEncoder().encode(JSON.stringify(sanitized));
}

async function proxy(
  request: IncomingMessage,
  response: ServerResponse,
  options: WebHostOptions,
): Promise<void> {
  const requestedUrl = new URL(request.url ?? '/', 'http://localhost');
  const isTeacher = requestedUrl.pathname.startsWith('/teacher/api/');
  const isLearner = requestedUrl.pathname.startsWith('/learner/api/');
  const url = isLearner ? sanitizeLearnerUrl(requestedUrl) : requestedUrl;
  const targetPath = url.pathname.replace(/^\/(?:teacher|learner)\/api/, '');
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const rawBody = Buffer.concat(chunks);
  const body = isLearner
    ? sanitizeLearnerBody(rawBody, request.headers['content-type'])
    : new Uint8Array(rawBody);
  const headers = new Headers();
  if (request.headers['content-type']) {
    headers.set('content-type', request.headers['content-type']);
  }
  if (isTeacher && options.teacherToken) {
    headers.set('authorization', `Bearer ${options.teacherToken}`);
  }
  const method = request.method ?? 'GET';
  const upstream = await fetch(`${options.engineOrigin}${targetPath}${url.search}`, {
    method,
    headers,
    ...(body.length > 0 && method !== 'GET' && method !== 'HEAD'
      ? { body: new Blob([Uint8Array.from(body)]) }
      : {}),
  });
  response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

function serveStatic(
  request: IncomingMessage,
  response: ServerResponse,
  staticRoot: string,
): void {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' }).end();
    return;
  }
  const url = new URL(request.url ?? '/', 'http://localhost');
  const requestedPath = decodeURIComponent(url.pathname) === '/'
    ? 'index.html'
    : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const root = path.resolve(staticRoot);
  const candidate = path.resolve(root, requestedPath);
  const safePath = candidate.startsWith(`${root}${path.sep}`) ? candidate : '';
  const filePath = safePath && existsSync(safePath) ? safePath : path.join(root, 'index.html');
  if (!existsSync(filePath)) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    'content-type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

export function createWebHost(options: WebHostOptions): http.Server {
  return http.createServer((request, response) => {
    if (!request.url?.startsWith('/teacher/api/')
      && !request.url?.startsWith('/learner/api/')) {
      serveStatic(request, response, options.staticRoot ?? DEFAULT_STATIC_ROOT);
      return;
    }
    void proxy(request, response, options).catch((error: unknown) => {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        error: '엔진 연결 실패',
        detail: error instanceof Error ? error.message : String(error),
      }));
    });
  });
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const port = Number.parseInt(process.env.PORT ?? '4273', 10);
  const engineOrigin = process.env.ENGINE_ORIGIN ?? 'http://127.0.0.1:8787';
  const server = createWebHost({
    engineOrigin,
    ...(process.env.TEACHER_TOKEN ? { teacherToken: process.env.TEACHER_TOKEN } : {}),
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`digi-mon garden  http://127.0.0.1:${port}`);
    console.log(`engine            ${engineOrigin}`);
  });
}
