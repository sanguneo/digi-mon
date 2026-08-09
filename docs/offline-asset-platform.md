# 오프라인 우선 비동기 자산 플랫폼 설계

## 1. 결정 요약

이 플랫폼은 지문, 대화, 구조화 매체, 생성 이미지와 TTS 음성을 **요청 시
생성하는 기능**이 아니라, 검토 가능한 후보를 미리 조달해 불변 코퍼스로
발행하는 공급망이다.

다만 아래 전체 플랫폼은 첫 교실 파일럿의 선행조건이 아니다. **2~4 엔지니어-주
파일럿은 DB·생성 queue·CAS 없이**, 사람이 작성하고 검토한 작은 자산 묶음과
source-controlled manifest(`path`, SHA-256, 출처·라이선스, 대체 텍스트)만 사용한다.
교사가 반복 작업을 다시 열지 못해 실제로 중단되거나, 여러 기여자의 동시 검토가
source control로 감당되지 않는다는 관찰이 나온 뒤에만 다음 단계를 연다.

권장 순서는 다음과 같다.

1. 첫 파일럿은 승인된 정적 자산과 최소 manifest만 패키징한다.
2. 내구성이 필요해진 단일 관리자/작업자 단계는 **SQLite WAL + 로컬 파일시스템
   CAS**로 시작한다.
3. 학습자 런타임에는 승인 release manifest와 필요한 blob을 한 bundle로 배포한다.
4. 여러 호스트가 동시에 생성·검토하거나 로컬 디스크 용량·백업이 병목이 될 때만
   **PostgreSQL + S3 호환 object storage**로 제어면을 옮긴다.
5. 두 내구성 배포 형태는 같은 논리 스키마, 상태 기계, canonical fingerprint와 export
   bundle을 사용한다. 저장소 교체가 revision 또는 worksheet의 의미를 바꾸면 안 된다.

모델 출력은 언제나 `candidate`다. 자동 검증은 승인할 수 없으며, 학습자 경로는
네트워크, provider credential, generation queue와 review DB에 접근하지 않는다.
모델이 없어도 이미 내려받은 release는 완전히 동작해야 한다.

## 2. 경계와 불변 조건

```text
procurement control plane                         learner data plane

requirements -> queue -> model/TTS -> candidate  exported bundle
                                -> validation       -> local manifest index
                                -> human review     -> content-addressed cache
                                -> release publish  -> deterministic selection
```

다음은 구현보다 먼저 고정할 계약이다.

- `assetId`는 논리 계열, `revisionId`는 불변 provenance 포함 revision이다.
- 한 revision의 payload, lineage 또는 생성 profile이 바뀌면 새 revision이다.
- review와 validation은 revision을 수정하지 않고 별도 append-only 레코드로 쌓인다.
- 발행된 release와 manifest는 수정하지 않는다.
- runtime cache miss는 같은 digest의 승인 blob을 origin/bundle에서 복구하거나
  `ASSET_REVISION_UNAVAILABLE`로 실패한다. 생성 작업을 만들지 않는다.
- release에는 `approved` revision만 들어간다. 이후 `retired` 또는 법적 삭제가
  발생해도 기존 release의 identity와 감사 메타데이터는 바꾸지 않는다.
- 콘텐츠 보존 권리보다 재현성을 우선하지 않는다. 서빙 금지 revision이 필요한
  과거 학습지는 HTTP 410과 수동 처리 경로를 사용한다.

## 3. 저장 기술 선택

### 3.1 비교

| 선택지 | 강점 | 실제 제약 | digi-mon에서의 용도 |
|---|---|---|---|
| SQLite | 배포할 서버가 없고 DB가 한 파일이며 트랜잭션과 WAL을 제공한다 | 한 순간에 writer는 하나뿐이다. WAL은 같은 host의 프로세스를 전제로 하며 network filesystem에 두면 안 된다(근거 1, 2) | 단일 host pilot의 metadata, queue, review 원장 |
| PostgreSQL | 여러 writer, 행 잠금, 제약조건, 백업/복제 생태계가 있고 `FOR UPDATE SKIP LOCKED`로 경쟁 worker가 서로 다른 job을 claim할 수 있다(근거 3, 4) | 서버 운영, connection/upgrade/backup 비용이 생긴다. DB 안 대형 blob은 메타데이터와 백업을 불필요하게 팽창시킨다 | 여러 host 작업자·검토자, HA가 필요한 제어면 |
| 로컬 파일 CAS | 완전 오프라인이고 단순하며 hash로 무결성을 확인할 수 있다 | 한 host 용량, 복제, 권한, 원격 협업에 한계가 있다 | pilot blob과 배포 bundle |
| S3 호환 object storage | 큰 객체, 범위 요청, lifecycle, 별도 권한 경계와 checksum을 제공한다. AWS S3는 PUT/DELETE 뒤 GET과 LIST에 strong consistency를 명시한다(근거 5, 6) | 객체 상태 전이·join·queue를 담당하는 DB가 아니다. 비용, egress, IAM, 공급자 의미 차이가 있다 | cloud 원본·후보·승인 blob; metadata DB의 대체재가 아님 |

