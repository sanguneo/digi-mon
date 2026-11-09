import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorStandard, loadSpine, summarizeRejections, targetStandards } from '../../src/authoring/pipeline.mjs';
import { createLlmClient, llmConfigFromEnv, parseCandidates } from '../../src/authoring/llm.mjs';
import { lintWithGgw } from '../../src/authoring/ggw.mjs';
import { isOfficialEnglishWord } from '../../src/authoring/english-official.mjs';
import { AUTHORED_SCHEMA, authoredGeneratorId, loadAuthoredCorpus } from '../../src/generators/authored.mjs';
import { createRegistry } from '../../src/engine/registry.mjs';
import { buildWorksheet } from '../../src/engine/worksheet.mjs';
import { createApp } from '../../src/server/app.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPINE = loadSpine();
const KOREAN = targetStandards(SPINE, { subject: 'korean', standard: '4국02-04' })[0];
const ENGLISH = targetStandards(SPINE, { subject: 'english', standard: '4영01-05' })[0];

const tmpRoot = () => mkdtempSync(path.join(os.tmpdir(), 'digimon-authored-'));
const fakeClient = (...responses) => {
  const calls = [];
  return {
    model: 'fake-model',
    calls,
    async complete(messages) {
      calls.push(messages);
      return responses[Math.min(calls.length - 1, responses.length - 1)];
    },
  };
};
/** 문장에 '아니라' 가 있으면 GGW 부정재정의로 지적하는 가짜 린터. 실제 린터의 판정 꼴을 따른다. */
const fakeLint = async (entries) => {
  const flagged = new Map();
  for (const e of entries) {
    if (e.texts.some((t) => t.includes('아니라'))) flagged.set(e.id, [{ gate: 'ggw', detail: "부정재정의: '아니라'" }]);
  }
  return { status: 'ran', mode: 'post-edit', flagged, notes: new Map() };
};

const FACT = {
  difficulty: 1,
  instruction: '다음 문장이 사실인지 의견인지 고르시오.',
  stem: '우리 집 강아지는 다리가 네 개입니다.',
  answer: '사실',
  distractors: ['의견', '질문', '명령'],
  solution: ['다리 수는 세어 보면 확인할 수 있다.', '그러므로 사실을 나타내는 문장이다.'],
};
const OPINION = {
  ...FACT,
  difficulty: 2,
  stem: '여름은 가장 즐거운 계절입니다.',
  answer: '의견',
  distractors: ['사실', '질문', '명령'],
  solution: ["'즐겁다'는 사람마다 다르게 느낀다.", '그러므로 의견을 나타내는 문장이다.'],
};
const KOREAN_BATCH = JSON.stringify({
  items: [
    FACT,
    OPINION,
    { ...FACT, stem: '우리 학교 운동장은 넓습니다.', solution: ["'사실'는 확인할 수 있는 일이다."] },
    { ...FACT, instruction: '다음 문장은 사실입니다. 알맞은 것을 고르시오.', stem: '해는 동쪽에서 뜹니다.' },
    { ...FACT, stem: '바다에는 물고기가 삽니다.', distractors: ['의견', '질문'] },
    { ...FACT, stem: '도서관은 2층에 있습니다.', answer: '의견', distractors: ['의견', '질문', '명령'] },
    { ...OPINION, stem: '이 그림은 단순한 그림이 아니라 멋진 작품입니다.' },
    FACT,
  ],
});

