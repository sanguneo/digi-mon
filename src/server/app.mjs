import { timingSafeEqual } from 'node:crypto';
import {
  LearningGateRequestError,
  recommendLearningGate,
} from '../curriculum/learning-gate.mjs';
import { generatorSupportsModes } from '../curriculum/practice-modes.mjs';
import {
  ancestorsOf,
  approvedAncestorsOf,
  dependentsOf,
  directPrerequisiteAssertions,
  learningOrder,
  MATH_PREREQUISITES,
  prerequisiteGraphAssertions,
} from '../curriculum/prerequisites.mjs';
import { learnerFigure } from '../engine/item.mjs';
import { learnerLearningSupport } from '../curriculum/learning-support.mjs';
import {
  normalizeExcludeItemIds,
  parseWorksheetOptions,
  WorksheetOptionsError,
} from '../engine/options.mjs';
import { buildCoverage } from '../engine/registry.mjs';
import {
  aggregateAccuracy,
  aggregateByStandard,
  findDifficultyInversions,
  MIN_SAMPLES,
  recordsFromGrading,
  validateResponseRecords,
} from '../engine/response-log.mjs';
import { createRng } from '../engine/rng.mjs';
import {
  buildWorksheet,
  generateItem,
  WorksheetTargetError,
} from '../engine/worksheet.mjs';
import {
  buildWorksheetFormSet,
  MAX_WORKSHEET_FORMS,
  WorksheetFormPoolError,
} from '../engine/worksheet-forms.mjs';
import { hasSvgRenderer, renderFigureSvg } from '../render/figure-svg.mjs';
import { gradeWorksheet } from './grade.mjs';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_COUNT = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 120;

/**
 * 윈도당 생성 비용 상한.
 *
 * 요청 수만 세면 20문항 1형과 100문항 8형이 같은 한 건이다. 뒤엣것은 앞엣것보다
 * 수십 배 비싸서, 분당 120요청 허용은 단일 IP 가 단일 스레드 서버의 CPU 를 분당
 * 수십 초 태울 수 있다는 뜻이었다(최악 요청 실측 0.73초 × 120 ≈ 88초).
 *
 * 비용은 count × max(1, formCount) — 서버가 만들어야 하는 문항 수다. 상한 3,000 은
 * 정상 교사 사용을 막지 않는 값으로 잡았다: 20문항 3형(비용 60)이면 분당 50회,
 * 100문항 1형(비용 100)이면 분당 30회다. 반대로 최악 요청(100문항 8형, 비용 800)은
 * 분당 3회로 묶여 CPU 점유가 88초에서 2초 아래로 떨어진다.
 */
const RATE_LIMIT_COST = 3_000;

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
    let tooLarge = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new HttpError(413, '요청 본문이 너무 크다'));
        return;
      }
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

