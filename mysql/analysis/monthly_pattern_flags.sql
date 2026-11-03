-- 2026-09 monthly pattern analysis (MySQL 8 port of legacy-sqlite/monthly_pattern_flags.sql)
-- * The app stores UTC; days are counted in KST (+9h) so late-evening records land on the right day.
-- * The month filter is a range on the raw column so idx_history_student_time can be used.
WITH monthly AS (
  SELECT ph.student_id,
         ph.type,
         DAY(ph.created_at + INTERVAL 9 HOUR) AS day_kst
  FROM point_history ph
  JOIN users u ON u.id = ph.student_id
  WHERE u.role = 'student'
    AND u.id LIKE 'portfolio-test-%'
    AND ph.created_at >= '2026-09-01' - INTERVAL 9 HOUR
    AND ph.created_at <  '2026-10-01' - INTERVAL 9 HOUR
    AND ph.points > 0
), summary AS (
  SELECT student_id,
         COUNT(*)                                              AS total_activity,
         COUNT(DISTINCT type)                                  AS activity_types,
         ROUND(100.0 * SUM(type = 'attendance') / COUNT(*), 1) AS attendance_pct,
         SUM(day_kst <= 15)                                    AS early_activity,
         SUM(day_kst >= 16)                                    AS late_activity
  FROM monthly
  GROUP BY student_id
)
SELECT student_id, total_activity, activity_types, attendance_pct, early_activity, late_activity,
       CASE WHEN attendance_pct >= 70 THEN 'Y' ELSE '-' END AS attendance_heavy,
       CASE WHEN early_activity >= 4 AND late_activity <= early_activity * 0.5 THEN 'Y' ELSE '-' END AS late_month_decline,
       CASE WHEN activity_types >= 4 AND total_activity >= 8 THEN 'Y' ELSE '-' END AS diverse_activity
FROM summary
ORDER BY student_id;
