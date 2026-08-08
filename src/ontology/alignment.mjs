export const GENERATOR_TOPIC_ALIGNMENT_SCHEMA = 'digi-mon/generator-topic-alignment@1';

export function validateAssessmentMappings(generator, assessmentTopicIds) {
  const mappings = generator.assessmentMappings ?? [];
  if (!Array.isArray(mappings)) throw new Error(`생성기 assessmentMappings 배열 필요: ${generator.id}`);
  const seen = new Set();
  for (const mapping of mappings) {
    if (!mapping || typeof mapping.topicId !== 'string' || mapping.topicId.length === 0) throw new Error(`생성기 assessment mapping topicId 필요: ${generator.id}`);
    if (!assessmentTopicIds.has(mapping.topicId)) throw new Error(`생성기 ${generator.id}가 assesses 역할이 아닌 topic에 연결됨: ${mapping.topicId}`);
    if (seen.has(mapping.topicId)) throw new Error(`생성기 ${generator.id} assessment topic 중복: ${mapping.topicId}`);
    if (typeof mapping.confidence !== 'string' || mapping.confidence.length === 0) throw new Error(`생성기 assessment mapping confidence 필요: ${generator.id}`);
    if (typeof mapping.note !== 'string' || mapping.note.length === 0) throw new Error(`생성기 assessment mapping note 필요: ${generator.id}`);
    if (!['approved', 'candidate'].includes(mapping.reviewStatus)) throw new Error(`생성기 assessment mapping reviewStatus 필요: ${generator.id}`);
    seen.add(mapping.topicId);
  }
  return mappings;
}

export function assessmentMappingsFor(standard, generator) {
  const assessmentTopicIds = new Set(
    (standard.upstream?.topicMappings ?? [])
      .filter((mapping) => mapping.role === 'assesses')
      .map((mapping) => mapping.topicId),
  );
  const explicit = validateAssessmentMappings(generator, assessmentTopicIds);
  if (explicit.length > 0) return explicit;
  if (
    generator.curriculumReview?.decision === 'approved'
    && assessmentTopicIds.size === 1
  ) {
    return [...assessmentTopicIds].map((topicId) => ({
      topicId,
      confidence: 'official-curriculum-reviewed',
      note: generator.curriculumReview.note,
      reviewStatus: 'approved',
    }));
  }
  return [...assessmentTopicIds].map((topicId) => ({
    topicId,
    confidence: 'standard-code-inferred',
    note: '성취기준의 assesses 주제에서 만든 검토 후보. 생성기별 평가 구인 검토 전에는 승인 정렬로 사용하지 않는다.',
    reviewStatus: 'candidate',
  }));
}

export function semanticCoverageFor(standard, generators) {
  const assessmentTopicIds = new Set((standard.upstream?.topicMappings ?? []).filter((mapping) => mapping.role === 'assesses').map((mapping) => mapping.topicId));
  const alignments = generators.flatMap((generator) => assessmentMappingsFor(standard, generator)
    .map((mapping) => ({ generatorId: generator.id, ...mapping })));
  const approvedAlignments = alignments.filter((mapping) => mapping.reviewStatus === 'approved');
  const alignedTopicIds = [...new Set(approvedAlignments.map((mapping) => mapping.topicId))].sort();
  const candidateAlignedTopicIds = [...new Set(alignments.map((mapping) => mapping.topicId))].sort();
  const topicIds = [...assessmentTopicIds].sort();
  return {
    contract: GENERATOR_TOPIC_ALIGNMENT_SCHEMA,
    assessmentTopicCount: topicIds.length,
    alignedAssessmentTopicCount: alignedTopicIds.length,
    candidateAlignedAssessmentTopicCount: candidateAlignedTopicIds.length,
    coverageRatio: topicIds.length === 0 ? null : Number((alignedTopicIds.length / topicIds.length).toFixed(4)),
    candidateCoverageRatio: topicIds.length === 0 ? null : Number((candidateAlignedTopicIds.length / topicIds.length).toFixed(4)),
    topicIds, alignedTopicIds, candidateAlignedTopicIds,
    unalignedTopicIds: topicIds.filter((id) => !alignedTopicIds.includes(id)),
    alignments,
  };
}
