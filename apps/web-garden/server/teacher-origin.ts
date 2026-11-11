// apps/web/server/teacher-origin.ts 와 같은 파일이다. 한쪽을 고치면 다른 쪽도 고친다.
import { isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface TeacherRefusal {
  status: 403 | 415;
  error: string;
}

/** Origin, 없으면 Referer 의 출처. 둘 다 없으면 null, 읽을 수 없으면 ''. */
function claimedOrigin(req: IncomingMessage): string | null {
  const origin = req.headers.origin;
  if (origin !== undefined) return origin;
  const referer = req.headers.referer;
  if (referer === undefined) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
}

/**
 * 요청을 보낸 페이지가 이 서버 자신인지. 브라우저가 붙인 Origin 이 Host 헤더와 같고, 포트가 연결이
 * 실제로 들어온 포트와 같으며, 이름이 루프백(원격 모드면 IP 주소)일 때만 그렇다. 다른 이름을 받지 않아
 * DNS 리바인딩으로 Host 를 맞춘 페이지도 통과하지 못한다.
 */
function isSelf(origin: string, req: IncomingMessage, allowRemote: boolean): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' || parsed.origin !== origin) return false;
  if (parsed.host !== req.headers.host) return false;
  if (Number(parsed.port || 80) !== req.socket.localPort) return false;
  if (LOOPBACK_HOSTNAMES.has(parsed.hostname)) return true;
  return allowRemote && isIP(parsed.hostname.replace(/^\[|\]$/g, '')) !== 0;
}

function isJson(contentType: string | undefined): boolean {
  return contentType?.split(';')[0]?.trim().toLowerCase() === 'application/json';
}

/**
 * 교사 API 요청이 다른 사이트에서 위조된 것인지 본다. 토큰을 붙이기 전에 불러야 한다.
 * - 다른 출처가 보낸 요청은 읽기든 쓰기든 403.
 * - 쓰기는 Origin(없으면 Referer)이 자기 출처여야 하고, 둘 다 없으면 403.
 * - 쓰기는 application/json 만 받는다(415). 교차 출처 JSON 은 사전 요청을 거쳐야 해서 몰래 보낼 수 없다.
 */
export function teacherRequestRefusal(req: IncomingMessage, allowRemote: boolean): TeacherRefusal | null {
  const isWrite = WRITE_METHODS.has(req.method ?? 'GET');
  const origin = claimedOrigin(req);
  if (origin === null) {
    return isWrite ? { status: 403, error: '출처(Origin/Referer)가 없는 교사 API 쓰기 요청은 받지 않습니다.' } : null;
  }
  if (!isSelf(origin, req, allowRemote)) {
    return { status: 403, error: '다른 사이트에서 보낸 교사 API 요청은 받지 않습니다.' };
  }
  if (isWrite && !isJson(req.headers['content-type'])) {
    return { status: 415, error: '교사 API 쓰기 요청은 application/json 만 받습니다.' };
  }
  return null;
}
