/**
 * GGW(general-good-writing) 린터로 후보 문항의 어색한 문장을 거른다.
 *
 * `bun <polish-lint.ts> <파일> --scan --json` 으로 묶음 전체의 판정(mode)을 받고,
 * `--json` 으로 문장 단위 지적(hits[].sentence)을 받아 문항에 되돌려 붙인다.
 * 심각도 high·mid 지적이 걸린 문항은 탈락시키고 low 는 경고로만 남긴다.
 *
 * 린터는 문서 전체의 짜임(arc)도 보는데, 문항 묶음은 글이 아니라서 짜임 판정
 * (예: composed_exercise)은 쓰지 않는다. 문장 단위 지적만 쓴다.
 *
 * 린터나 bun 이 없거나 린터 키가 없으면 이 단계만 건너뛰고 경고를 남긴다.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_GGW_LINTER = path.join(
  os.homedir(), '.agents', 'skills', 'general-good-writing', 'scripts', 'polish-lint.ts',
);

/**
 * 교과 용어라서 린터의 은유·권위 명사 지적이 맞지 않는 말.
 * '받침'은 한글 받침이고 '근거'는 [6국01-02] 가 가르치는 용어다.
 */
const DOMAIN_TERMS = new Set(['받침', '근거', '근거를', '기준이']);
const BLOCKING = new Set(['high', 'mid']);

function runProcess(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 300_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : -1) : 0, stdout, stderr, spawnError: error?.code === 'ENOENT' });
    });
  });
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

/**
 * @param {{ id: string, texts: string[] }[]} entries
 * @param {object} [options]
 * @param {string} [options.linterPath]
 * @param {string} [options.runtime] 린터를 돌릴 실행 파일. 기본 bun
 * @param {(command: string, args: string[]) => Promise<{code:number, stdout:string, stderr:string, spawnError?:boolean}>} [options.run]
 * @returns {Promise<{ status: 'ran'|'skipped', warning?: string, mode?: string, flagged: Map<string, {gate:string, detail:string}[]>, notes: Map<string, string[]> }>}
 */
export async function lintWithGgw(entries, {
  linterPath = process.env.DIGIMON_GGW_LINTER ?? DEFAULT_GGW_LINTER,
  runtime = process.env.DIGIMON_GGW_RUNTIME ?? 'bun',
  run = runProcess,
} = {}) {
  const flagged = new Map();
  const notes = new Map();
  if (entries.length === 0) return { status: 'ran', mode: 'pass', flagged, notes };
  if (!existsSync(linterPath)) {
    return { status: 'skipped', warning: `GGW 린터가 없어 윤문 검사를 건너뛰었다: ${linterPath}`, flagged, notes };
  }

  const dir = mkdtempSync(path.join(os.tmpdir(), 'digimon-ggw-'));
  const file = path.join(dir, 'candidates.txt');
  try {
    writeFileSync(file, `${entries.map((e) => e.texts.join('\n')).join('\n\n')}\n`, 'utf8');
    const scan = await run(runtime, [linterPath, file, '--scan', '--json']);
    if (scan.spawnError) {
      return { status: 'skipped', warning: `${runtime} 를 찾지 못해 윤문 검사를 건너뛰었다`, flagged, notes };
    }
    const scanJson = parseJson(scan.stdout);
    const lint = await run(runtime, [linterPath, file, '--json']);
    const lintJson = parseJson(lint.stdout);
    if (!scanJson || !lintJson) {
      const why = (scan.stderr || lint.stderr || '').trim().split('\n')[0] ?? '';
      return { status: 'skipped', warning: `GGW 린터가 판정을 내지 못해 윤문 검사를 건너뛰었다(exit ${scan.code}/${lint.code}) ${why}`.trim(), flagged, notes };
    }

    for (const hit of lintJson.hits ?? []) {
      const sentence = String(hit.sentence ?? '').trim();
      if (sentence.length === 0) continue;
      // 린터는 줄 안의 문장을 돌려주거나 짧은 줄 여럿을 한 문장으로 묶는다. 짧은 선택지('사실')가
      // 엉뚱한 문장에 들어 있다고 그 문항을 탈락시키지 않도록 역방향 포함은 긴 줄만 본다.
      const owners = entries.filter((e) => e.texts.some((t) => t.includes(sentence)
        || (t.trim().length >= 8 && sentence.includes(t.trim()))));
      const match = String(hit.match ?? '').trim();
      const detail = `${hit.family_label ?? hit.family}: '${match}' (${sentence})`;
      const blocking = BLOCKING.has(hit.severity) && !DOMAIN_TERMS.has(match);
      for (const owner of owners) {
        if (blocking) {
          if (!flagged.has(owner.id)) flagged.set(owner.id, []);
          flagged.get(owner.id).push({ gate: 'ggw', detail });
        } else {
          if (!notes.has(owner.id)) notes.set(owner.id, []);
          notes.get(owner.id).push(detail);
        }
      }
    }
    return {
      status: 'ran',
      mode: scanJson.mode,
      ...(lintJson.degraded ? { warning: `GGW 린터가 로컬 규칙만으로 판정했다: ${lintJson.degraded_reason ?? ''}`.trim() } : {}),
      flagged,
      notes,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