function json(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function list(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

function httpWorksheetOptions(source) {
  try {
    return parseWorksheetOptions(source, { maxCount: MAX_COUNT });
  } catch (error) {
    if (error instanceof WorksheetOptionsError) {
      throw new HttpError(400, error.message, {
        field: error.field,
        received: error.received,
      });
    }
    throw error;
  }
}

function httpExcludeItemIds(value) {
  try {
    return normalizeExcludeItemIds(value);
  } catch (error) {
    if (error instanceof WorksheetOptionsError) {
      throw new HttpError(400, error.message, {
        field: error.field,
        received: error.received,
      });
    }
    throw error;
  }
}

function httpFormCount(value) {
  const formCount = Number(value ?? 3);
  if (!Number.isInteger(formCount)
    || formCount < 2
    || formCount > MAX_WORKSHEET_FORMS) {
    throw new HttpError(
      400,
      `formCount 는 2..${MAX_WORKSHEET_FORMS} 정수여야 한다`,
      { received: value },
    );
  }
  return formCount;
}

/** worksheet.schema.json 의 formSet 정의가 선언한 필드 전부. 그 밖은 거부한다. */
const FORM_PROVENANCE_KEYS = ['schema', 'seed', 'label', 'formCount', 'blueprintAttempt', 'fingerprint'];

function worksheetForGrading(spine, registry, body, options) {
  if (body.formSet === undefined) {
    return buildWorksheet(spine, registry, { ...options, seed: String(body.seed) });
  }
  const provenance = body.formSet;
  /**
   * 런타임 검사라 ajv 를 쓰지 않는다(런타임 의존성 0개). 대신 제약을
   * worksheet.schema.json 의 formSet 정의와 글자 그대로 맞춘다.
   *
   * 맞추기 전에는 이 검사가 스키마보다 느슨했다 — 빈 seed, 범위 밖 formCount,
   * 음수 blueprintAttempt, 모르는 필드를 통과시켰고, formCount 99 는 엔진의 일반
   * Error 로 번져 사용자 입력이 500 을 냈다. 두 계약이 갈리지 않는지는
   * test/server/response-schemas.test.mjs 가 양방향으로 대조한다.
   */
  if (!provenance
    || typeof provenance !== 'object'
    || Array.isArray(provenance)
    || Object.keys(provenance).some((key) => !FORM_PROVENANCE_KEYS.includes(key))
    || provenance.schema !== 'digi-mon/worksheet-form@1'
    || typeof provenance.seed !== 'string'
    || provenance.seed.length === 0
    || !/^[A-H]$/.test(provenance.label)
    || !Number.isInteger(provenance.formCount)
    || provenance.formCount < 2
    || provenance.formCount > MAX_WORKSHEET_FORMS
    || !Number.isInteger(provenance.blueprintAttempt)
    || provenance.blueprintAttempt < 0
    || !/^[a-f0-9]{64}$/.test(provenance.fingerprint ?? '')) {
    throw new HttpError(400, 'formSet provenance 형식이 올바르지 않다');
  }
  const formSet = buildWorksheetFormSet(spine, registry, {
    ...options,
    seed: provenance.seed,
    formCount: provenance.formCount,
  });
  if (formSet.fingerprint !== provenance.fingerprint
    || formSet.blueprintAttempt !== provenance.blueprintAttempt) {
    throw new HttpError(409, 'formSet provenance 가 현재 생성 결과와 일치하지 않는다');
  }
  const form = formSet.forms.find(({ label }) => label === provenance.label);
  if (!form) {
    throw new HttpError(400, `formSet 에 없는 form label이다: ${provenance.label}`);
  }
  return form.worksheet;
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

function stripItemAnswers(item) {
  const {
    answer,
    solution,
    params,
    dedupeKey,
    ...rest
  } = attachFigureSvg(item);
  const projectedFigure = rest.figure ? learnerFigure(rest.figure) : null;
  const learnerDeliveryFigure = projectedFigure
    ? (({ spec, ...figure }) => figure)(projectedFigure)
    : null;
  const projectedLearningSupport = learnerLearningSupport(rest.learningSupport);
  return {
    ...rest,
    ...(projectedLearningSupport ? { learningSupport: projectedLearningSupport } : {}),
    ...(rest.choices
      ? { choices: rest.choices.map(({ correct, ...choice }) => choice) }
      : {}),
    ...(learnerDeliveryFigure ? { figure: learnerDeliveryFigure } : {}),
  };
}

/** 학습자에게 내려보내는 형태. 정답·풀이·params 를 지운다. */
function stripAnswers(worksheet) {
  return {
    ...worksheet,
    items: worksheet.items.map(stripItemAnswers),
  };
}

function sameSecret(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isTeacher(req, teacherToken) {
  const authorization = req.headers.authorization ?? '';
  const provided = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
  return sameSecret(provided, teacherToken);
}

function requireTeacher(req, teacherToken) {
  if (!teacherToken) {
    throw new HttpError(403, '교사용 정답 접근이 비활성화되어 있다');
  }
  if (!isTeacher(req, teacherToken)) {
    throw new HttpError(403, '교사용 인증이 필요하다');
  }
}

function stripGradingFeedback(grading) {
  return {
    ...grading,
    results: grading.results.map(({ expected, solution, submitted, ...result }) => result),
    manualScoring: grading.manualScoring.map(({ rubric, submitted, ...result }) => result),
  };
}

function validateManualEvaluations(value, worksheet) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'manualEvaluations 는 {문항번호: {criteria: boolean[]}} 객체여야 한다');
  }

  const itemByNumber = new Map(worksheet.items.map((item) => [String(item.number), item]));
  for (const [number, evaluation] of Object.entries(value)) {
    const item = itemByNumber.get(number);
    if (!item) {
      throw new HttpError(400, '학습지에 없는 문항 번호가 manualEvaluations 에 있다', {
        invalidNumbers: [number],
      });
    }
    if (item.scoring !== 'manual') {
      throw new HttpError(400, '자동 채점 문항은 manualEvaluations 로 평가할 수 없다', {
        itemNumber: number,
      });
    }
    if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation)
      || Object.keys(evaluation).length !== 1
      || !Object.hasOwn(evaluation, 'criteria')) {
      throw new HttpError(400, '수동 평가는 criteria 불리언 배열만 포함해야 한다', {
        itemNumber: number,
      });
    }
    if (!Array.isArray(evaluation.criteria)
      || evaluation.criteria.some((met) => typeof met !== 'boolean')) {
      throw new HttpError(400, 'manualEvaluations.criteria 는 불리언 배열이어야 한다', {
        itemNumber: number,
      });
    }
    if (evaluation.criteria.length !== item.answer.rubric.length) {
      throw new HttpError(400, 'manualEvaluations.criteria 길이는 문항 rubric 길이와 같아야 한다', {
        itemNumber: number,
        expected: item.answer.rubric.length,
        received: evaluation.criteria.length,
      });
    }
  }
}

