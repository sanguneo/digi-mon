/**
 * 문항 문면의 한국어 표기 규칙.
 *
 * tools/check-korean.mjs 가 등록된 생성기 전체를 표본 검사할 때 쓰고, AI 작성 문항
 * 파이프라인(src/authoring)이 후보 문항을 코퍼스에 넣기 전에 같은 규칙으로 거른다.
 * 두 곳이 규칙을 따로 들고 있으면 한쪽만 고쳐지므로 여기 하나만 둔다.
 *
 * 규칙으로 확정되는 것만 본다. 문체·자연스러움은 판정하지 않는다.
 */
import { particle, particleRo, sinoKoreanLarge } from './korean-number.mjs';
import { vocabularyFor } from '../curriculum/korean-vocab.mjs';

/**
 * 조사 중복 검사가 낱말을 알아야 하는 이유.
 *
 * '가을을'은 낱말 '가을'에 조사 '을'이 붙은 정상 표기인데 문자열로만 보면 '을을'
 * 중복이다('세로로'와 같은 부류). '로'는 목록에서 뺐지만 '을'은 뺄 수 없다 —
 * 빼면 진짜 중복('공을을')을 놓친다. 그래서 겹침의 앞부분이 학년군 어휘의 낱말이면
 * 정상으로 본다. 낱말이 아닌데 겹치면 그대로 위반이다.
 */
const KNOWN_WORDS = new Set([...vocabularyFor('1-2'), ...vocabularyFor('3-4'), ...vocabularyFor('5-6')]);

/** 종성 유무로 갈리는 조사 짝. [받침있음, 받침없음] */
const JOSA_PAIRS = [
  ['은', '는'],
  ['이', '가'],
  ['을', '를'],
  ['과', '와'],
];
const ALL_JOSA = [...JOSA_PAIRS.flat(), '으로', '로'];
/**
 * 중복 조사 검사에서 쓰는 목록. 로는 넣지 않는다.
 * 한국어에 로로 끝나는 명사가 많아('세로', '가로', '도로') '세로로'가 정상인데
 * '로로' 중복으로 잡힌다.
 */
const DUPLICABLE_JOSA = JOSA_PAIRS.flat();

/** 단위 기호를 한국어로 읽은 소리. 조사는 읽는 소리가 정한다. */
const UNIT_READING = {
  cm: '센티미터',
  mm: '밀리미터',
  m: '미터',
  km: '킬로미터',
  g: '그램',
  kg: '킬로그램',
  t: '톤',
  L: '리터',
  mL: '밀리리터',
  '%': '퍼센트',
  '°': '도',
};

/** 종성 규칙으로 옳은 조사를 고른다. */
function expectedJosa(readingLastWord, josa) {
  // 로/으로는 받침 ㄹ 예외가 있어 2항 판정이 안 된다. 이걸 빼놓아서
  // '1 : 3로' 가 문면 62,255건 위반 0을 통과했다. 외부 검토가 잡았다.
  if (josa === '로' || josa === '으로') return particleRo(readingLastWord);
  const pair = JOSA_PAIRS.find((p) => p.includes(josa));
  if (!pair) return null;
  return particle(readingLastWord, pair[0], pair[1]);
}