SQLite WAL은 읽기와 쓰기를 겹치게 하지만 writer를 여러 개로 만들지는 않는다.
따라서 SQLite queue는 짧은 claim transaction과 lease를 사용하고, 모델 호출 동안
transaction을 열어 두지 않는다. SQLite 공식 지침도 많은 동시 writer 또는
네트워크로 DB를 직접 접근하는 경우 client/server DB를 권한다(근거 2).

PostgreSQL의 `SKIP LOCKED`는 일반 조회에는 일관되지 않은 view를 만들 수 있어
적합하지 않지만, 공식 문서가 queue-like table의 다중 consumer 경합 회피 용도를
명시한다(근거 4). 이 제한된 용도로만 사용한다.

### 3.2 선택 기준

아래 중 하나가 지속적으로 발생하면 PostgreSQL/object storage migration을 시작한다.
수치는 관찰 후 정하며 임의 QPS 임계값을 먼저 만들지 않는다.

- 둘 이상의 host가 DB 파일 또는 blob directory를 공유해야 한다.
- SQLite write-lock 대기 또는 queue claim 지연이 SLO의 주요 원인이다.
- 로컬 디스크가 백업·복구 목표나 보존량을 감당하지 못한다.
- 원격 reviewer, region 제한, IAM 역할 분리 또는 고가용성이 요구된다.

단순히 asset 수가 늘었다는 이유만으로 migration하지 않는다. SQLite의 한계는 주로
파일 크기보다 동시 writer와 운영 경계다.

## 4. 내용 주소화와 fingerprint

### 4.1 정규화 규칙

모든 hash는 lowercase SHA-256 hex이고 hash 직전 입력에 domain separator를 둔다.
JSON은 key 순서나 숫자 표현 차이로 identity가 달라지지 않도록 RFC 8785 JSON
Canonicalization Scheme(JCS)을 사용한다(근거 7). 텍스트 payload는 UTF-8 bytes 자체를
hash한다. 줄바꿈·Unicode를 몰래 정규화하지 않고, 정규화가 필요하면 생성 단계에서
명시적으로 수행한 뒤 그 bytes를 저장한다.

```text
blobSha256 = SHA256(blob bytes)

specKey = SHA256(
  "digi-mon:asset-spec:v1\n" || JCS(assetSpec)
)

generationInputFingerprint = SHA256(
  "digi-mon:generation-input:v1\n" || JCS({
    specKey, generationProfileId, promptTemplateSha256,
    orderedInputRevisionIds, parameters, provider, model, modelRevision
  })
)

revisionId = "ar_" + SHA256(
  "digi-mon:asset-revision:v1\n" || JCS({
    assetId, kind, sourceKind, payloads, lineage,
    generationInputFingerprint, rightsSnapshotSha256, schemaVersion
  })
)

manifestSha256 = SHA256(
  "digi-mon:asset-release:v1\n" || JCS(manifestWithoutManifestSha256)
)
```

`payloads`는 역할(`primary`, `transcript`, `alt-text`, `preview`, `source-spec`)과
`blobSha256`, MIME, byte 수를 포함해 역할·digest 순으로 정렬한다. lineage도
관계·revision ID 순으로 정렬한다. `createdAt`, DB row ID, review 상태와 storage URL은
revision identity에 넣지 않는다. 반대로 prompt, 모델 또는 입력 revision이 다르면
우연히 같은 본문 bytes가 나와도 provenance가 다른 revision이 된다. blob은 digest가
같으므로 물리적으로 재사용할 수 있다.

### 4.2 worksheet fingerprint

자산을 사용하는 차기 worksheet major는 기존 fingerprint 입력에 다음을 추가한다.

```json
{
  "assetCorpusReleaseId": "acr_...",
  "assetManifestSha256": "...",
  "assetSelectionAlgorithm": "digi-mon/asset-select@1",
  "selectedAssets": [
    {
      "itemOrdinal": 1,
      "assetId": "...",
      "revisionId": "ar_...",
      "payloadRole": "primary",
      "blobSha256": "..."
    }
  ]
}
```

