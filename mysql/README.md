# MySQL 분석 DB

앱(`web/`)은 Cloudflare D1(SQLite)에 기록하고, 분석은 MySQL 8에서 합니다.

```text
학생·관리자 → 앱(web/) → D1 운영 DB ──추출──▶ MySQL 분석 DB → 요청별 쿼리·검증 → 결과 전달
```

| 파일 | 내용 |
|---|---|
| `01_schema.sql` | D1 테이블을 MySQL로 옮긴 스키마 |
| `02_seed_activity_types.sql` | 활동 유형 이름표 |
| `analysis/` | 분석 쿼리 (`legacy-sqlite/` 쿼리를 MySQL 문법으로 옮긴 것 포함) |
| `fixtures/portfolio_test_scenarios.sql` | 테스트 시나리오 A/B/C. 실제 학생 데이터가 아님 |

## 테이블

| 테이블 | 내용 | D1에서 가져올 때 |
|---|---|---|
| `users` | 학생·관리자 | 아이디·비밀번호 해시는 빼고, 이름은 별칭으로 바꿈 |
| `point_requests` | 학생이 올린 활동 요청 | 사진은 빼고 `has_photo`(있음/없음)만 |
| `point_history` | 포인트 원장 (승인, 관리자 조정, 카드 교환) | 그대로 |
| `reward_requests` | 카드 교환 요청 | 그대로 |
| `attendance` | 하루 한 번 등원 기록 | 그대로 |
| `activity_types` | 유형 코드 → 한글 이름 | 분석 DB에만 있음 |

`sessions`, `settings`, `photo_evidence`는 분석에 필요 없고 민감해서 옮기지 않습니다.

## SQLite에서 바뀐 점

- **날짜:** TEXT(ISO 문자열) → `DATETIME`. 앱은 UTC로 저장하므로 일·월 집계는 `+ INTERVAL 9 HOUR`로 한국 시간 기준으로 맞춤
- **상태값:** 자유 TEXT → 앱이 실제로 쓰는 값만 허용하는 `ENUM`
- **앱 코드에만 있던 규칙을 DB 제약으로 옮김**

| 규칙 | 제약 |
|---|---|
| 요청 하나는 한 번만 적립 | `point_history.request_id` UNIQUE |
| 등원은 하루 한 번 | `attendance (student_id, day)` UNIQUE |
| 대기 중이면 처리 시각 없음, 처리됐으면 있음 | `chk_requests_review` |
| 보류할 때는 사유 필수 (거절은 사유 없어도 됨) | `chk_requests_hold_reason` |
| 처리 시각은 요청 시각 이후 | `chk_requests_time` |
| 승인된 카드만 배송 진행 | `chk_rewards_delivery` |
| 0점 기록 없음 | `chk_history_points` |

활동 유형은 외래키로 묶지 않았습니다. 앱이 유형을 자유 텍스트로 저장하기 때문에, 모르는 유형은 적재할 때 막지 않고 검증 쿼리로 찾아서 예외로 기록합니다.

## 실행

```bash
docker compose up -d
docker compose exec -T mysql mysql -uroot -pstudyp < mysql/fixtures/portfolio_test_scenarios.sql
docker compose exec -T mysql mysql -uroot -pstudyp study_p < mysql/analysis/monthly_change_lag.sql
```

옮긴 쿼리 두 개의 결과가 기존 README의 D1 결과(A +4, B -3, C 0 등)와 같은 것을 확인했습니다.
