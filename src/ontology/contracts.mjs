const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const object = (value, label) => { if (!isObject(value)) throw new Error(`${label} 최상위 객체가 필요하다`); return value; };
const array = (value, label) => { if (!Array.isArray(value)) throw new Error(`${label} 배열이 필요하다`); return value; };
function count(value, actual, label) {
  if (!Number.isInteger(value) || value !== actual) throw new Error(`${label} 불일치: declared ${value}, actual ${actual}`);
}
function uniqueIds(records, label, key = 'id') {
  const ids = new Set();
  for (const record of records) {
    const id = record?.[key];
    if (typeof id !== 'string' || id.length === 0) throw new Error(`${label} ${key} 가 필요하다`);
    if (ids.has(id)) throw new Error(`${label} ${key} 중복: ${id}`);
    ids.add(id);
  }
  return ids;
}
function requireId(ids, id, label) {
  if (!ids.has(id)) throw new Error(`${label} 알 수 없는 taxonomy ID: ${id}`);
}

/** Dependency-free validation at the upstream trust boundary. */
export function validateOntologyDocuments(input) {
  const manifest = object(input.manifest, 'manifest.json');
  const standards = object(input.standards, 'curriculum-standards.json');
  const topics = object(input.topics, 'topics.json');
  const dependencies = object(input.dependencies, 'dependencies.json');
  const clusters = object(input.clusters, 'clusters.json');
  const sources = array(standards.sources, 'curriculum-standards.json sources');
  const curricula = array(standards.curricula, 'curriculum-standards.json curricula');
  const mappings = array(standards.standardMappings, 'curriculum-standards.json standardMappings');
  const gaps = array(standards.coverageGaps, 'curriculum-standards.json coverageGaps');
  const topicRecords = array(topics.topics, 'topics.json topics');
  const edges = array(dependencies.dependencies, 'dependencies.json dependencies');
  const clusterRecords = array(clusters.clusters, 'clusters.json clusters');
  const versions = [standards.taxonomyVersion, topics.taxonomyVersion, dependencies.taxonomyVersion, clusters.taxonomyVersion];
  if (versions.some((version) => typeof version !== 'string') || new Set(versions).size !== 1 || versions[0] !== manifest.taxonomyVersion) {
    throw new Error(`taxonomyVersion 교차 파일 불일치: ${versions.join(', ')}`);
  }
  for (const [label, ontologyDoc] of [['topics.json', topics], ['dependencies.json', dependencies], ['clusters.json', clusters]]) {
    if (ontologyDoc.version !== ontologyDoc.taxonomyVersion) throw new Error(`${label} version 과 taxonomyVersion 불일치`);
  }
  const standardRecords = curricula.flatMap((curriculum) => array(curriculum.standards, `curriculum ${curriculum.id} standards`));
  count(standards.sourceCount, sources.length, 'curriculum-standards.json sourceCount');
  count(standards.curriculumCount, curricula.length, 'curriculum-standards.json curriculumCount');
  count(standards.standardCount, standardRecords.length, 'curriculum-standards.json standardCount');
  count(standards.microTopicCount, topicRecords.length, 'curriculum-standards.json microTopicCount');
  count(standards.mappingCount, mappings.length, 'curriculum-standards.json mappingCount');
  count(standards.coverageGapCount, gaps.length, 'curriculum-standards.json coverageGapCount');
  count(topics.topicCount, topicRecords.length, 'topics.json topicCount');
  count(dependencies.edgeCount, edges.length, 'dependencies.json edgeCount');
  count(clusters.clusterCount, clusterRecords.length, 'clusters.json clusterCount');
  for (const curriculum of curricula) count(curriculum.standardCount, curriculum.standards.length, `curriculum ${curriculum.id} standardCount`);
  for (const cluster of clusterRecords) count(cluster.topicCount, array(cluster.topics, `cluster ${cluster.id} topics`).length, `cluster ${cluster.id} topicCount`);
  const sourceIds = uniqueIds(sources, 'source');
  const topicIds = uniqueIds(topicRecords, 'topic');
  const standardKeys = uniqueIds(standardRecords, 'standard', 'key');
  uniqueIds(curricula, 'curriculum'); uniqueIds(clusterRecords, 'cluster');
  for (const standard of standardRecords) for (const id of standard.sourceRefs ?? []) requireId(sourceIds, id, `standard ${standard.key} sourceRefs`);
  for (const topic of topicRecords) {
    for (const key of topic.standards ?? []) requireId(standardKeys, key, `topic ${topic.id} standards`);
    for (const id of topic.sourceRefs ?? []) requireId(sourceIds, id, `topic ${topic.id} sourceRefs`);
  }
  for (const mapping of mappings) {
    requireId(standardKeys, mapping.standardKey, 'standardMapping standardKey');
    requireId(topicIds, mapping.microTopicId, 'standardMapping microTopicId');
    if (typeof mapping.relationship !== 'string' || mapping.relationship.length === 0) throw new Error('standardMapping relationship 가 필요하다');
  }
  for (const edge of edges) { requireId(topicIds, edge.topicId, 'dependency topicId'); requireId(topicIds, edge.prerequisiteId, 'dependency prerequisiteId'); }
  for (const cluster of clusterRecords) {
    for (const id of cluster.topics) requireId(topicIds, id, `cluster ${cluster.id}`);
    if (cluster.standards !== undefined) {
      count(cluster.standardCount, array(cluster.standards, `cluster ${cluster.id} standards`).length, `cluster ${cluster.id} standardCount`);
      for (const key of cluster.standards) requireId(standardKeys, key, `cluster ${cluster.id} standards`);
    }
  }
  for (const gap of gaps) for (const key of gap.standardKeys ?? []) requireId(standardKeys, key, `coverageGap ${gap.id} standardKeys`);
  const expected = { sources: sources.length, curricula: curricula.length, standards: standardRecords.length, topics: topicRecords.length,
    dependencies: edges.length, clusters: clusterRecords.length, standardMappings: mappings.length, coverageGaps: gaps.length };
  object(manifest.counts, 'manifest.json counts');
  for (const [key, actual] of Object.entries(expected)) count(manifest.counts[key], actual, `manifest.json counts.${key}`);
  return true;
}