/**
 * 맵 항목 수 상한. 만료 청소만으로는 한 윈도 안에 유니크 IP 가 대량 유입될 때
 * 지울 것이 없어 맵이 무한히 큰다. 만료분을 먼저 지우고, 그래도 상한을 넘으면
 * 가장 오래된 항목부터 버린다. Map 은 삽입 순서를 지키므로 앞쪽이 가장 오래됐다.
 */
const RATE_LIMIT_MAX_CLIENTS = 10_000;

/**
 * 요청 수와 생성 비용을 함께 세는 리미터.
 *
 * admit 은 요청 진입 시점(본문을 읽기 전)이라 비용을 모른다. 그래서 두 단계다 —
 * 진입에서 요청 수를 세고, 라우트가 옵션을 파싱한 뒤 charge 로 실제 비용을 청구한다.
 * 이미 시작한 요청을 중간에 끊지는 않는다. 비용을 넘긴 IP 는 그 다음 요청부터 429 다.
 */
function createRateLimiter() {
  const clients = new Map();

  const entryFor = (key, now) => {
    const current = clients.get(key);
    if (current && now - current.startedAt < RATE_LIMIT_WINDOW_MS) return current;
    const fresh = { startedAt: now, count: 0, cost: 0 };
    clients.set(key, fresh);
    if (clients.size > RATE_LIMIT_MAX_CLIENTS) {
      for (const [client, entry] of clients) {
        if (now - entry.startedAt >= RATE_LIMIT_WINDOW_MS) clients.delete(client);
      }
      for (const client of clients.keys()) {
        if (clients.size <= RATE_LIMIT_MAX_CLIENTS) break;
        if (client !== key) clients.delete(client);
      }
    }
    return fresh;
  };

  return {
    admit(key, now = Date.now()) {
      const entry = entryFor(key, now);
      entry.count += 1;
      return entry.count <= RATE_LIMIT_REQUESTS && entry.cost <= RATE_LIMIT_COST;
    },
    charge(key, cost, now = Date.now()) {
      entryFor(key, now).cost += cost;
    },
  };
}

/** 요청 하나가 서버에 시키는 문항 생성량. 리밋은 이 값을 센다. */
function generationCost({ count = 20 } = {}, formCount = 1) {
  return count * Math.max(1, formCount);
}