배열은 item 순서와 payload role 순으로 고정한다. release manifest entry는
`specKey`, `assetId`, `revisionId` 순으로 정렬한다. 선택은 domain-separated seed와
eligible revision의 정렬된 목록만 사용한다. DB row 순서, 승인 시각, cache 상태,
object URL은 선택 입력이 아니다.

HTTP `ETag`는 transport validator일 뿐 canonical asset identity로 신뢰하지 않는다.
RFC 9110은 ETag를 선택된 representation의 validator로 정의하며 그 값이 SHA-256일
것을 요구하지 않는다(근거 8). 항상 manifest의 `blobSha256`을 검증한다.

## 5. 논리 데이터 스키마

아래가 정규 계약이다. PostgreSQL에서는 `jsonb`, `timestamptz`를 쓰고 SQLite에서는
canonical JSON `TEXT`, UTC RFC 3339 `TEXT`로 mapping한다. enum은 `CHECK` 또는 참조
테이블로 제한한다. ID는 application이 생성하는 UUIDv7 계열 운영 ID를 사용할 수
있지만 revision/release identity는 위 content fingerprint를 사용한다.

### 5.1 조달, revision, blob

| 테이블 | 핵심 열과 제약 |
|---|---|
| `asset_spec` | `spec_key PK`, `schema_version`, `kind`, `language`, `grade_band`, `assessment_function`, `standard_codes_json`, `topic_ids_json`, `difficulty_policy_json`, `desired_approved_count`, `active`; spec JSON과 `spec_key` 재계산 일치 |
| `asset` | `asset_id PK`, `spec_key FK`, `title`, `tombstoned_at`, `tombstone_reason`; tombstone 뒤 revision 추가 금지 |
| `blob` | `sha256 PK`, `bytes`, `mime`, `created_at`; digest·size·MIME는 불변 |
| `blob_location` | `(sha256, storage_class, object_key) PK`, `availability`, `verified_at`; `candidate`, `approved`, `quarantine`, `legal-hold`, `bundle` 위치 분리 |
| `asset_revision` | `revision_id PK`, `asset_id FK`, `kind`, `source_kind`, `schema_version`, `generation_input_fingerprint`, `rights_snapshot_sha256`, `supersedes_revision_id`, `created_at`, `state`; identity 필드 불변 |
| `revision_payload` | `(revision_id, role) PK`, `sha256 FK`, `ordinal`, `lang`; 한 role의 의미를 schema로 제한 |
| `revision_lineage` | `(revision_id, relation, input_revision_id) PK`; 입력은 이미 존재하는 revision |
| `topic_mapping` | `mapping_id PK`, `revision_id`, `topic_id`, `role`, `confidence`, `status`; revision 승인과 mapping 승인을 분리 |
| `rights_record` | `rights_id PK`, `revision_id`, `license_expression`, `holder`, `evidence_sha256`, `terms_version`, `territories_json`, `redistribution_allowed`, `expires_at`; SPDX 식별자를 우선 사용(근거 9) |

`source_kind`는 `sourced`, `repository-authored`, `llm-generated`, `tts-derived`다.
`kind`는 최소 `passage`, `dialogue`, `structured-media`, `image`, `audio`를 허용한다.
TTS audio revision은 승인 transcript revision을 `derived-from` lineage로 반드시
참조한다. 이미지의 preview/raster 변환도 원 source spec 또는 source image를
참조하는 별도 revision으로 기록한다.

### 5.2 생성 profile과 queue

| 테이블 | 핵심 열과 제약 |
|---|---|
| `prompt_template` | `template_id`, `version`, `body_sha256`, `schema_sha256`, `approved_at`, `retired_at`; body blob은 CAS에 저장 |
| `generation_profile` | `profile_id PK`, `kind`, `provider`, `model`, `model_revision`, `prompt_template_id`, `parameters_json`, `policy_snapshot_sha256`, `enabled`; 승인 allowlist |
| `generation_job` | `job_id PK`, `idempotency_key UNIQUE`, `spec_key`, `profile_id`, `status`, `priority`, `not_before`, `attempt_count`, `max_attempts`, `lease_owner`, `lease_expires_at`, `estimated_cost_micros`, `budget_reservation_id`, `provider_request_id`, `last_error_code`, timestamps |
| `job_event` | `event_id PK`, `job_id`, `event_type`, `actor_id`, `details_json`, `created_at`; append-only |
| `provider_usage` | `usage_id PK`, `job_id`, `provider_request_id`, input/output token·character·image·second 수, `actual_cost_micros`, currency, raw usage hash; 중복 청구 방지 unique key |
| `dead_letter` | `job_id PK`, `final_error_code`, `error_sha256`, `failed_at`, `disposition`; 민감한 provider body를 직접 저장하지 않음 |

