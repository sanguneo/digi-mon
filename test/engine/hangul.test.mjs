/**
 * 한글 낱자 계산 단위 테스트.
 *
 * 자모 분해·조합·사전 순서는 전부 유니코드 산술로 확정되는 값이다. 지금까지
 * bin/verify-generators.mjs 를 통해 간접으로만 검증돼, 회귀가 나면 '생성기 실패'
 * 라는 엉뚱한 얼굴로 나타났다. 계약을 직접 고정한다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ASPIRATED_PAIRS,
  BASIC_CONSONANTS,
  BASIC_VOWELS,
  FINALS,
  INITIALS,
  LETTER_NAMES,
  MEDIALS,
  TENSE_PAIRS,
  compareDictionary,
  composeSyllable,
  decomposeSyllable,
  decomposeWord,
  finalOf,
  firstDifference,
  hasFinal,
  isSyllable,
  sortDictionary,
} from '../../src/engine/hangul.mjs';

test('낱자 표는 유니코드 음절 배열과 같은 길이다', () => {
  // 19 × 21 × 28 = 11172. 이 셋이 어긋나면 분해·조합이 통째로 어긋난다.
  assert.equal(INITIALS.length, 19);
  assert.equal(MEDIALS.length, 21);
  assert.equal(FINALS.length, 28);
  assert.equal(FINALS[0], '');
  assert.equal(INITIALS.length * MEDIALS.length * FINALS.length, 11_172);
});

test('음절 분해와 조합이 서로 반대 방향으로 맞물린다', () => {
  const decomposed = decomposeSyllable('한');
  assert.deepEqual(decomposed, {
    initial: 'ㅎ',
    medial: 'ㅏ',
    final: 'ㄴ',
    initialIndex: 18,
    medialIndex: 0,
    finalIndex: 4,
  });
  assert.equal(composeSyllable('ㅎ', 'ㅏ', 'ㄴ'), '한');
  assert.equal(composeSyllable('ㄱ', 'ㅏ'), '가');
  assert.throws(() => decomposeSyllable('A'), /한글 음절이 아니다/);
  assert.throws(() => composeSyllable('ㅏ', 'ㅏ'), /조합할 수 없는 낱자/);
});

test('낱말 분해는 받침 없는 음절을 두 낱자로 낸다', () => {
  assert.deepEqual(decomposeWord('한글'), ['ㅎ', 'ㅏ', 'ㄴ', 'ㄱ', 'ㅡ', 'ㄹ']);
  assert.deepEqual(decomposeWord('가'), ['ㄱ', 'ㅏ']);
  // 한글이 아닌 글자는 그대로 통과시킨다. 문항에 섞인 숫자·기호가 죽지 않는다.
  assert.deepEqual(decomposeWord('가1'), ['ㄱ', 'ㅏ', '1']);
});

test('받침 판정은 조사 선택의 근거다', () => {
  assert.equal(hasFinal('책'), true);
  assert.equal(hasFinal('사'), false);
  assert.equal(hasFinal('A'), false);
  assert.equal(finalOf('학교'), '');
  assert.equal(finalOf('책'), 'ㄱ');
  assert.equal(finalOf('cat'), '');
});

test('사전 순서는 초성 → 중성 → 종성 순으로 갈린다', () => {
  assert.equal(compareDictionary('가', '나') < 0, true);
  assert.equal(compareDictionary('가', '개') < 0, true);
  assert.equal(compareDictionary('가', '각') < 0, true);
  assert.equal(compareDictionary('가', '가'), 0);
  // 앞이 같으면 짧은 낱말이 먼저다.
  assert.equal(compareDictionary('가', '가방') < 0, true);
  assert.deepEqual(sortDictionary(['다', '가', '나']), ['가', '나', '다']);
});

test('첫 차이 지점은 몇 번째 글자의 무엇인지까지 말한다', () => {
  assert.deepEqual(firstDifference('가바', '가자'), {
    position: 2,
    part: 'initial',
    a: 'ㅂ',
    b: 'ㅈ',
  });
  assert.deepEqual(firstDifference('가', '개'), {
    position: 1,
    part: 'medial',
    a: 'ㅏ',
    b: 'ㅐ',
  });
  assert.deepEqual(firstDifference('가', '각'), {
    position: 1,
    part: 'final',
    a: '없음',
    b: 'ㄱ',
  });
  assert.deepEqual(firstDifference('가', '가방'), { position: 2, part: 'length' });
});

test('자모 이름과 소리 짝은 규칙이 아니라 목록이다', () => {
  // 한글 맞춤법이 정한 이름이다. 계산으로 만들 수 없으므로 표가 정본이다.
  assert.equal(LETTER_NAMES['ㄱ'], '기역');
  assert.equal(LETTER_NAMES['ㄷ'], '디귿');
  assert.equal(LETTER_NAMES['ㅅ'], '시옷');
  assert.equal(LETTER_NAMES['ㅎ'], '히읗');
  assert.equal(BASIC_CONSONANTS.length, 14);
  assert.equal(BASIC_VOWELS.length, 10);
  assert.equal(TENSE_PAIRS['ㄱ'], 'ㄲ');
  assert.equal(ASPIRATED_PAIRS['ㄱ'], 'ㅋ');
  // 된소리·거센소리 짝의 오른쪽은 전부 실재하는 초성이어야 한다.
  for (const tense of Object.values(TENSE_PAIRS)) {
    assert.equal(INITIALS.includes(tense), true);
  }
  for (const aspirated of Object.values(ASPIRATED_PAIRS)) {
    assert.equal(INITIALS.includes(aspirated), true);
  }
});

test('isSyllable 은 완성형 음절만 참이다', () => {
  assert.equal(isSyllable('가'), true);
  assert.equal(isSyllable('힣'), true);
  assert.equal(isSyllable('ㄱ'), false); // 낱자는 음절이 아니다
  assert.equal(isSyllable('a'), false);
});