export const KOREAN_TEXT_CHECKS = [
  {
    id: 'josa-after-number',
    label: '숫자 뒤 조사',
    /**
     * 숫자에 바로 붙은 조사. 조사는 표기가 아니라 읽는 소리가 정한다.
     * 27(이십칠) -> 은 / 52(오십이) -> 는
     *
     * 분수는 분자를 마지막에 소리 낸다. '1/4' 은 '사분의 일' 이므로 '1/4은' 이
     * 맞다. 끝 숫자 4만 보면 옳은 표기를 틀렸다고 보고한다.
     */
    scan(text) {
      const found = [];
      const fractionSpans = [];

      // 분수 표기를 먼저 처리하고 그 구간을 기록해 두어 중복 판정을 막는다.
      const fracRe = /(\d+)\/(\d+)(으로|로|은|는|이|가|을|를|과|와)(?=[\s.,)?]|$)/g;
      let fm = fracRe.exec(text);
      while (fm !== null) {
        fractionSpans.push([fm.index, fm.index + fm[0].length]);
        const numerator = Number(fm[1]);
        const want = expectedJosa(sinoKoreanLarge(numerator), fm[3]);
        if (want !== null && want !== fm[3]) {
          found.push(`'${fm[0]}' -> '${fm[1]}/${fm[2]}${want}' (분자 ${numerator}을 마지막에 읽는다)`);
        }
        fm = fracRe.exec(text);
      }

      const re = /(\d+)(으로|로|은|는|이|가|을|를|과|와)(?=[\s.,)?]|$)/g;
      let m = re.exec(text);
      while (m !== null) {
        const start = m.index;
        const inFraction = fractionSpans.some(([s, e]) => start >= s && start < e);
        const n = Number(m[1]);
        if (!inFraction && Number.isSafeInteger(n) && n >= 0 && n < 10 ** 13) {
          const want = expectedJosa(sinoKoreanLarge(n), m[2]);
          if (want !== null && want !== m[2]) {
            found.push(`'${m[0]}' -> '${m[1]}${want}' (${n}은 '${sinoKoreanLarge(n)}'으로 읽는다)`);
          }
        }
        m = re.exec(text);
      }
      return found;
    },
  },
  {
    id: 'josa-after-unit',
    label: '단위 뒤 조사',
    scan(text) {
      const found = [];
      const units = Object.keys(UNIT_READING).sort((a, b) => b.length - a.length);
      for (const unit of units) {
        const escaped = unit.replace(/[.*+?^${}()|[\]\\%°]/g, '\\$&');
        const re = new RegExp(`\\d${escaped}(으로|로|은|는|이|가|을|를|과|와)(?=[\\s.,)?]|$)`, 'g');
        let m = re.exec(text);
        while (m !== null) {
          const want = expectedJosa(UNIT_READING[unit], m[1]);
          if (want !== null && want !== m[1]) {
            found.push(`'${m[0]}' -> 단위 ${unit}(${UNIT_READING[unit]}) 뒤에는 '${want}'`);
          }
          m = re.exec(text);
        }
      }
      return found;
    },
  },
  {
    id: 'josa-after-counter',
    label: '단위명사 뒤 조사',
    scan(text) {
      const found = [];
      const counters = ['개', '권', '장', '자루', '마리', '송이', '명', '번', '조각', '묶음', '층'];
      for (const counter of counters) {
        const re = new RegExp(`\\d+${counter}(으로|로|은|는|이|가|을|를|과|와)(?=[\\s.,)?]|$)`, 'g');
        let m = re.exec(text);
        while (m !== null) {
          const want = expectedJosa(counter, m[1]);
          if (want !== null && want !== m[1]) {
            found.push(`'${m[0]}' -> 단위명사 ${counter} 뒤에는 '${want}'`);
          }
          m = re.exec(text);
        }
      }
      return found;
    },
  },
  {
    id: 'duplicate-josa',
    label: '조사 중복',
    scan(text) {
      const found = [];
      for (const j of DUPLICABLE_JOSA) {
        let at = text.indexOf(`${j}${j}`);
        while (at !== -1) {
          // 겹침의 첫 글자까지가 낱말이면 정상 표기다('가을' + '을' = '가을을').
          const wordStart = Math.max(text.lastIndexOf(' ', at), -1) + 1;
          const stem = text.slice(wordStart, at + j.length);
          if (!KNOWN_WORDS.has(stem)) found.push(`'${j}${j}' (${text.slice(wordStart, at + j.length * 2)})`);
          at = text.indexOf(`${j}${j}`, at + 1);
        }
      }
      return found;
    },
  },
  {
    id: 'space-before-josa',
    label: '조사 앞 공백',
    scan(text) {
      const m = text.match(/\d\s+(은|는|이|가|을|를)(?=[\s.,?]|$)/g);
      return m ? m.map((x) => `'${x}'`) : [];
    },
  },
  {
    id: 'template-leak',
    label: '치환 안 된 흔적',
    scan(text) {
      const found = [];
      for (const bad of ['${', 'undefined', 'NaN', '[object', 'null']) {
        if (text.includes(bad)) found.push(`'${bad}'`);
      }
      // 조립용 자리표시자가 남으면 문항이 깨진다. □ 는 정상 표기이므로 제외한다.
      if (/⟦|\{\{|%s|%d/.test(text)) found.push('자리표시자 잔존');
      return found;
    },
  },
  {
    id: 'double-space',
    label: '연속 공백·문장부호 앞 공백',
    /**
     * 들여쓰기와 줄임표는 정상 표기다.
     *   여러 줄 발문은 줄바꿈 뒤 공백으로 들여쓴다.
     *   '■ ● ■ ...' 와 '= 3 ... 2' 의 줄임표 앞 공백은 의도한 것이다.
     * 이 둘을 걸러내지 않으면 옳은 표기를 계속 위반으로 보고해 게이트가 무력해진다.
     */
    scan(text) {
      const found = [];
      // 줄바꿈에 붙은 공백은 들여쓰기이므로 제외한다.
      const withoutIndent = text.replace(/\n[ ]*/g, '\n');
      if (/ {2,}/.test(withoutIndent)) found.push('공백 2칸 이상');
      // 줄임표를 지운 뒤 문장부호 앞 공백을 본다.
      const withoutEllipsis = withoutIndent.replace(/\.{2,}|…/g, '');
      if (/\s[.,?!]/.test(withoutEllipsis)) found.push('문장부호 앞 공백');
      return found;
    },
  },
  {
    id: 'josa-after-quote',
    label: '따옴표 뒤 조사',
    // 수학 생성기는 다른 작업 줄에서 고친다. 여기서는 국어·영어 문면만 본다.
    subjects: ['korean', 'english'],
    /**
     * 작은따옴표로 묶은 말 뒤의 조사. 풀이 문장은 낱말을 따옴표로 들어 보이고
     * 조사를 붙이는데, 받침을 보지 않고 한 가지 조사를 고정해 두면
     * "'어멍'는", "'읽었습니다'이" 처럼 틀린다. 따옴표 안 마지막 글자가 한글
     * 음절이거나 자음 글자(ㄱ~ㅎ)일 때만 판정한다. 영어·숫자는 읽는 소리가
     * 갈려 규칙으로 정할 수 없으므로 보지 않는다.
     */
    scan(text) {
      const found = [];
      const re = /'([^'\n]+)'(으로|로|은|는|이|가|을|를|과|와)(?=[\s.,)?!]|$)/g;
      let m = re.exec(text);
      while (m !== null) {
        const reading = quotedReading(m[1]);
        if (reading !== null) {
          const want = expectedJosa(reading, m[2]);
          if (want !== null && want !== m[2]) found.push(`'${m[1]}'${m[2]} -> '${m[1]}'${want}`);
        }
        m = re.exec(text);
      }
      return found;
    },
  },
  {
    id: 'space-between-quote-josa',
    label: '따옴표와 조사 사이 공백',
    subjects: ['korean', 'english'],
    // 조사는 앞말에 붙여 쓴다. "'같이' 로 견주었다" 는 "'같이'로" 가 맞다.
    scan(text) {
      const m = text.match(/'[^'\n]+' (으로|로|은|는|이|가|을|를|과|와|에|에서|에게)(?=[\s.,?!]|$)/g);
      return m ? m.map((x) => `'${x}'`) : [];
    },
  },
];

