/**
 * 영어 공식 초등 권장 어휘 800개 안에 있는 낱말인지 판정한다.
 *
 * 별표 3 은 대표 표제어가 굴절형을 포함한다고 밝힌다
 * (data/curriculum/english-official-vocabulary.json 의
 * guidelines.representativeHeadwordCoversInflections). 그래서 표제어 그대로가 아니어도
 * 규칙 굴절(-s, -es, -ies, -ed, -ing, -er, -est)과 아래 불규칙형은 같은 낱말로 본다.
 * 파생어(-ly, -ful 따위)는 새 낱말로 보고 받지 않는다. 판정이 갈리면 막는 쪽으로 둔다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VOCAB_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'curriculum', 'english-official-vocabulary.json',
);

/** 규칙으로 되돌릴 수 없는 굴절형 -> 표제어. 표제어가 800개 안에 있을 때만 통과한다. */
const IRREGULAR = {
  i: 'I', me: 'I', my: 'I', mine: 'I',
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be',
  has: 'have', had: 'have', does: 'do', did: 'do', done: 'do',
  went: 'go', gone: 'go', came: 'come', ate: 'eat', saw: 'see', seen: 'see',
  made: 'make', took: 'take', got: 'get', said: 'say', ran: 'run', sat: 'sit',
  wrote: 'write', gave: 'give', told: 'tell', knew: 'know', found: 'find',
  bought: 'buy', brought: 'bring', thought: 'think', taught: 'teach', felt: 'feel',
  left: 'leave', met: 'meet', slept: 'sleep', swam: 'swim', sang: 'sing', drank: 'drink',
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', mice: 'mouse',
  him: 'he', his: 'he', her: 'she', hers: 'she', us: 'we', our: 'we', ours: 'we',
  them: 'they', their: 'they', theirs: 'they', its: 'it', your: 'you', yours: 'you',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
};

let cached;

/** 800개 표제어와 함께 실린 대안·관련형을 소문자 집합으로 돌려준다. */
export function officialEnglishWords() {
  if (cached) return cached;
  const data = JSON.parse(readFileSync(VOCAB_PATH, 'utf8'));
  const words = new Set();
  for (const entry of data.officialElementaryEntries) {
    for (const w of [entry.headword, ...entry.alternatives, ...entry.listedRelatedForms]) {
      words.add(String(w).toLowerCase());
    }
  }
  cached = words;
  return words;
}

function candidates(word) {
  const out = [word];
  const add = (w) => { if (w.length >= 2) out.push(w); };
  if (word.endsWith("'s")) add(word.slice(0, -2));
  if (word.endsWith('ies')) add(`${word.slice(0, -3)}y`);
  if (word.endsWith('es')) add(word.slice(0, -2));
  if (word.endsWith('s')) add(word.slice(0, -1));
  if (word.endsWith('ied')) add(`${word.slice(0, -3)}y`);
  for (const suffix of ['ed', 'ing', 'er', 'est']) {
    if (!word.endsWith(suffix)) continue;
    const stem = word.slice(0, -suffix.length);
    add(stem);
    add(`${stem}e`);
    // stopped -> stop, running -> run, bigger -> big
    if (stem.length >= 3 && stem.at(-1) === stem.at(-2)) add(stem.slice(0, -1));
  }
  if (word.endsWith('ier')) add(`${word.slice(0, -3)}y`);
  if (word.endsWith('iest')) add(`${word.slice(0, -4)}y`);
  if (word.endsWith('d')) add(word.slice(0, -1));
  return out;
}

/** 낱말 하나가 800개 안의 낱말(또는 그 굴절형)인가. */
export function isOfficialEnglishWord(raw, allowedNames = []) {
  const word = raw.toLowerCase();
  const words = officialEnglishWords();
  if (allowedNames.some((n) => n.toLowerCase() === word)) return true;
  if (IRREGULAR[word] !== undefined) return words.has(IRREGULAR[word].toLowerCase());
  return candidates(word).some((c) => words.has(c));
}

/** 문면에서 영어 낱말을 뽑아 800개 밖의 것만 돌려준다. */
export function englishWordsOutsideOfficial(texts, allowedNames = []) {
  const outside = new Set();
  for (const text of texts) {
    for (const token of String(text).match(/[A-Za-z]+(?:'[a-z]+)?/g) ?? []) {
      // 알파벳 한 글자(문자 인식 문항의 a, B)는 낱말이 아니다. 'I' 와 'a' 는 표제어다.
      if (token.length === 1) continue;
      if (!isOfficialEnglishWord(token, allowedNames)) outside.add(token);
    }
  }
  return [...outside];
}
