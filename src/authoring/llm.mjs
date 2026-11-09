/**
 * OpenAI 호환 chat completions 클라이언트.
 *
 * 주소·키·모델은 환경변수로만 받는다(DIGIMON_LLM_BASE_URL, DIGIMON_LLM_API_KEY,
 * DIGIMON_LLM_MODEL). 키는 저장소에도 로그에도 남기지 않는다: 오류 문구에는
 * 주소와 상태 코드만 싣고, 응답 본문은 앞부분만 잘라 싣는다.
 * 테스트는 fetchImpl 을 가짜로 넣어 네트워크 없이 돈다.
 */

export const LLM_ENV = ['DIGIMON_LLM_BASE_URL', 'DIGIMON_LLM_API_KEY', 'DIGIMON_LLM_MODEL'];

/** 환경변수에서 설정을 읽는다. 하나라도 없으면 missing 에 이름을 담아 돌려준다. */
export function llmConfigFromEnv(env = process.env) {
  const missing = LLM_ENV.filter((name) => typeof env[name] !== 'string' || env[name].trim() === '');
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    baseUrl: env.DIGIMON_LLM_BASE_URL.trim().replace(/\/+$/, ''),
    apiKey: env.DIGIMON_LLM_API_KEY.trim(),
    model: env.DIGIMON_LLM_MODEL.trim(),
  };
}

export function createLlmClient({ baseUrl, apiKey, model, fetchImpl = fetch, timeoutMs = 180_000, temperature = 0.8 }) {
  const url = `${baseUrl}/chat/completions`;
  return {
    model,
    async complete(messages) {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature, response_format: { type: 'json_object' } }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 300).replaceAll(apiKey, '***');
        throw new Error(`LLM 요청 실패: ${url} HTTP ${response.status} ${body}`);
      }
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw new Error(`LLM 응답에 message.content 가 없다: ${url}`);
      }
      return content;
    },
  };
}

/**
 * 모델 응답에서 후보 문항 배열을 꺼낸다.
 * {"items": [...]} 를 요구하지만 코드 울타리(```json)를 두르는 모델이 있어 벗겨 낸다.
 */
export function parseCandidates(text) {
  const trimmed = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('LLM 응답이 JSON 이 아니다');
    data = JSON.parse(trimmed.slice(start, end + 1));
  }
  const items = Array.isArray(data) ? data : data?.items;
  if (!Array.isArray(items)) throw new Error('LLM 응답에 items 배열이 없다');
  return items;
}
