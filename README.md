# Study P

> 학습 활동 데이터를 기록·승인·집계하여 월간 학습 패턴과 변화를 확인하는 개인 데이터 분석 프로젝트

## Project Overview
Study P는 공부방의 도장 기반 보상 기록을 데이터로 전환하고, 학생별 학습 활동을 월 단위로 집계·분석하기 위해 만든 프로젝트입니다.

**분석 가능한 데이터 구조 설계 → SQL 집계 → 패턴 탐지 → 결과 검증 → 운영 리포트 연결**에 초점을 두었습니다.

- Role: 개인 프로젝트
- Database: Cloudflare D1 (SQLite)
- Analysis: SQL, CTE, Window Function
- App: React / Next.js / TypeScript
- Report: Notion 연동
- Validation: 테스트 시나리오 데이터 기반

> 공개 분석 결과는 실제 학생 개인정보가 아닌 포트폴리오용 테스트 시나리오 데이터를 사용합니다.

## 1. Problem
- 학생별 활동을 월 단위로 비교하기 어려움
- 등원·숙제·워크시트·평가 등 활동 구성을 한눈에 보기 어려움
- 활동 감소나 특정 활동 편중을 수작업으로 판단해야 함
- 기록이 분석 가능한 형태로 축적되지 않음

활동 요청과 승인 기록을 구조화하고, 승인 후 생성된 활동 이력을 기준으로 월간 지표를 계산하도록 설계했습니다.

## 2. Data Flow
```text
학생 활동 요청 → 관리자 승인/거절 → 승인 기록(point_history)
→ SQL 월간 집계 → 참여 비중·활동 다양성·시기 변화 분석 → 월간 리포트
```

테스트 학생 ID와 분석 월을 명시적으로 필터링해 다른 계정과 다른 월의 기록을 제외했습니다.

## 3. Monthly Pattern Analysis
2026년 9월 테스트 시나리오를 대상으로 전체 활동, 활동 유형 수, 등원 비중, 월 전·후반 활동량을 계산했습니다.

| Scenario | Total | Types | Attendance % | Early | Late |
|---|---:|---:|---:|---:|---:|
| A | 11 | 5 | 36.4% | 8 | 3 |
| B | 9 | 2 | 88.9% | 7 | 2 |
| C | 9 | 5 | 44.4% | 8 | 1 |

### Validation & Improvement
초기 단일 `CASE WHEN` 분류에서는 복수 조건을 만족해도 조건 우선순위에 따라 하나만 출력되는 문제를 확인했습니다. 학생 행동은 복수 특성을 동시에 가질 수 있다고 판단해 **단일 분류 → 독립 Flag** 방식으로 개선했습니다.

| Scenario | Attendance Heavy | Late-month Decline | Diverse Activity |
|---|:---:|:---:|:---:|
| A | - | Y | Y |
| B | Y | Y | - |
| C | - | Y | Y |

SQL: [`sql/monthly_pattern_flags.sql`](sql/monthly_pattern_flags.sql)

## 4. CTE + Window Function
전월 비교 로직 검증을 위해 8·9월 증가/감소/유지 테스트 시나리오를 구성했습니다. CTE로 월간 활동량을 집계하고 `LAG()`로 전월 값을 조회했습니다.

| Scenario | Aug | Sep | Change | Status |
|---|---:|---:|---:|---|
| A | 7 | 11 | +4 | increase |
| B | 12 | 9 | -3 | decrease |
| C | 9 | 9 | 0 | no-change |

Cloudflare D1 실제 실행 결과가 기대값과 일치함을 확인했습니다.

SQL: [`sql/monthly_change_lag.sql`](sql/monthly_change_lag.sql)

## 5. Verification Flow
1. 월간 활동 단일 유형 분류
2. 복수 조건 사례에서 정보 손실 발견
3. 독립 Flag 방식으로 개선
4. 9월 데이터만 필터링해 재검증
5. CTE + `LAG()`로 전월 변화량 계산
6. 증가(+4) / 감소(-3) / 유지(0)가 기대 결과와 일치함을 확인

## 6. Limitations
- 현재 검증은 실제 학생 데이터가 아닌 테스트 시나리오 기반입니다.
- 등원 편중 70%, 후반 활동 감소 50% 등의 임계값은 초기 운영 규칙입니다.
- 실제 운영 데이터 축적 후 분포와 변동성을 바탕으로 임계값을 재검증할 필요가 있습니다.
- 학생 개인정보, 사진 증빙, API Key, Cloudflare/Notion Secret은 공개 저장소에 포함하지 않습니다.

## Key Takeaway
분석 기준을 정의하고 SQL 결과를 검증하며, 예상과 다른 결과에서 분석 로직의 문제를 찾아 개선하는 과정을 수행했습니다.