export function createApp({
  spine,
  registry,
  teacherToken = process.env.TEACHER_TOKEN ?? null,
}) {
  const coverage = buildCoverage(spine, registry);
  const standardByCode = new Map(spine.standards.map((s) => [s.code, s]));
  const rateLimiter = createRateLimiter();
  const chargeGeneration = (req, options, formCount = 1) => {
    rateLimiter.charge(req.socket.remoteAddress ?? 'unknown', generationCost(options, formCount));
  };

  const routes = [
    {
      method: 'GET',
      path: '/health',
      handle: () => ({
        status: 'ok',
        corpus: spine.corpus.schema,
        standards: spine.standardCount,
        generators: registry.size,
        coverageRatio: coverage.coverageRatio,
      }),
    },
    // LB·k8s 프로브는 HEAD 로 살아 있는지 묻는다. 몸통 없이 200 만 돌려준다.
    { method: 'HEAD', path: '/health', handle: () => ({}) },
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
          learningSupportStatus: g.learningGuide ? 'guided-candidate' : 'objective-only',
          sourceFile: g.sourceFile,
        })),
      }),
    },
    { method: 'GET', path: '/v1/coverage', handle: () => coverage },
    {
      method: 'POST',
      path: '/v1/worksheets',
      handle: (body, url, req) => {
        const source = { ...Object.fromEntries(url.searchParams), ...body };
        const options = httpWorksheetOptions(source);
        chargeGeneration(req, options);
        const worksheet = buildWorksheet(spine, registry, {
          ...options,
          seed: options.seed ?? `ws-${Date.now()}`,
        });
        if (worksheet.shortfall > 0) {
          throw new HttpError(409, '요청한 수만큼 고유 문항을 만들 수 없다', {
            requested: worksheet.requested,
            produced: worksheet.produced,
            shortfall: worksheet.shortfall,
          });
        }
        const includeAnswers = String(source.includeAnswers) === 'true';
        if (includeAnswers) requireTeacher(req, teacherToken);
        return includeAnswers
          ? { ...worksheet, items: worksheet.items.map(attachFigureSvg) }
          : stripAnswers(worksheet);
      },
    },
    {
      method: 'POST',
      path: '/v1/worksheet-forms',
      handle: (body, url, req) => {
        const source = { ...Object.fromEntries(url.searchParams), ...body };
        const options = httpWorksheetOptions(source);
        const formCount = httpFormCount(source.formCount);
        chargeGeneration(req, options, formCount);
        const formSet = buildWorksheetFormSet(spine, registry, {
          ...options,
          seed: options.seed ?? `forms-${Date.now()}`,
          formCount,
        });
        const includeAnswers = String(source.includeAnswers) === 'true';
        if (includeAnswers) requireTeacher(req, teacherToken);
        return {
          ...formSet,
          forms: formSet.forms.map(({ label, worksheet }) => ({
            label,
            worksheet: includeAnswers
              ? { ...worksheet, items: worksheet.items.map(attachFigureSvg) }
              : stripAnswers(worksheet),
          })),
        };
      },
    },
    {
      method: 'POST',
      path: '/v1/items',
      handle: (body, _url, req) => {
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

        chargeGeneration(req, { count });
        const seed = String(body.seed ?? `items-${Date.now()}`);
        const rng = createRng(seed);
        const items = [];
        const excludeItemIds = httpExcludeItemIds(body.excludeItemIds);
        const excludedItemIdSet = new Set(excludeItemIds);
        const seen = new Set();
        for (let attempt = 0; attempt < count * 40 && items.length < count; attempt += 1) {
          const g = gens[attempt % gens.length];
          const item = generateItem(g, standard, rng, difficulty);
          if (excludedItemIdSet.has(item.id) || seen.has(item.dedupeKey)) continue;
          seen.add(item.dedupeKey);
          items.push(item);
        }
        if (items.length < count) {
          throw new HttpError(409, '요청한 수만큼 고유 문항을 만들 수 없다', {
            requested: count,
            produced: items.length,
          });
        }
        const includeAnswers = String(body.includeAnswers) === 'true';
        if (includeAnswers) requireTeacher(req, teacherToken);
        return {
          seed,
          code,
          requested: count,
          produced: items.length,
          items: includeAnswers
            ? items.map(attachFigureSvg)
            : items.map(stripItemAnswers),
        };
      },
    },
    {
      method: 'POST',
      path: '/v1/learning-gate',
      handle: (body) => {
        let recommendation;
        try {
          recommendation = recommendLearningGate(body);
        } catch (error) {
          if (error instanceof LearningGateRequestError) {
            throw new HttpError(400, error.message, {
              field: error.field,
              received: error.received,
            });
          }
          throw error;
        }
        const targetCodes = [
          ...body.target.codes,
          ...(body.target.advanceToCodes ?? []),
        ];
        const unknown = targetCodes.filter((code) => !standardByCode.has(code));
        if (unknown.length > 0) {
          throw new HttpError(404, `성취기준을 찾을 수 없다: ${unknown.join(', ')}`);
        }
        const wrongSubject = targetCodes.filter((code) =>
          standardByCode.get(code).subject !== body.target.subject);
        if (wrongSubject.length > 0) {
          throw new HttpError(400, 'target.subject 와 성취기준 교과가 다르다', {
            codes: wrongSubject,
          });
        }
        const unavailable = targetCodes.filter((code) =>
          !registry.forStandard(code).some((generator) =>
            generatorSupportsModes(generator, body.target.modes ?? [])));
        if (unavailable.length > 0) {
          throw new HttpError(409, '요청한 mode로 발급할 수 없는 성취기준이 있다', {
            codes: unavailable,
            modes: body.target.modes ?? [],
          });
        }
        return recommendation;
      },
    },
    {
      method: 'POST',
      path: '/v1/grade',
      handle: (body, _url, req) => {
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new HttpError(400, '요청 본문은 객체여야 한다');
        }
        if (!body.seed) throw new HttpError(400, 'seed 는 필수다. 학습지를 다시 만들어 대조한다');
        if (!body.fingerprint || typeof body.fingerprint !== 'string') {
          throw new HttpError(400, 'fingerprint 는 필수다. 발급된 학습지와 같은지 확인한다');
        }
        if (!body.responses || typeof body.responses !== 'object' || Array.isArray(body.responses)) {
          throw new HttpError(400, 'responses 는 {문항번호: 답} 객체여야 한다');
        }
        if (body.elapsedMs !== undefined
          && (!body.elapsedMs || typeof body.elapsedMs !== 'object' || Array.isArray(body.elapsedMs))) {
          throw new HttpError(400, 'elapsedMs 는 {문항번호: 밀리초} 객체여야 한다');
        }
        if (body.elapsedMs !== undefined
          && Object.values(body.elapsedMs).some((value) =>
            !Number.isFinite(Number(value)) || Number(value) < 0)) {
          throw new HttpError(400, 'elapsedMs 값은 0 이상의 유한한 밀리초여야 한다');
        }
        if (body.learnerId !== undefined
          && (typeof body.learnerId !== 'string'
            || body.learnerId.length < 1
            || body.learnerId.length > 128
            || !/^[A-Za-z0-9._:-]+$/.test(body.learnerId))) {
          throw new HttpError(400, 'learnerId 는 개인정보가 아닌 1..128자 영숫자 토큰이어야 한다');
        }
        if (body.at !== undefined
          && body.at !== null
          && (typeof body.at !== 'string'
            || body.at.length > 35
            || Number.isNaN(Date.parse(body.at))
            || new Date(body.at).toISOString() !== body.at)) {
          throw new HttpError(400, 'at 은 ISO 8601 UTC 시각 문자열이어야 한다');
        }
        const options = httpWorksheetOptions(body);
        // 채점은 학습지를 다시 만들어 대조한다. formSet 채점이면 form set 전체를
        // 재생성하므로 발급과 같은 비용이다.
        chargeGeneration(req, options, Number(body.formSet?.formCount) || 1);
        const worksheet = worksheetForGrading(spine, registry, body, options);
        if (worksheet.fingerprint !== body.fingerprint) {
          throw new HttpError(409, '학습지 fingerprint 가 일치하지 않는다', {
            expected: worksheet.fingerprint,
            received: body.fingerprint,
          });
        }
        const validNumbers = new Set(worksheet.items.map((item) => String(item.number)));
        const invalidNumbers = Object.keys(body.responses).filter((number) => !validNumbers.has(number));
        if (invalidNumbers.length > 0) {
          throw new HttpError(400, '학습지에 없는 문항 번호가 responses 에 있다', {
            invalidNumbers,
          });
        }
        if (body.manualEvaluations !== undefined) {
          validateManualEvaluations(body.manualEvaluations, worksheet);
          requireTeacher(req, teacherToken);
        }
        const grading = gradeWorksheet(worksheet, body.responses, body.manualEvaluations);

        /**
         * 응답 기록을 함께 돌려준다.
         *
         * 난이도를 손으로 정한 값이 아니라 실측 정답률로 보정하려면 응답이 쌓여야
         * 한다. 저장은 엔진 밖 관심사이므로 여기서는 기록을 만들어 넘기기만 한다.
         * records=false 로 끌 수 있다.
         *
         * 이 배선이 없던 동안 response-log.mjs 는 어떤 진입점에서도 도달하지 않는
         * 죽은 모듈이었다.
         */
        const includeFeedback = String(body.includeFeedback) === 'true';
        if (includeFeedback) requireTeacher(req, teacherToken);
        const visibleGrading = includeFeedback ? grading : stripGradingFeedback(grading);
        if (String(body.records) === 'false') return visibleGrading;
        const responseRecords = recordsFromGrading(worksheet, grading, {
          learnerId: body.learnerId ?? null,
          at: body.at ?? null,
          elapsedMs: body.elapsedMs ?? null,
        });
        return {
          ...visibleGrading,
          responseRecords: includeFeedback
            ? responseRecords
            : responseRecords.map(({ dedupeKey, ...record }) => record),
        };
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
            assertions: prerequisiteGraphAssertions(),
          };
        }
        if (!Object.hasOwn(MATH_PREREQUISITES, code)) {
          throw new HttpError(404, `선수 관계를 모르는 성취기준: ${code}`);
        }
        return {
          code,
          direct: MATH_PREREQUISITES[code],
          directAssertions: directPrerequisiteAssertions(code),
          // 먼 선수부터. 복습은 여기 앞쪽부터 시작한다.
          ancestors: ancestorsOf(code),
          dependents: dependentsOf(code),
        };
      },
    },
    {
      method: 'POST',
      path: '/v1/accuracy',
      /**
       * 누적 응답 기록에서 정답률을 집계하고 난이도 역전을 지목한다.
       *
       * 클라이언트가 /v1/grade 의 responseRecords 를 모아 두고 여기에 넣는다.
       * 엔진은 저장하지 않으므로 누적은 호출자 몫이다.
       *
       * 값을 자동으로 바꾸지 않는다. 표본이 적을 때 자동 보정하면 우연을 난이도로
       * 굳혀 버린다. 난이도는 파라미터 범위·받아올림 유무 같은 설계 결정이라
       * 숫자만 고쳐서는 문항이 실제로 쉬워지지 않는다.
       */
      handle: (body, _url, req) => {
        if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.records)) {
          throw new HttpError(400, 'records 는 /v1/grade 가 준 responseRecords 배열이어야 한다');
        }
        try {
          validateResponseRecords(body.records);
        } catch (error) {
          throw new HttpError(400, error.message);
        }
        requireTeacher(req, teacherToken);
        const byGenerator = aggregateAccuracy(body.records);
        const byStandard = aggregateByStandard(body.records);
        return {
          recordCount: body.records.length,
          minSamplesForAccuracy: MIN_SAMPLES,
          // 표본이 모자란 칸은 accuracy 가 null 이다. 세 번 풀어 두 번 맞은 것을
          // 0.67 이라고 부르면 숫자가 사실보다 세 보인다.
          byGenerator,
          byStandard,
          difficultyInversions: findDifficultyInversions(byGenerator),
          weakStandards: byStandard.filter((s) => s.sufficientSamples && s.accuracy < 0.6),
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
      handle: (body, _url, req) => {
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
        const excludedCandidateSet = new Set();
        for (const code of weak) {
          for (const prerequisite of approvedAncestorsOf(code, { maxDepth: depth })) {
            prerequisiteSet.add(prerequisite);
          }
          for (const candidate of ancestorsOf(code, { maxDepth: depth })) {
            if (!prerequisiteSet.has(candidate)) excludedCandidateSet.add(candidate);
          }
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

        const options = httpWorksheetOptions({
          ...body,
          codes: usable,
          subject: 'math',
          followLearningOrder: false,
        });
        chargeGeneration(req, options);
        const worksheet = buildWorksheet(spine, registry, {
          ...options,
          seed: options.seed ?? `remediation-${Date.now()}`,
          // 전문가 승인 간선만 운영한다. 현재 후보 간선은 순서를 바꾸지 않는다.
          followLearningOrder: false,
          title: body.title ?? `복습 학습지 (${weak.join(', ')} 선수 포함)`,
        });
        if (worksheet.shortfall > 0) {
          throw new HttpError(409, '요청한 수만큼 복습 문항을 만들 수 없다', {
            requested: worksheet.requested,
            produced: worksheet.produced,
            shortfall: worksheet.shortfall,
          });
        }
        const includeAnswers = String(body.includeAnswers) === 'true';
        if (includeAnswers) requireTeacher(req, teacherToken);

        return {
          weakStandards: weak,
          depth,
          prerequisitePolicy: 'approved-only',
          excludedCandidateCount: excludedCandidateSet.size,
          excludedCandidateStandards: [...excludedCandidateSet].sort(),
          plan,
          prerequisiteAssertions: prerequisiteGraphAssertions(plan.map((entry) => entry.code))
            .filter((assertion) => plan.some((entry) => entry.code === assertion.prerequisite)),
          skipped: plan.filter((p) => !p.hasGenerator).map((p) => p.code),
          worksheet: includeAnswers
            ? { ...worksheet, items: worksheet.items.map(attachFigureSvg) }
            : stripAnswers(worksheet),
        };
      },
    },
  ];

  return async function handler(req, res) {
    try {
      const client = req.socket.remoteAddress ?? 'unknown';
      if (!rateLimiter.admit(client)) {
        json(res, 429, { error: '요청이 너무 많다. 잠시 후 다시 시도하라' }, {
          'retry-after': String(RATE_LIMIT_WINDOW_MS / 1000),
        });
        return;
      }

      let url;
      try {
        url = new URL(req.url, 'http://localhost');
      } catch {
        throw new HttpError(400, '요청 URL 형식이 올바르지 않다');
      }

      const samePath = routes.filter((candidate) => candidate.path === url.pathname);
      const route = samePath.find((candidate) => candidate.method === req.method);
      if (!route) {
        if (samePath.length > 0) {
          const allowed = samePath.map((candidate) => candidate.method);
          json(res, 405, {
            error: '허용되지 않은 HTTP 메서드',
            path: `${req.method} ${url.pathname}`,
            allowed,
          }, { allow: allowed.join(', ') });
          return;
        }
        const known = routes.map((candidate) => `${candidate.method} ${candidate.path}`);
        json(res, 404, {
          error: '없는 엔드포인트',
          path: `${req.method} ${url.pathname}`,
          endpoints: known,
        });
        return;
      }

      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        });
        res.end();
        return;
      }

      const body = req.method === 'POST' ? await readBody(req) : {};
      json(res, 200, await route.handle(body, url, req));
    } catch (error) {
      if (error instanceof HttpError) {
        json(res, error.status, { error: error.message, detail: error.detail ?? null });
        return;
      }
      if (error instanceof WorksheetFormPoolError) {
        json(res, 409, { error: error.message, detail: null });
        return;
      }
      // 옵션 형식은 옳지만 가리키는 성취기준이 없는 요청이다. 클라이언트 잘못이므로
      // 404 로 낸다. 학습지 발급·form 발급·복습·채점 재생성이 모두 이 경로를 탄다.
      if (error instanceof WorksheetTargetError) {
        json(res, 404, { error: error.message, detail: error.detail ?? null });
        return;
      }
      // 검산 실패는 생성기 버그다. 조용히 넘기지 않고 500으로 드러낸다.
      console.error('요청 처리 실패:', error);
      json(res, 500, { error: '내부 처리 실패' });
    }
  };
}
