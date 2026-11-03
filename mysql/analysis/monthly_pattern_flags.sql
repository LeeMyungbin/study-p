-- 2026-09 monthly pattern analysis (MySQL 8 port of sql/monthly_pattern_flags.sql)
-- SQLite substr() on TEXT dates -> DATETIME range filter + DAY()
-- The range filter (instead of DATE_FORMAT(created_at)=...) lets MySQL use idx_hist_student_time.
WITH monthly AS (
  SELECT ph.student_id, ph.type_code, DAY(ph.created_at) AS day_of_month
  FROM point_history ph
  JOIN students s ON s.student_id = ph.student_id
  WHERE s.is_test = 1
    AND ph.created_at >= '2026-09-01' AND ph.created_at < '2026-10-01'
    AND ph.points > 0
), summary AS (
  SELECT student_id,
         COUNT(*)                                                   AS total_activity,
         COUNT(DISTINCT type_code)                                  AS activity_types,
         ROUND(100.0 * SUM(type_code = 'attendance') / COUNT(*), 1) AS attendance_pct,
         SUM(day_of_month <= 15)                                    AS early_activity,
         SUM(day_of_month >= 16)                                    AS late_activity
  FROM monthly
  GROUP BY student_id
)
SELECT student_id, total_activity, activity_types, attendance_pct, early_activity, late_activity,
       CASE WHEN attendance_pct >= 70 THEN 'Y' ELSE '-' END AS attendance_heavy,
       CASE WHEN early_activity >= 4 AND late_activity <= early_activity * 0.5 THEN 'Y' ELSE '-' END AS late_month_decline,
       CASE WHEN activity_types >= 4 AND total_activity >= 8 THEN 'Y' ELSE '-' END AS diverse_activity
FROM summary
ORDER BY student_id;
