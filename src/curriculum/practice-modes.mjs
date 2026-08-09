const THINKING_SKILLS_V1 = new Set([
  'korean.g34.st.s03-02.procedure',
  'korean.g56.st.s01-01.inference',
  'korean.g56.st.s01-02.claim-reason',
  'math.g12.pd.s01.number-pattern',
  'math.g12.pd.s01.shape-pattern',
  'math.g34.mr.s02-01.rule-expression',
]);

const LITERACY_FOUNDATIONS = new Set([
  'english.g34.lt.s01-02.alphabet-order',
  'english.g34.lt.s01-02.match-case',
  'english.g34.lt.s02-02.first-letter',
  'english.g34.lt.s02-02.write-case',
  'english.g56.lt.s02-03.end-mark',
  'english.g56.lt.s02-03.fix-case',
  'korean.g12.gr.s01.count-letters',
  'korean.g12.gr.s01.letter-name',
  'korean.g12.gr.s02.final',
  'korean.g12.gr.s02.has-final',
  'korean.g12.gr.s03.punctuation',
  'korean.g12.gr.s03.punctuation-name',
]);

const POLICIES = {
  advanced: {
    id: 'advanced',
    revision: 1,
    criterion: 'generator-declared-difficulty:3',
    label: '심화 연습',
    claimBoundary: '생성기가 선언한 최고 변형을 연습하며 학습자 수준이나 숙달을 판정하지 않는다.',
  },
  'literacy-foundations': {
    id: 'literacy-foundations',
    revision: 1,
    criterion: 'reviewed-symbol-and-convention-foundations',
    label: '기초 문해 연습',
    claimBoundary: '문자·낱말·문장 부호를 다루며 읽기 수준이나 결손을 판정하지 않는다.',
  },
  'thinking-skills-v1': {
    id: 'thinking-skills-v1',
    revision: 1,
    criterion: 'reviewed-rule-sequence-evidence-demand',
    label: '규칙·순서·근거 사고 연습',
    claimBoundary: '선별된 과제 요구를 연습하며 일반 사고력이나 전이를 측정하지 않는다.',
  },
};

export const PRACTICE_MODE_IDS = Object.keys(POLICIES).sort();

export function practiceModeManifest() {
  return PRACTICE_MODE_IDS.map((id) => structuredClone(POLICIES[id]));
}

export function generatorSupportsModes(generator, modes) {
  return modes.every((mode) => {
    if (mode === 'advanced') {
      const supported = generator.difficulties
        ?? (generator.difficultyAxis === 'single' ? [1] : [1, 2, 3]);
      return generator.difficultyAxis !== 'single' && supported.includes(3);
    }
    if (mode === 'thinking-skills-v1') return THINKING_SKILLS_V1.has(generator.id);
    if (mode === 'literacy-foundations') return LITERACY_FOUNDATIONS.has(generator.id);
    return false;
  });
}

export function resolveModeSelection(modes) {
  return {
    schema: 'digi-mon/mode-selection@1',
    resolved: modes.map((id) => structuredClone(POLICIES[id])),
  };
}
