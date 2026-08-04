import { buildCoverage } from '../engine/registry.mjs';
import { buildWorksheet, generateItem } from '../engine/worksheet.mjs';
import { createRng } from '../engine/rng.mjs';
import { gradeWorksheet } from './grade.mjs';
import { renderFigureSvg, hasSvgRenderer } from '../render/figure-svg.mjs';
import {
  MATH_PREREQUISITES,
  ancestorsOf,
  dependentsOf,
  learningOrder,
} from '../curriculum/prerequisites.mjs';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_COUNT = 100;

class HttpError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, '요청 본문이 너무 크다'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim().length === 0) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'JSON 파싱 실패'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function list(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

/** 학습지 생성 옵션을 한 곳에서 검증한다. 잘못된 조합은 500이 아니라 400이어야 한다. */
function parseWorksheetOptions(source) {
  const count = source.count === undefined ? 20 : Number(source.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new HttpError(400, `count 는 1..${MAX_COUNT} 정수여야 한다`, { received: source.count });
  }
  const difficulty = source.difficulty === undefined || source.difficulty === '' ? undefined : Number(source.difficulty);
  if (difficulty !== undefined && ![1, 2, 3].includes(difficulty)) {
    throw new HttpError(400, 'difficulty 는 1, 2, 3 중 하나여야 한다', { received: source.difficulty });
  }
  return {
    seed: source.seed === undefined ? undefined : String(source.seed),
    subject: source.subject ?? 'math',
    gradeBands: list(source.grade ?? source.gradeBands),
    domains: list(source.domain ?? source.domains),
    codes: list(source.code ?? source.codes),
    count,
    difficulty,
    title: source.title,
  };
}

/**
 * 그림 문항에 SVG 를 실어 준다.
 * 클라이언트가 spec 을 다시 해석해 그리게 하면 그림과 정답이 어긋날 수 있으므로,
 * 그림은 서버가 그린 것만 정본으로 쓴다.
 */
function attachFigureSvg(item) {
  if (!item.figure || !hasSvgRenderer(item.figure.kind)) return item;
  return { ...item, figure: { ...item.figure, svg: renderFigureSvg(item.figure) } };
}

/** 학습자에게 내려보내는 형태. 정답·풀이·params 를 지운다. */
function stripAnswers(worksheet) {
  return {
    ...worksheet,
    items: worksheet.items.map((item) => {
      const { answer, solution, params, dedupeKey, ...rest } = attachFigureSvg(item);
      return {
        ...rest,
        ...(rest.choices ? { choices: rest.choices.map(({ correct, ...c }) => c) } : {}),
      };
    }),
  };
}

export function createApp({ spine, registry }) {
  const coverage = buildCoverage(spine, registry);
  const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));

  const routes = [
    {
      method: 'GET',
      path: '/health',
      handle: () => ({
        status: 'ok',
        upstream: spine.upstream.taxonomyVersion,
        standards: spine.standardCount,
        generators: registry.size,
        coverageRatio: coverage.coverageRatio,
      }),
    },
    {
      method: 'GET',
      path: '/v1/subjects',
      handle: () => ({
        subjects: Object.entries(coverage.bySubject).map(([slug, b]) => ({
          subject: slug,
          subjectKorean: b.subjectKorean,
          standardCount: b.total,
          coveredStandards: b.covered,
          coverageRatio: b.coverageRatio,
          domains: Object.entries(b.byDomain).map(([domain, d]) => ({ domain, ...d })),
        })),
      }),
    },
    {
      method: 'GET',
      path: '/v1/standards',
      handle: (_body, url) => {
        const subject = url.searchParams.get('subject');
        const grades = list(url.searchParams.get('grade'));
        const domains = list(url.searchParams.get('domain'));
        const onlyCovered = url.searchParams.get('covered') === 'true';
        const items = spine.standards
          .filter((s) => (!subject || s.subject === subject)
            && (!grades || grades.includes(s.gradeBand))
            && (!domains || domains.includes(s.domain)))
          .map((s) => ({
            code: s.code,
            subject: s.subject,
            subjectKorean: s.subjectKorean,
            gradeBand: s.gradeBand,
            domain: s.domain,
            module: s.module,
            source: { sourceId: s.source.sourceId, pdfPage: s.source.pdfPage, section: s.source.section },
            generatorCount: registry.forStandard(s.code).length,
          }))
          .filter((s) => !onlyCovered || s.generatorCount > 0);
        return { count: items.length, standards: items };
      },
    },
    {
      method: 'GET',
      path: '/v1/generators',
      handle: () => ({
        count: registry.size,
        generators: registry.all().map((g) => ({
          id: g.id,
          standardCode: g.standardCode,
          skill: g.skill,
          format: g.format,
          sourceFile: g.sourceFile,
        })),
      }),
    },
    { method: 'GET', path: '/v1/coverage', handle: () => coverage },
    {
      method: 'POST',
      path: '/v1/worksheets',
      handle: (body, url) => {
        const options = parseWorksheetOptions({ ...body, ...Object.fromEntries(url.searchParams) });
        const worksheet = buildWorksheet(spine, registry, {
          ...options,
          seed: options.seed ?? `ws-${Date.now()}`,
        });
        const includeAnswers = String(body.includeAnswers ?? url.searchParams.get('includeAnswers')) === 'true';
        return includeAnswers
          ? { ...worksheet, items: worksheet.items.map(attachFigureSvg) }
          : stripAnswers(worksheet);
      },
    },
    {
      method: 'POST',
      path: '/v1/items',
      handle: (body) => {
        const code = body.code;
        if (!code) throw new HttpError(400, 'code 는 필수다 (예: [2수01-06])');
        const standard = standardByCode.get(code);
        if (!standard) throw new HttpError(404, `성취기준을 찾을 수 없다: ${code}`);
        const gens = registry.forStandard(code);
        if (gens.length === 0) throw new HttpError(409, `아직 생성기가 없는 성취기준이다: ${code}`, { coverage: '/v1/coverage' });

        const count = Number(body.count ?? 5);
        if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
          throw new HttpError(400, `count 는 1..${MAX_COUNT} 정수여야 한다`);
        }
        const difficulty = Number(body.difficulty ?? 2);
        if (![1, 2, 3].includes(difficulty)) throw new HttpError(400, 'difficulty 는 1, 2, 3 중 하나여야 한다');

        const seed = String(body.seed ?? `items-${Date.now()}`);
        const rng = createRng(seed);
        const items = [];
        const seen = new Set();
        for (let attempt = 0; attempt < count * 40 && items.length < count; attempt += 1) {
          const g = gens[attempt % gens.length];
          const item = generateItem(g, standard, rng, difficulty);
          if (seen.has(item.dedupeKey)) continue;
          seen.add(item.dedupeKey);
          items.push(item);
        }
        return { seed, code, requested: count, produced: items.length, items: items.map(attachFigureSvg) };
      },
    },
    {
      method: 'POST',
      path: '/v1/grade',
      handle: (body) => {
        if (!body.seed) throw new HttpError(400, 'seed 는 필수다. 학습지를 다시 만들어 대조한다');
        if (!body.responses || typeof body.responses !== 'object') {
          throw new HttpError(400, 'responses 는 {문항번호: 답} 객체여야 한다');
        }
        const options = parseWorksheetOptions(body);
        const worksheet = buildWorksheet(spine, registry, { ...options, seed: String(body.seed) });
        return gradeWorksheet(worksheet, body.responses);
      },
    },
    {
      method: 'GET',
      path: '/v1/prerequisites',
      handle: (_body, url) => {
        const code = url.searchParams.get('code');
        if (!code) {
          return {
            standardCount: Object.keys(MATH_PREREQUISITES).length,
            note: '이 저장소가 저작한 추천 순서다. 보편 법칙이 아니다.',
            learningOrder: learningOrder(),
            graph: MATH_PREREQUISITES,
          };
        }
        if (!Object.hasOwn(MATH_PREREQUISITES, code)) {
          throw new HttpError(404, `선수 관계를 모르는 성취기준: ${code}`);
        }
        return {
          code,
          direct: MATH_PREREQUISITES[code],
          // 먼 선수부터. 복습은 여기 앞쪽부터 시작한다.
          ancestors: ancestorsOf(code),
          dependents: dependentsOf(code),
        };
      },
    },
    {
      method: 'POST',
      path: '/v1/remediation',
      /**
       * 채점 결과의 취약 성취기준을 복습 학습지로 바꾼다.
       *
       * 취약 기준을 다시 내는 것만으로는 부족하다. 두 자리 덧셈이 안 되는데
       * 분수의 덧셈을 반복시키면 같은 자리에서 계속 막힌다. 선수를 거슬러
       * 올라가 먼저 배워야 하는 것부터 낸다.
       */
      handle: (body) => {
        const weak = list(body.weakStandards ?? body.codes);
        if (!weak || weak.length === 0) {
          throw new HttpError(400, 'weakStandards 는 성취기준 코드 배열이어야 한다', {
            example: { weakStandards: ['[6수01-08]'], count: 10 },
          });
        }
        const unknown = weak.filter((c) => !Object.hasOwn(MATH_PREREQUISITES, c));
        if (unknown.length > 0) {
          throw new HttpError(404, `선수 관계를 모르는 성취기준: ${unknown.join(', ')}`);
        }

        const depth = Number(body.depth ?? 2);
        if (!Number.isInteger(depth) || depth < 1 || depth > 6) {
          throw new HttpError(400, 'depth 는 1..6 정수여야 한다');
        }

        // 선수를 모으고 학습 순서로 정렬한다. 생성기가 없는 기준은 낼 수 없다.
        const prerequisiteSet = new Set();
        for (const code of weak) {
          for (const p of ancestorsOf(code, { maxDepth: depth })) prerequisiteSet.add(p);
        }
        for (const code of weak) prerequisiteSet.delete(code);

        const generatable = (code) => registry.forStandard(code).length > 0;
        const plan = learningOrder([...prerequisiteSet, ...weak]).map((code) => ({
          code,
          role: weak.includes(code) ? 'target' : 'prerequisite',
          hasGenerator: generatable(code),
          domain: standardByCode.get(code)?.domain ?? null,
          gradeBand: standardByCode.get(code)?.gradeBand ?? null,
        }));

        const usable = plan.filter((p) => p.hasGenerator).map((p) => p.code);
        if (usable.length === 0) {
          throw new HttpError(409, '복습에 쓸 생성기가 없다', { plan });
        }

        const options = parseWorksheetOptions({ ...body, codes: usable });
        const worksheet = buildWorksheet(spine, registry, {
          ...options,
          seed: options.seed ?? `remediation-${Date.now()}`,
          // 복습은 선수부터 풀려야 하므로 학습 순서를 따른다.
          followLearningOrder: true,
          title: body.title ?? `복습 학습지 (${weak.join(', ')} 선수 포함)`,
        });
        const includeAnswers = String(body.includeAnswers) === 'true';

        return {
          weakStandards: weak,
          depth,
          plan,
          skipped: plan.filter((p) => !p.hasGenerator).map((p) => p.code),
          worksheet: includeAnswers
            ? { ...worksheet, items: worksheet.items.map(attachFigureSvg) }
            : stripAnswers(worksheet),
        };
      },
    },
  ];

  return async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const route = routes.find((r) => r.path === url.pathname && r.method === req.method);

    if (!route) {
      const known = routes.map((r) => `${r.method} ${r.path}`);
      json(res, 404, { error: '없는 엔드포인트', path: `${req.method} ${url.pathname}`, endpoints: known });
      return;
    }

    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      json(res, 200, route.handle(body, url));
    } catch (error) {
      if (error instanceof HttpError) {
        json(res, error.status, { error: error.message, detail: error.detail ?? null });
        return;
      }
      // 검산 실패는 생성기 버그다. 조용히 넘기지 않고 500으로 드러낸다.
      json(res, 500, { error: '문항 생성 실패', message: error.message });
    }
  };
}