`idempotency_key`는 `generationInputFingerprint + requestedOrdinal`의 hash다. 같은 부족분을
scheduler가 다시 계산해도 job이 늘어나지 않는다. provider가 자체 idempotency key를
지원하면 `job_id`를 전달한다. timeout 뒤 provider 결과를 알 수 없을 때는 즉시 새
요청하지 않고 provider request를 조회하거나 `unknown-outcome`으로 운영 검토에 보낸다.

Queue 상태는 다음 단방향 상태를 사용한다.

```text
queued -> leased -> running -> succeeded
   |         |         |
   |         +---------+-> retry-wait -> queued
   +---------------------> cancelled
                     \----> dead-letter
```

lease 만료는 job 실패가 아니라 reclaim 가능 상태다. worker는 heartbeat로 lease를
갱신하며 외부 API 호출 중 DB transaction을 열지 않는다. 재시도는 provider가 명시한
`Retry-After`를 우선하고, 아니면 bounded exponential backoff와 jitter를 사용한다.
인증 실패, invalid input, policy denial과 예산 거절은 재시도하지 않는다.

PostgreSQL claim의 핵심은 짧은 transaction 안의 `FOR UPDATE SKIP LOCKED`다.

```sql
WITH next_job AS (
  SELECT job_id
  FROM generation_job
  WHERE status IN ('queued', 'retry-wait')
    AND not_before <= CURRENT_TIMESTAMP
  ORDER BY priority DESC, not_before, job_id
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE generation_job AS j
SET status = 'leased', lease_owner = :worker,
    lease_expires_at = :lease_until, updated_at = CURRENT_TIMESTAMP
FROM next_job
WHERE j.job_id = next_job.job_id
RETURNING j.*;
```

SQLite는 `BEGIN IMMEDIATE`, 같은 조건의 `SELECT ... LIMIT 1`, 조건부 `UPDATE ... WHERE
job_id=? AND status IN (...)`, `COMMIT`을 사용한다. busy timeout은 lock contention을
숨기는 queue mechanism이 아니며 짧게 제한한다.

### 5.3 검증, 검토, 발행

| 테이블 | 핵심 열과 제약 |
|---|---|
| `validator_version` | `validator_id`, `version`, `code_sha256`, `rules_sha256`, `active_from`, `retired_at` |
| `validation_run` | `run_id PK`, `revision_id`, `validator_id/version`, `status`, `report_sha256`, `started_at`, `completed_at`; append-only |
| `review_policy` | `policy_id PK`, `version`, `kind`, `requirements_json`, `policy_sha256`, `active_from`; release가 사용한 snapshot 보존 |
| `review_decision` | `decision_id PK`, `revision_id`, `domain`, `reviewer_id`, `decision`, `evidence_sha256`, `policy_id`, `created_at`, `supersedes_decision_id`; append-only |
| `revision_state_event` | `event_id PK`, `revision_id`, `from_state`, `to_state`, `actor_id`, `reason_code`, `created_at`, `prev_event_sha256`, `event_sha256`; hash-chain 감사 |
| `corpus_release` | `release_id PK`, `schema_version`, `manifest_sha256 UNIQUE`, `review_policy_id`, `selection_algorithm`, `issued_at`, `issuer`, `status`; 발행 뒤 불변 |
| `release_entry` | `(release_id, revision_id) PK`, `spec_key`, `asset_id`, `ordinal`; approved revision만 허용 |
| `release_block` | `(release_id, revision_id) PK`, `reason_code`, `blocked_at`, `evidence_sha256`; 긴급 서빙 차단, manifest identity는 변경하지 않음 |

revision의 materialized `state`는 다음 상태 기계를 따른다.

```text
candidate -> validation-passed -> review-pending -> approved -> retired
    |               |                  |
    +---------------+------------------+-> quarantined
                                    \----> rejected
```

- validator는 `candidate -> validation-passed`만 수행한다.
- orchestration은 요구된 validator set이 모두 성공하면 `review-pending`으로 옮긴다.
- 사람 decision은 revision과 검토 영역별 append-only다. 결정을 정정할 때 기존 row를
  update하지 않고 `supersedesDecisionId`를 가진 row를 추가한다.
- 승인 transaction은 고정 `review_policy`가 요구하는 최신 유효 decision, reviewer
  분리, validator version을 다시 계산한 뒤에만 `approved`로 전환한다.
- 생성 worker와 validator는 reviewer가 될 수 없고, reviewer는 자신의 생성물을
  승인할 수 없다. curriculum은 서로 다른 두 reviewer, 그 밖의 필수 영역은 최소
  한 reviewer가 승인한다는 기존 정책을 기본값으로 둔다.
