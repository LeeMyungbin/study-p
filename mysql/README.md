# MySQL

Study P를 Cloudflare D1(SQLite)에서 MySQL 8로 옮기면서 만든 스키마와 쿼리입니다.

| 파일 | 내용 |
|---|---|
| `01_schema.sql` | 테이블 4개: `students`, `activity_types`, `activity_requests`, `point_history` |
| `02_seed_activity_types.sql` | 활동 유형 기준표 |
| `analysis/` | 분석 쿼리 (기존 `legacy-sqlite/` 쿼리를 MySQL 문법으로 옮긴 것 포함) |
| `fixtures/portfolio_test_scenarios.sql` | 테스트 시나리오 A/B/C. 실제 학생 데이터가 아님 |

## 테이블 관계

```text
students 1 ─< activity_requests >─ 1 activity_types
    │               │ (승인되면)
    └──────< point_history  (request_id UNIQUE: 승인 1건 = 기록 1건)
```

## SQLite에서 바뀐 점

- 날짜를 TEXT 대신 `DATETIME`으로 저장. `substr(created_at,1,7)` 대신 날짜 범위 조건을 써서 인덱스를 탈 수 있게 함
- 활동 유형을 기준표(`activity_types`)로 분리하고 외래키로 연결. 오타 난 유형이 들어오지 않음
- 제약 조건으로 막는 데이터
  - 같은 요청이 두 번 적립되는 것 (`uq_history_request`)
  - 대기 중인데 처리 시각이 있거나, 처리됐는데 처리 시각이 없는 요청 (`chk_req_review`)
  - 사유 없는 거절 (`chk_req_reject_reason`)
  - 0점 기록 (`chk_hist_points`)
- 테스트 계정을 `student_id` 목록 대신 `students.is_test`로 구분

## 실행

```bash
docker compose up -d
docker compose exec -T mysql mysql -uroot -pstudyp < mysql/fixtures/portfolio_test_scenarios.sql
docker compose exec -T mysql mysql -uroot -pstudyp study_p < mysql/analysis/monthly_change_lag.sql
```

옮긴 쿼리 두 개의 결과가 기존 README의 D1 결과(A +4, B -3, C 0 등)와 같은 것을 확인했습니다.