test('fake LLM batch: passing items reach the corpus and each failing gate is named', async () => {
  const root = tmpRoot();
  try {
    const client = fakeClient(KOREAN_BATCH);
    const result = await authorStandard({ standard: KOREAN, count: 10, client, lint: fakeLint, root, maxRounds: 1 });

    assert.deepEqual(result.accepted.map((e) => e.stem), [FACT.stem, OPINION.stem]);
    assert.deepEqual(summarizeRejections(result.rejected), {
      'korean-text': 1, 'answer-leak': 1, schema: 2, ggw: 1, duplicate: 1,
    });
    // 프롬프트에 성취기준과 학년군 어휘가 실린다.
    const prompt = client.calls[0].map((m) => m.content).join('\n');
    assert.ok(prompt.includes('[4국02-04]'));
    assert.ok(prompt.includes('강아지'));

    const corpus = loadAuthoredCorpus(root);
    assert.equal(corpus.length, 1);
    assert.equal(corpus[0].schema, AUTHORED_SCHEMA);
    assert.deepEqual(corpus[0].items.map((i) => i.id), [...corpus[0].items.map((i) => i.id)].sort());
    assert.deepEqual(corpus[0].items[0].provenance, { model: 'fake-model', prompt: 'digi-mon/authoring-prompt@1' });

    // 같은 응답을 다시 받으면 전부 중복으로 떨어지고 파일은 그대로다.
    const before = readFileSync(result.written, 'utf8');
    const again = await authorStandard({ standard: KOREAN, count: 10, client: fakeClient(KOREAN_BATCH), lint: fakeLint, root, maxRounds: 1 });
    assert.equal(again.accepted.length, 0);
    assert.equal(again.written, null);
    assert.equal(readFileSync(result.written, 'utf8'), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('dry-run writes nothing and a broken response is reported, not thrown', async () => {
  const root = tmpRoot();
  try {
    const result = await authorStandard({
      standard: KOREAN, count: 2, client: fakeClient('설명만 있고 JSON 은 없다', KOREAN_BATCH), lint: fakeLint, root, dryRun: true, maxRounds: 2,
    });
    assert.equal(result.rejected[0].reasons[0].gate, 'response');
    assert.equal(result.accepted.length, 2);
    assert.equal(result.written, null);
    assert.deepEqual(loadAuthoredCorpus(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('English candidates are held to the official 800-word list', async () => {
  const batch = JSON.stringify({
    items: [
      {
        difficulty: 1,
        instruction: '문장의 뜻으로 알맞은 것을 고르시오.',
        stem: 'The cat is under the table.',
        answer: '고양이가 탁자 아래에 있습니다.',
        distractors: ['고양이가 탁자 위에 있습니다.', '개가 탁자 아래에 있습니다.', '고양이가 의자 아래에 있습니다.'],
        solution: ["'under'는 아래를 뜻한다."],
      },
      {
        difficulty: 1,
        instruction: '문장의 뜻으로 알맞은 것을 고르시오.',
        stem: 'The elephant is enormous.',
        answer: '코끼리가 아주 큽니다.',
        distractors: ['코끼리가 작습니다.', '말이 아주 큽니다.', '코끼리가 빠릅니다.'],
        solution: ['enormous는 아주 크다는 뜻이다.'],
      },
    ],
  });
  const root = tmpRoot();
  const result = await authorStandard({ standard: ENGLISH, count: 5, client: fakeClient(batch), lint: fakeLint, root, dryRun: true, maxRounds: 1 });
  rmSync(root, { recursive: true, force: true });
  assert.deepEqual(result.accepted.map((e) => e.stem), ['The cat is under the table.']);
  assert.match(result.rejected[0].reasons[0].detail, /enormous/);
  assert.equal(isOfficialEnglishWord('likes'), true);
  assert.equal(isOfficialEnglishWord('stopped'), true);
  assert.equal(isOfficialEnglishWord('is'), true);
});

const FIXTURE = [{
  schema: AUTHORED_SCHEMA,
  subject: 'korean',
  standardCode: '[4국02-04]',
  skill: '사실과 의견을 구분하고 의견 비교하기',
  items: [
    { ...FACT, id: '0000000000a1', provenance: { model: 'fake', prompt: 'p' } },
    { ...OPINION, id: '0000000000a2', provenance: { model: 'fake', prompt: 'p' } },
    { ...OPINION, id: '0000000000a3', stem: '사과가 가장 맛있는 과일입니다.', provenance: { model: 'fake', prompt: 'p' } },
    { ...FACT, id: '0000000000a4', difficulty: 3, stem: '우리 반 학생은 스무 명입니다.', provenance: { model: 'fake', prompt: 'p' } },
  ],
}];
const AUTHORED_ID = authoredGeneratorId('korean', '[4국02-04]');

test('corpus items join the existing generators and the same seed gives the same worksheet', () => {
  const registry = createRegistry({ authoredFiles: FIXTURE });
  assert.ok(registry.forStandard('[4국02-04]').length >= 2);
  assert.equal(registry.get(AUTHORED_ID).standardCode, '[4국02-04]');

  const options = { subject: 'korean', codes: ['[4국02-04]'], seed: 'aigen', count: 6 };
  const a = buildWorksheet(SPINE, registry, options);
  const b = buildWorksheet(SPINE, createRegistry({ authoredFiles: FIXTURE }), options);
  assert.deepEqual(a, b);
  const only = buildWorksheet(SPINE, registry, { ...options, generatorIds: [AUTHORED_ID], count: 4 });
  assert.equal(only.produced, 4);
  assert.deepEqual(new Set(only.items.map((i) => i.params.authoredId)), new Set(FIXTURE[0].items.map((i) => i.id)));
  // 학습지는 코퍼스 밖 정답을 받지 않는다.
  const generator = registry.get(AUTHORED_ID);
  assert.equal(generator.verify({ authoredId: '0000000000a1' }, { value: '의견' }), false);
  assert.equal(generator.verify({ authoredId: 'ffffffffffff' }, { value: '사실' }), false);
});

test('learner worksheet of corpus items carries no answer, solution, params, or correct flag', async () => {
  const server = http.createServer(createApp({ spine: SPINE, registry: createRegistry({ authoredFiles: FIXTURE }), teacherToken: 't' }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/worksheets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'korean', codes: ['[4국02-04]'], generatorIds: [AUTHORED_ID], seed: 'learner', count: 4 }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.items.length, 4);
    const raw = JSON.stringify(body);
    for (const item of body.items) {
      for (const key of ['answer', 'solution', 'params', 'dedupeKey']) assert.equal(Object.hasOwn(item, key), false, key);
      assert.ok(item.choices.every((c) => !Object.hasOwn(c, 'correct')));
    }
    assert.ok(!raw.includes('authoredId'));
    assert.ok(!raw.includes('그러므로'));
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('GGW lint maps sentence hits back to items and skips with a warning when the linter is absent', async () => {
  const entries = [
    { id: 'a', texts: ['이 그림은 단순한 그림이 아니라 멋진 작품입니다.'] },
    { id: 'b', texts: ['받침 ㅎ을 그대로 적는다.'] },
    { id: 'c', texts: ['우리 집 강아지는 다리가 네 개입니다.'] },
  ];
  const run = async (_cmd, args) => ({
    code: 0,
    stderr: '',
    stdout: JSON.stringify(args.includes('--scan')
      ? { mode: 'post-edit' }
      : {
        hits: [
          { family: 'neg-redefine', family_label: '부정재정의', severity: 'high', match: '아니라', sentence: '이 그림은 단순한 그림이 아니라 멋진 작품입니다.' },
          { family: 'metaphor-noun', family_label: '은유명사', severity: 'mid', match: '받침', sentence: '받침 ㅎ을 그대로 적는다.' },
          { family: 'translationese', family_label: '번역투', severity: 'low', match: '네 개', sentence: '우리 집 강아지는 다리가 네 개입니다.' },
        ],
      }),
  });
  const ran = await lintWithGgw(entries, { linterPath: fileURLToPath(import.meta.url), run });
  assert.equal(ran.status, 'ran');
  assert.equal(ran.mode, 'post-edit');
  assert.deepEqual([...ran.flagged.keys()], ['a']);
  assert.deepEqual([...ran.notes.keys()].sort(), ['b', 'c']);

  const skipped = await lintWithGgw(entries, { linterPath: path.join(ROOT, 'no-such-linter.ts') });
  assert.equal(skipped.status, 'skipped');
  assert.match(skipped.warning, /건너뛰었다/);
});

test('LLM client posts an OpenAI-compatible request and keeps the key out of errors', async () => {
  assert.deepEqual(llmConfigFromEnv({}).missing, ['DIGIMON_LLM_BASE_URL', 'DIGIMON_LLM_API_KEY', 'DIGIMON_LLM_MODEL']);
  const config = llmConfigFromEnv({ DIGIMON_LLM_BASE_URL: 'http://llm.test/v1/', DIGIMON_LLM_API_KEY: 'sk-secret', DIGIMON_LLM_MODEL: 'm1' });
  const seen = [];
  const ok = createLlmClient({
    ...config,
    fetchImpl: async (url, init) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ choices: [{ message: { content: '```json\n{"items":[1]}\n```' } }] }));
    },
  });
  assert.deepEqual(parseCandidates(await ok.complete([{ role: 'user', content: 'x' }])), [1]);
  assert.equal(seen[0].url, 'http://llm.test/v1/chat/completions');
  assert.equal(seen[0].init.headers.authorization, 'Bearer sk-secret');
  assert.equal(JSON.parse(seen[0].init.body).model, 'm1');

  const bad = createLlmClient({ ...config, fetchImpl: async () => new Response('bad key sk-secret', { status: 401 }) });
  await assert.rejects(bad.complete([]), (error) => /HTTP 401/.test(error.message) && !error.message.includes('sk-secret'));
});

function runCli(args, env) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(ROOT, 'bin', 'ai-generate.mjs'), ...args], { cwd: ROOT, env, encoding: 'utf8' }, (error, stdout, stderr) => {
      resolve({ code: error ? error.code : 0, stdout, stderr });
    });
  });
}

test('CLI refuses to run without LLM settings and runs end to end against a fake endpoint', async () => {
  const bareEnv = { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT };
  const missing = await runCli(['--subject', 'korean', '--grade', 'g34', '--standard', '4국02-04'], bareEnv);
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /DIGIMON_LLM_BASE_URL/);

  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: KOREAN_BATCH } }] }));
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const root = tmpRoot();
  try {
    const run = await runCli(
      ['--subject', 'korean', '--grade', 'g34', '--standard', '4국02-04', '--count', '2', '--rounds', '1', '--corpus-root', root, '--json'],
      {
        ...bareEnv,
        DIGIMON_LLM_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`,
        DIGIMON_LLM_API_KEY: 'sk-test',
        DIGIMON_LLM_MODEL: 'fake',
        DIGIMON_GGW_LINTER: path.join(root, 'missing-linter.ts'),
      },
    );
    assert.equal(run.code, 0, run.stderr);
    const [summary] = JSON.parse(run.stdout);
    assert.equal(summary.standardCode, '[4국02-04]');
    assert.equal(summary.accepted.length, 2);
    assert.equal(summary.corpusAfter, 2);
    assert.match(summary.warnings[0], /GGW 린터가 없어/);
    assert.ok(!run.stdout.includes('sk-test'));
    assert.equal(loadAuthoredCorpus(root)[0].items.length, 2);
  } finally {
    server.close();
    rmSync(root, { recursive: true, force: true });
  }
});