- 이 다중 reviewer 정책은 여러 기여자가 생성·검토하는 내구성 코퍼스 단계의 계약이다.
  첫 파일럿은 생성 자산을 받지 않고, 사람이 작성한 정적 묶음의 출처·권리·정답·
  접근성을 한 번 검토해 패키지한다.
- 수정은 rejected/quarantined revision을 되살리지 않고 새 revision을 만든다.
- validator rules가 바뀌면 기존 승인을 조용히 취소하지 않는다. 영향 revision을
  `revalidation-required` projection으로 표시하고 새 release 편입을 막은 뒤 재검증한다.

자산 종류별 최소 review 영역은 다음과 같다.

| 종류 | 필수 영역 |
|---|---|
| passage/dialogue | legal, curriculum(2인), language, answer, accessibility |
| structured-media/image | legal, curriculum(2인), answer, accessibility, security |
| TTS audio | transcript revision 승인, legal/voice rights, language/pronunciation, accessibility, audio QA |

보안 또는 권리 위험은 어느 pre-release 상태에서도 `quarantined`로 보낼 수 있다.
정상적인 내용 부결은 `review-pending -> rejected`다.

## 6. Blob 저장과 cache

### 6.1 Object key와 쓰기

logical key는 storage vendor와 무관하게 다음 형태다.

```text
objects/sha256/ab/cd/<64-hex-digest>
```

업로드 절차는 `temporary upload -> byte count/digest/MIME 검증 -> 조건부 최종 쓰기 ->
blob_location 기록`이다. 로컬 filesystem에서는 같은 volume의 임시 파일을 flush한 뒤
atomic rename한다. object storage에서는 새 immutable key에 쓰고, 조건부 요청이나
동등한 충돌 방지 기능으로 기존 key를 덮어쓰지 않는다. DB row를 먼저 공개하지 않는다.

후보와 승인 객체는 최소한 IAM/prefix가 분리된 private 위치다. 승인은 후보 object를
수정하는 동작이 아니라 검증된 bytes를 approved 위치에 복사하고 digest를 다시 확인한
뒤 DB transaction에서 revision pointer를 활성화하는 동작이다. bucket versioning은
실수 복구에 유용하지만 content addressing과 DB revision을 대체하지 않는다(근거 10).
Object Lock을 쓰더라도 보존 기간·legal hold 기능일 뿐 review 승인이나 접근 통제를
대체하지 않는다(근거 11).

### 6.2 Runtime cache 정책

- cache key는 `blobSha256` 하나다. URL, asset title 또는 latest alias를 key로 쓰지 않는다.
- manifest와 blob은 함께 import한다. manifest hash와 모든 blob의 size/digest를 검증한
  뒤 임시 release directory를 atomic rename해 활성화한다.
- admission과 매 read 때 size와 digest를 검증한다. 별도 주기적 전체 scrub도 수행한다.
  성능 최적화가 필요해도 검증을 생략하지 말고, 검증된 열린 file descriptor의 process-local
  재사용처럼 bytes 교체를 막는 방식만 허용한다.
- immutable blob에는 시간 기반 freshness TTL이 없다. LRU는 **현재 pin된 release와
  재생성 지원 기간의 release를 제외한** blob에만 적용한다.
- release index는 `(releaseId, manifestSha256)`로 pin한다. `latest`는 관리자 편의 alias일
  뿐 worksheet에 기록하지 않는다.
- online 배포에서는 origin fetch를 허용하되 짧은 timeout, bounded retry, digest 검증을
  거친다. 완전 offline bundle에서는 누락이 import 오류이며 다른 revision으로 대체하지 않는다.
- HTTP cache는 immutable object에 긴 cache lifetime을 사용할 수 있지만 recall block을
  집행해야 하는 경로는 authorization gateway를 통과시킨다. 공개 영구 URL을 만들지 않는다.

권장 offline bundle:

```text
asset-corpus/<releaseId>/
  manifest.jcs.json
  manifest.sha256
  objects/sha256/ab/cd/<digest>
  REVOCATIONS.json        # 선택적, 서명된 최신 차단 목록
```

bundle은 이동 가능한 cache이지 review DB의 backup이 아니다. import/export 양쪽에서
같은 canonicalization test vector와 digest를 사용한다.

## 7. 생성 유형별 pipeline

### 7.1 Passage와 dialogue

1. spec에는 평가 기능, 학년군, 허용 어휘, 길이, 근거 구간 요구를 고정한다.
2. LLM은 schema-constrained JSON 후보를 만든다.
3. 원문 text와 구조화 metadata를 별도 payload role로 저장한다.
4. schema, 어휘, 길이, PII/URL, 중복, 근거 구간과 정답 유일성 자동 gate를 실행한다.
5. language, curriculum, answer, legal, accessibility review를 수행한다.

