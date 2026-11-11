import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Plugin, ProxyOptions } from 'vite';

import { teacherRequestRefusal } from './teacher-origin.ts';

export interface TeacherApiGuardOptions {
  token: string;
  /** 다른 기기의 요청을 받을지. 받더라도 그 기기가 직접 보낸 토큰만 넘긴다. */
  allowRemote: boolean;
}

const TEACHER_PREFIX = '/teacher/api';

/** IPv4 127.0.0.0/8, IPv6 ::1, IPv4-mapped 127.x 만 루프백으로 친다. X-Forwarded-For 같은 헤더는 믿지 않는다. */
export function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  return address === '::1' || address.startsWith('127.') || address.startsWith('::ffff:127.');
}

function refuse(res: ServerResponse, status: number, error: string) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error }));
}

/**
 * 개발 서버의 /teacher/api 프록시 앞에 서는 문지기.
 * - 루프백: 토큰을 안 가져왔으면 교사 토큰을 붙인다.
 * - 다른 기기: allowRemote 가 꺼져 있으면 403, 켜져 있어도 스스로 토큰을 보낸 요청만 넘기고 토큰을 대신 붙이지 않는다.
 * - 어느 쪽이든 다른 사이트에서 온 요청과 JSON 이 아닌 쓰기는 넘기기 전에 막는다(teacher-origin.ts).
 *   루프백이라는 것만으로는 부족하다. 다른 사이트의 페이지도 브라우저를 통해 루프백으로 들어온다.
 */
export function guardTeacherRequest({ token, allowRemote }: TeacherApiGuardOptions) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith(TEACHER_PREFIX)) {
      next();
      return;
    }
    const supplied = req.headers.authorization;
    if (isLoopback(req.socket.remoteAddress)) {
      const refusal = teacherRequestRefusal(req, allowRemote);
      if (refusal) {
        refuse(res, refusal.status, refusal.error);
        return;
      }
      if (!supplied) req.headers.authorization = `Bearer ${token}`;
      next();
      return;
    }
    if (!allowRemote) {
      refuse(res, 403, '다른 기기에서 교사 API를 쓰는 것은 꺼져 있습니다. DIGIMON_REVIEW_REMOTE=1 로 켜야 합니다.');
      return;
    }
    if (!supplied?.startsWith('Bearer ')) {
      refuse(res, 401, '다른 기기에서는 교사 토큰을 직접 입력해야 합니다.');
      return;
    }
    const refusal = teacherRequestRefusal(req, allowRemote);
    if (refusal) {
      refuse(res, refusal.status, refusal.error);
      return;
    }
    next();
  };
}

export function teacherApiGuard(options: TeacherApiGuardOptions): Plugin {
  const guard = guardTeacherRequest(options);
  return {
    name: 'digimon-teacher-api-guard',
    configureServer(server) {
      server.middlewares.use(guard);
    },
    configurePreviewServer(server) {
      server.middlewares.use(guard);
    },
  };
}

export function teacherApiProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: false,
    rewrite: (path) => path.replace(/^\/teacher\/api/, ''),
  };
}
