const SUBJECTS = Object.freeze({
  math: Object.freeze({ character: '수', gradeBands: new Set(['1-2', '3-4', '5-6']) }),
  korean: Object.freeze({ character: '국', gradeBands: new Set(['1-2', '3-4', '5-6']) }),
  english: Object.freeze({ character: '영', gradeBands: new Set(['3-4', '5-6']) }),
});

const STANDARD_CODE_RE = /^\[(2|4|6)([국수영])\d{2}-\d{2}\]$/;

function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 객체가 필요하다`);
  }
  return value;
}

function array(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} 배열이 필요하다`);
  return value;
}

function unique(records, key, label) {
  const values = new Set();
  for (const record of records) {
    const value = record?.[key];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`${label} ${key}가 필요하다`);
    }
    if (values.has(value)) throw new Error(`${label} ${key} 중복: ${value}`);
    values.add(value);
  }
  return values;
}

export function validateSpine(spine) {
  object(spine, '성취기준 스파인');
  if (spine.schema !== 'digi-mon/spine@2') {
    throw new Error(`지원하지 않는 성취기준 스파인: ${spine.schema ?? 'missing'}`);
  }
  const standards = array(spine.standards, '성취기준 스파인 standards');
  if (spine.standardCount !== standards.length) {
    throw new Error(
      `성취기준 수 불일치: declared ${spine.standardCount}, actual ${standards.length}`,
    );
  }
  if (spine.conflictCount !== 0 || array(spine.conflicts, '성취기준 conflicts').length !== 0) {
    throw new Error('코드와 성취기준 필드가 충돌하는 스파인은 사용할 수 없다');
  }
  unique(standards, 'code', '성취기준');
  unique(standards, 'specId', '성취기준');
  unique(standards, 'standardKey', '성취기준');

  for (const standard of standards) {
    const subject = SUBJECTS[standard.subject];
    if (!subject) throw new Error(`지원하지 않는 교과: ${standard.subject}`);
    const match = STANDARD_CODE_RE.exec(standard.code);
    if (!match || match[2] !== subject.character) {
      throw new Error(`교과와 성취기준 코드 불일치: ${standard.code}`);
    }
    if (!subject.gradeBands.has(standard.gradeBand)) {
      throw new Error(`교과와 학년군 불일치: ${standard.code} ${standard.gradeBand}`);
    }
    object(standard.source, `성취기준 ${standard.code} source`);
    array(standard.source.evidence, `성취기준 ${standard.code} source.evidence`);
    object(standard.upstream, `성취기준 ${standard.code} 정렬 자료`);
    array(standard.upstream.topicMappings, `성취기준 ${standard.code} topicMappings`);
  }
  return spine;
}

export function officialStandardCodes(text, subjectCharacter) {
  const matches = text.matchAll(/\[(?:2|4|6)([국수영])\d{2}-\d{2}\]/g);
  return new Set(
    [...matches]
      .filter((match) => match[1] === subjectCharacter)
      .map((match) => match[0]),
  );
}

export function validateOfficialCodeInventory(spine, annexTexts) {
  const spineCodesBySubject = new Map(
    Object.keys(SUBJECTS).map((subject) => [
      subject,
      new Set(spine.standards.filter((standard) => standard.subject === subject)
        .map((standard) => standard.code)),
    ]),
  );
  for (const [subject, contract] of Object.entries(SUBJECTS)) {
    const official = officialStandardCodes(annexTexts[subject], contract.character);
    const internal = spineCodesBySubject.get(subject);
    const missing = [...official].filter((code) => !internal.has(code));
    const unknown = [...internal].filter((code) => !official.has(code));
    if (missing.length > 0 || unknown.length > 0) {
      throw new Error(
        `${subject} 공식 성취기준 코드 불일치: missing ${missing.join(', ') || '-'}; `
        + `unknown ${unknown.join(', ') || '-'}`,
      );
    }
  }
  return true;
}
