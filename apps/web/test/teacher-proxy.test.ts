import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import { after, before, describe, test } from 'node:test';

import { createServer, type ViteDevServer } from 'vite';

import { guardTeacherRequest, teacherApiGuard, teacherApiProxy } from '../server/teacher-proxy.ts';
import { webConfig } from '../vite.config.ts';

let engine: http.Server;
let engineUrl = '';
let received: { method: string | undefined; url: string | undefined; authorization: string | undefined }[] = [];

async function listen(server: http.Server, host: string): Promise<number> {
  const listening = once(server, 'listening', { signal: AbortSignal.timeout(10_000) });
  server.listen(0, host);
  await listening;
  const address = server.address();
  assert(address && typeof address !== 'string');
  return address.port;
}

async function devServer(host: string, allowRemote: boolean): Promise<{ server: ViteDevServer; port: number }> {
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [teacherApiGuard({ token: 'local-token', allowRemote })],
    server: { host, port: 0, strictPort: false, ws: false, cors: webConfig({}).server?.cors ?? true, proxy: { '/teacher/api': teacherApiProxy(engineUrl) } },
  });
  await server.listen();
  const address = server.httpServer?.address();
  assert(address && typeof address !== 'string');
  return { server, port: address.port };
}

function request(url: string, init: { method?: string; headers?: Record<string, string>; localAddress?: string } = {}) {
  return new Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers ?? {}, ...(init.localAddress ? { localAddress: init.localAddress } : {}) }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), headers: res.headers }));
    });
    req.on('error', reject);
    req.end(init.method === 'POST' ? '{"id":"x","action":"reset"}' : undefined);
  });
}

before(async () => {
  engine = http.createServer((req, res) => {
    received.push({ method: req.method, url: req.url, authorization: req.headers.authorization });
    req.resume();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  });
  engineUrl = `http://127.0.0.1:${await listen(engine, '127.0.0.1')}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => engine.close((error) => error ? reject(error) : resolve()));
});

describe('vite config', () => {
  test('binds the dev server to loopback and never hard-codes the teacher token into the proxy', () => {
    const config = webConfig({});
    assert.equal(config.server?.host, '127.0.0.1');
    const proxy = config.server?.proxy?.['/teacher/api'];
    assert(proxy && typeof proxy !== 'string');
    assert.equal(proxy.headers, undefined);
  });

  test('opens to the network only when DIGIMON_REVIEW_REMOTE=1', () => {
    assert.equal(webConfig({ DIGIMON_REVIEW_REMOTE: '1' }).server?.host, '0.0.0.0');
    assert.equal(webConfig({ DIGIMON_REVIEW_REMOTE: 'true' }).server?.host, '127.0.0.1');
  });
});

describe('through a real vite dev server on loopback', () => {
  let dev: { server: ViteDevServer; port: number };
  before(async () => { dev = await devServer('127.0.0.1', false); });
  after(async () => { await dev.server.close(); });

  test('adds the teacher token for a loopback request that brought none', async () => {
    received = [];
    const response = await request(`http://127.0.0.1:${dev.port}/teacher/api/v1/review/items`);
    assert.equal(response.status, 200);
    assert.deepEqual(received, [{ method: 'GET', url: '/v1/review/items', authorization: 'Bearer local-token' }]);
  });

  test('keeps the token a loopback client typed in', async () => {
    received = [];
    await request(`http://127.0.0.1:${dev.port}/teacher/api/v1/review/items`, { headers: { authorization: 'Bearer typed' } });
    assert.equal(received[0]?.authorization, 'Bearer typed');
  });
});

describe('a cross-site page cannot borrow the loopback token', () => {
  let dev: { server: ViteDevServer; port: number };
  let self = '';
  let url = '';
  before(async () => {
    dev = await devServer('127.0.0.1', false);
    self = `http://127.0.0.1:${dev.port}`;
    url = `${self}/teacher/api/v1/review/verdict`;
  });
  after(async () => { await dev.server.close(); });

  const writes: [string, Record<string, string>, number][] = [
    ['cross-site text/plain POST', { origin: 'http://evil.example', 'content-type': 'text/plain' }, 403],
    ['cross-site JSON POST', { origin: 'http://evil.example', 'content-type': 'application/json' }, 403],
    ['another localhost app', { origin: 'http://localhost:5000', 'content-type': 'application/json' }, 403],
    ['opaque origin', { origin: 'null', 'content-type': 'application/json' }, 403],
    ['cross-site referer only', { referer: 'http://evil.example/page', 'content-type': 'application/json' }, 403],
    ['POST with neither Origin nor Referer', { 'content-type': 'application/json' }, 403],
  ];
  for (const [name, headers, status] of writes) {
    test(`refuses a ${name} and never reaches the engine`, async () => {
      received = [];
      const response = await request(url, { method: 'POST', headers });
      assert.equal(response.status, status);
      assert.equal(received.length, 0);
    });
  }

  test('refuses a same-origin write that is not JSON', async () => {
    received = [];
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']) {
      const response = await request(url, { method: 'POST', headers: { origin: self, 'content-type': type } });
      assert.equal(response.status, 415);
    }
    assert.equal(received.length, 0);
  });

  test('passes a same-origin JSON POST and adds the token', async () => {
    received = [];
    const response = await request(url, { method: 'POST', headers: { origin: self, 'content-type': 'application/json; charset=utf-8' } });
    assert.equal(response.status, 200);
    assert.deepEqual(received, [{ method: 'POST', url: '/v1/review/verdict', authorization: 'Bearer local-token' }]);
  });

  test('passes a same-origin JSON POST that carries only a Referer', async () => {
    received = [];
    const response = await request(url, { method: 'POST', headers: { referer: `${self}/review`, 'content-type': 'application/json' } });
    assert.equal(response.status, 200);
    assert.equal(received[0]?.authorization, 'Bearer local-token');
  });

  test('refuses a cross-site read and grants no CORS', async () => {
    received = [];
    const read = await request(`${self}/teacher/api/v1/review/items`, { headers: { origin: 'http://localhost:5000' } });
    assert.equal(read.status, 403);
    assert.equal(read.headers['access-control-allow-origin'], undefined);
    assert.equal(received.length, 0);
  });
});