검색 결과나 권한 없는 원문을 prompt에 넣지 않는다. retrieval 입력은 먼저 sourced
revision과 권리 기록으로 등록해야 한다.

### 7.2 Structured media와 생성 이미지

검증 가능한 JSON/SVG를 자유 형식 pixel image보다 우선한다. SVG/HTML은 script,
event handler, `foreignObject`, 외부 URL/font와 임의 CSS가 없는 안전 subset으로
sanitizing한 뒤 raster preview와 함께 저장한다. 자유 형식 image가 꼭 필요하면 source
image, crop/resize derivative, alt text를 각각 payload/lineage로 기록하고 OCR, PII,
상표, 안전, 정답 누출을 검사한다. 이미지 metadata나 provider watermark를 제거해야
하면 권리 정책에 기록하고 derivative revision으로 만든다.

### 7.3 TTS

TTS job은 승인 transcript revision만 입력으로 받는다. voice ID, locale, speaking rate,
pitch, SSML, provider/model revision과 voice redistribution terms를 profile에 고정한다.
무손실 archival audio와 배포 encoding을 별도 payload로 저장하고 실제 duration,
sample rate, channel, loudness, transcript alignment를 검증한다. SSML 사용 시 W3C SSML
1.1 계약을 기준으로 허용 subset을 정의한다(근거 12). 발음·억양·속도와 평가하려는
소리-철자 관계는 사람 검토 대상이다.

## 8. 비용과 용량 제어

비용 제어는 실패 후 알림이 아니라 enqueue 전 reservation이다.

| 제어 | 동작 |
|---|---|
| 부족분 기반 생성 | `desiredApprovedCount - approvedEligibleCount - viablePendingCount`만 enqueue |
| dedupe | spec/profile/ordinal idempotency key와 blob digest 중복 제거 |
| 계층 예산 | provider, model, kind, project, 일·월·release별 hard limit |
| reservation | 예상 최대 token/character/image/audio second 비용을 queue 전에 원자 예약; 완료 시 actual로 정산 |
| concurrency/rate | provider별 token bucket과 worker concurrency. 429의 `Retry-After` 준수 |
| retry 상한 | job별 max attempts와 최대 누적 예상 비용; unknown outcome은 사람 확인 |
| batch | latency가 중요하지 않은 후보 생성은 provider의 공식 batch 기능/할인이 계약상 적합할 때만 사용(근거 13) |
| 조기 중단 | schema/권리 입력이 불완전하면 모델 호출 전 reject; passage 승인 전 TTS 생성 금지 |
| kill switch | profile/provider를 disable하고 queued job을 cancel; 승인 runtime은 계속 동작 |

예산 원장은 다음을 분리한다.

```text
estimated generation + actual generation + automatic validation
+ human review + storage + delivery/egress + rework + recall
```

`budget_account(period, scope, hard_limit_micros, reserved_micros,
actual_micros)`와 `budget_reservation(reservation_id, job_id, estimate,
state, expires_at)`를 둔다. reservation 생성과 job enqueue는 같은 DB transaction이다.
worker가 죽은 reservation은 lease와 별개로 reconciliation job이 회수한다. 가격표는
`provider_price(provider, sku, currency, unit, unit_price, effective_from,
source_url)`로 버전 관리해 과거 실제 비용을 현재 가격으로 다시 계산하지 않는다.

비용 지표는 성공 job당 비용만 보지 않고 `approved revision당 총비용`, 검증 탈락률,
review 시간, 재작업률, unused approved asset 비율을 kind/spec별로 본다. 낮은 승인률은
provider를 더 호출할 신호가 아니라 spec/profile을 중단하고 검토할 신호다.

## 9. Local과 cloud 배포

### 9.1 Local/offline 기본형

```text
one Node control-plane process
  SQLite (WAL, foreign_keys=ON, busy_timeout bounded)
  local CAS on same machine
  local worker subprocesses
  review UI bound to loopback/LAN policy

learner runtime
  read-only exported release bundle
  no DB/provider dependency
```

- DB와 WAL/SHM 파일은 같은 local filesystem에 둔다.
- generation concurrency는 높일 수 있어도 DB write는 event를 batch하지 말고 짧은
  transaction으로 직렬화한다.
- SQLite Online Backup API 또는 일관된 backup 절차를 쓰고 DB 파일만 임의 복사하지
  않는다(근거 14). DB backup과 CAS snapshot의 공통 checkpoint manifest를 남긴다.
- restore drill은 DB, blob, manifest hash를 함께 검사한다.

### 9.2 Cloud/협업형