/** 한글 자음 글자의 이름. 따옴표 안이 'ㅎ' 이면 '히읗' 으로 읽으므로 받침이 있다. */
const JAMO_NAMES = {
  ㄱ: '기역', ㄲ: '쌍기역', ㄴ: '니은', ㄷ: '디귿', ㄸ: '쌍디귿', ㄹ: '리을', ㅁ: '미음', ㅂ: '비읍',
  ㅃ: '쌍비읍', ㅅ: '시옷', ㅆ: '쌍시옷', ㅇ: '이응', ㅈ: '지읒', ㅉ: '쌍지읒', ㅊ: '치읓', ㅋ: '키읔',
  ㅌ: '티읕', ㅍ: '피읖', ㅎ: '히읗',
};

/** 따옴표 안 말을 읽는 소리의 끝. 한글 음절·자음 글자가 아니면 null(판정하지 않음). */
function quotedReading(inner) {
  const last = [...inner.trim()].at(-1) ?? '';
  if (/^[가-힣]$/.test(last)) return last;
  if (JAMO_NAMES[last]) return JAMO_NAMES[last];
  return null;
}

/** 규칙이 그 교과 문면에 적용되는가. subjects 가 없으면 모든 교과에 적용한다. */
export function checkAppliesTo(check, subject) {
  return !Array.isArray(check.subjects) || check.subjects.includes(subject);
}

/** 문면 하나에서 규칙 위반을 모두 찾는다. */
export function scanKoreanText(text, subject) {
  const hits = [];
  for (const check of KOREAN_TEXT_CHECKS) {
    if (!checkAppliesTo(check, subject)) continue;
    for (const problem of check.scan(text)) hits.push({ id: check.id, label: check.label, problem });
  }
  return hits;
}