describe('vite config CORS', () => {
  test('turns off the dev and preview CORS that would let other localhost pages read teacher replies', () => {
    for (const env of [{}, { DIGIMON_REVIEW_REMOTE: '1' }]) {
      const config = webConfig(env);
      assert.equal(config.server?.cors, false);
      assert.equal(config.preview?.cors, false);
    }
  });
});

describe('a request from another device', () => {
  const site = 'http://192.168.0.10:4173';
  const remote = (headers: Record<string, string> = {}) => ({
    url: '/teacher/api/v1/review/verdict',
    method: 'POST',
    headers: { host: '192.168.0.10:4173', origin: site, 'content-type': 'application/json', ...headers } as Record<string, string>,
    socket: { remoteAddress: '192.168.0.23', localPort: 4173 },
  });
  function call(allowRemote: boolean, req: ReturnType<typeof remote>) {
    let status = 0;
    let body = '';
    let forwarded = false;
    const res = {
      statusCode: 0,
      setHeader() {},
      end(chunk?: string) { status = this.statusCode; body = chunk ?? ''; },
    };
    guardTeacherRequest({ token: 'local-token', allowRemote })(req as never, res as never, () => { forwarded = true; });
    return { status, body, forwarded, authorization: req.headers.authorization };
  }

  test('is refused while remote access is off, even with a token or a spoofed forwarded-for', () => {
    for (const headers of [{}, { authorization: 'Bearer local-token' }, { 'x-forwarded-for': '127.0.0.1' }]) {
      const result = call(false, remote(headers));
      assert.equal(result.forwarded, false);
      assert.equal(result.status, 403);
    }
  });

  test('without its own token is refused when remote access is on, and the server token is never added', () => {
    const result = call(true, remote());
    assert.equal(result.forwarded, false);
    assert.equal(result.status, 401);
    assert.equal(result.authorization, undefined);
    assert.match(JSON.parse(result.body).error, /교사 토큰/);
  });

  test('with its own token is forwarded unchanged when remote access is on', () => {
    const result = call(true, remote({ authorization: 'Bearer typed-on-phone' }));
    assert.equal(result.forwarded, true);
    assert.equal(result.authorization, 'Bearer typed-on-phone');
  });

  test('with its own token is still held to the same origin and JSON when remote access is on', () => {
    assert.equal(call(true, remote({ authorization: 'Bearer typed', origin: 'http://evil.example' })).status, 403);
    assert.equal(call(true, remote({ authorization: 'Bearer typed', origin: 'http://192.168.0.99:4173' })).status, 403);
    assert.equal(call(true, remote({ authorization: 'Bearer typed', 'content-type': 'text/plain' })).status, 415);
    const noOrigin = remote({ authorization: 'Bearer typed' });
    delete noOrigin.headers.origin;
    assert.equal(call(true, noOrigin).status, 403);
  });

  test('leaves other paths alone', () => {
    let forwarded = false;
    guardTeacherRequest({ token: 'local-token', allowRemote: false })(
      { url: '/learner/api/v1/grade', headers: {}, socket: { remoteAddress: '192.168.0.23' } } as never,
      {} as never,
      () => { forwarded = true; },
    );
    assert.equal(forwarded, true);
  });
});

const lanAddress = Object.values(networkInterfaces()).flat()
  .find((entry) => entry && entry.family === 'IPv4' && !entry.internal)?.address;

describe('through a real vite dev server reached over the LAN address', { skip: lanAddress ? false : 'no non-loopback IPv4 interface on this machine' }, () => {
  test('refuses an unauthenticated write and never reaches the engine', async () => {
    const dev = await devServer('0.0.0.0', true);
    try {
      received = [];
      const url = `http://${lanAddress}:${dev.port}/teacher/api/v1/review/verdict`;
      const origin = `http://${lanAddress}:${dev.port}`;
      const refused = await request(url, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, localAddress: lanAddress! });
      assert.equal(refused.status, 401);
      assert.equal(received.length, 0);

      const typed = await request(url, { method: 'POST', headers: { origin, 'content-type': 'application/json', authorization: 'Bearer typed' }, localAddress: lanAddress! });
      assert.equal(typed.status, 200);
      assert.equal(received[0]?.authorization, 'Bearer typed');
    } finally {
      await dev.server.close();
    }
  });
});