```text
scheduler/API -> PostgreSQL primary -> backup/PITR
workers ------> private candidate object storage
review UI ----> metadata + short-lived authorized previews
publisher ----> approved object storage + immutable manifest
CDN/gateway --> authorized approved assets
runtime ------> pinned release cache
```

- private network, TLS, managed identity와 역할별 최소 권한을 쓴다.
- scheduler, generator, validator, reviewer, publisher identity를 분리한다.
- provider egress는 allowlist proxy를 통하고 secret은 secret manager에서 주입한다.
- signed URL은 짧게 유지하고 log에 쓰지 않는다.
- object lifecycle은 candidate/rejected retention에만 적용한다. approved/issued asset은
  권리·recall 정책과 충돌하지 않도록 별도 rule을 쓴다.
- DB PITR만으로 blob을 복구할 수 없고 bucket versioning만으로 metadata를 복구할 수
  없다. 공통 checkpoint와 정기 restore test가 필요하다.

PostgreSQL과 object storage가 unavailable이어도 이미 cache된 release의 learner
runtime은 계속 동작한다. control plane은 새 생성·승인·발행을 중단하고 split-brain
release를 만들지 않는다.

## 10. 보안, privacy, provenance

- prompt에는 learner ID, 응답, 연락처, 미공개 교사 입력과 권한 없는 원문을 넣지 않는다.
- provider/model/region/retention/학습 사용 여부와 약관 version을 profile policy snapshot에
  고정한다. 권리 증명 없는 출력은 승인하지 않는다.
- 모든 외부 입력은 untrusted다. LLM 출력의 URL 또는 지시를 실행하지 않는다.
- 원본 provider response는 필요한 최소 기간만 private quarantine에 보존하고, 운영 log에는
  hash, request ID, usage와 분류된 오류만 남긴다.
- provenance는 W3C PROV의 entity/activity/agent 구분을 참고하되 기록이 사실성 또는
  권리를 자동 증명한다고 주장하지 않는다(근거 15). 생성형 AI 위험 관리는 NIST AI RMF와
  GenAI Profile의 govern/map/measure/manage 체계를 운영 review에 연결한다(근거 16, 17).
- 감사 hash chain은 tamper-evidence이지 서명이나 외부 timestamp가 아니다. 높은 보증이
  필요하면 정기 audit root를 별도 서명해 write-once 위치에 보관한다.

## 11. Migration 단계

각 단계는 독립적으로 rollback 가능해야 하며 기존 asset-free worksheet 결과를
바꾸지 않는다.

### Phase 0 - 계약과 test vector

- asset, revision, review, release JSON Schema를 추가한다.
- JCS/SHA-256 golden vector와 manifest 정렬 test를 만든다.
- 현재 `worksheet@2`에는 자산을 연결하지 않는다.
- 권리, review policy, recall/410과 offline bundle 운영 규칙을 승인한다.

**완료:** 같은 fixture가 Windows/Linux의 reference implementation에서 같은 digest를
만들고, 미승인 revision release가 fail-closed한다. PostgreSQL adapter는 아직 만들지
않는다.

### Phase 1 - 로컬 read-only corpus MVP

- 사람이 작성하고 검토한 작은 passage/structured-media corpus를 local CAS에 넣는다.
- SQLite에는 asset/revision/review/release metadata만 둔다.
- exporter/importer가 완전한 offline bundle을 만들고 digest를 검증한다.
- learner runtime은 아직 feature flag 뒤에서 pinned manifest만 읽는다.

**완료:** 네트워크와 모델 credential을 제거한 상태에서 worksheet 생성·재생성이 같고,
blob 하나를 변조/삭제하면 대체 없이 명시적으로 실패한다.

### Phase 2 - worksheet 계약 연결

- item에 `assetId`, `revisionId`, `payloadRole`, `blobSha256`을 추가한다.
- worksheet major를 올려 release ID와 manifest hash를 요구한다.
- fingerprint와 grading regeneration에 asset inputs를 포함한다.
- asset-free legacy path의 golden fingerprint는 유지하거나 명시적 compatibility reader로
  격리한다.

**완료:** release/revision 하나만 바꿔도 fingerprint가 달라지고, 발급 당시 release
없이는 채점하지 않는다.

### Phase 3 - 비동기 LLM/image 후보

- SQLite lease queue, generation profile, budget reservation과 provider adapter를 추가한다.
- passage/dialogue/structured image 후보만 만들며 learner route import boundary test로
  provider SDK 접근을 금지한다.
- 자동 gate와 독립 review 뒤에만 release 가능하다.

**완료:** provider outage, 429, timeout, duplicate schedule, worker crash를 deterministic
fixture로 검증하고 미검토 output이 runtime에서 조회되지 않는다.

### Phase 4 - 승인 transcript 기반 TTS

- transcript lineage, voice rights, audio QA, archival/distribution payload를 추가한다.
- 작은 언어/voice pilot만 발행한다.

**완료:** transcript 변경이 새 audio revision을 요구하고, offline 재생과 접근성 대본이
일치하며 사람이 발음·속도·명료도를 승인한다.

### Phase 5 - PostgreSQL/object storage 전환

- 실제 관측된 동시성/운영 기준이 충족될 때 dual-read가 아닌 **export/import cutover**를
  사용한다. SQLite snapshot을 freeze하고 canonical rows와 CAS를 PostgreSQL/object
  storage로 import한다.
- row count가 아니라 모든 revision/release fingerprint와 blob digest를 대조한다.
- 새 control plane을 read-only 검증한 뒤 writer를 한 번만 전환한다. SQLite writer를
  중지하기 전 PostgreSQL writer를 열지 않는다.
- rollback은 새 writer를 중지하고 cutover 이후 생성된 candidate/job event를 역 export한
  뒤 수행한다. 발행 release identity는 어느 쪽에서도 바뀌지 않는다.

**완료:** queue 경쟁, backup/restore, IAM, recall, budget reconciliation과 offline bundle
export를 staging에서 검증한다.

## 12. 운영 지표와 경보

필수 지표:

- spec별 approved/viable-pending/shortage 수
- queue age, lease reclaim, retry, dead-letter, unknown outcome
- provider/model별 token·character·image·audio second와 actual cost
- validation failure reason, review lead time, approval/rejection/rework 비율
- release publish 실패, manifest/blob digest mismatch
- runtime cache hit, origin recovery, unavailable revision, recall block
- rights expiry와 revalidation-required revision
- backup age와 마지막 restore drill 결과

학습자 요청의 cache miss, provider 장애와 budget exhaustion은 generation fallback을
일으키지 않는다. 경보는 control plane 운영자에게만 가고 승인 runtime의 결과를
바꾸지 않는다.

## 13. 근거와 한계

아래는 2026-08-09에 확인한 공식·표준 문서다.

1. SQLite, *Write-Ahead Logging*: WAL concurrency와 same-host 요구.
   <https://www.sqlite.org/wal.html>
2. SQLite, *Appropriate Uses For SQLite*: single-writer와 client/server 선택 기준.
   <https://www.sqlite.org/whentouse.html>
3. PostgreSQL, *Concurrency Control / MVCC*.
   <https://www.postgresql.org/docs/current/mvcc.html>
4. PostgreSQL, `SELECT` locking clause: `SKIP LOCKED`와 queue-like table 용도.
   <https://www.postgresql.org/docs/current/sql-select.html>
5. AWS, *Amazon S3 data consistency model*.
   <https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel>
6. AWS, *Checking object integrity*: supported checksums.
   <https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html>
7. IETF RFC 8785, *JSON Canonicalization Scheme (JCS)*.
   <https://www.rfc-editor.org/rfc/rfc8785>
8. IETF RFC 9110 section 8.8, *Validators / ETag*.
   <https://www.rfc-editor.org/rfc/rfc9110.html#name-validators>
9. SPDX, *License List*.
   <https://spdx.org/licenses/>
10. AWS, *Using versioning in S3 buckets*.
    <https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html>
11. AWS, *S3 Object Lock*.
    <https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html>
12. W3C, *Speech Synthesis Markup Language (SSML) Version 1.1*.
    <https://www.w3.org/TR/speech-synthesis11/>
13. OpenAI, *Batch API guide*. 이는 한 provider의 기능 예시이며 portable 계약이 아니다.
    <https://developers.openai.com/api/docs/guides/batch>
14. SQLite, *Online Backup API*.
    <https://sqlite.org/backup.html>
15. W3C, *PROV-O: The PROV Ontology*.
    <https://www.w3.org/TR/prov-o/>
16. NIST, *AI Risk Management Framework (AI RMF 1.0)*.
    <https://www.nist.gov/itl/ai-risk-management-framework>
17. NIST AI 600-1, *Generative Artificial Intelligence Profile*.
    <https://doi.org/10.6028/NIST.AI.600-1>

AWS 문서의 consistency, checksum, versioning과 Object Lock 특성은 AWS S3에 대한
것이다. 다른 S3-compatible 제품은 conformance test로 확인해야 한다. NIST 문서는
자발적 risk-management 지침이며 법률·교육 타당도·provider 출력 권리를 대신하지
않는다. 내용 주소화와 provenance도 콘텐츠의 진실성, 공정성 또는 라이선스를 스스로
증명하지 않는다.
