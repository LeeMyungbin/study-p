-- Month-over-month change: CTE + LAG() (MySQL 8 port of sql/monthly_change_lag.sql)
WITH monthly_activity AS (
  SELECT ph.student_id,
         DATE_FORMAT(ph.created_at, '%Y-%m') AS ym,
         COUNT(*)                            AS activity_count
  FROM point_history ph
  JOIN students s ON s.student_id = ph.student_id
  WHERE s.is_test = 1
    AND ph.points > 0
    AND ph.created_at >= '2026-08-01' AND ph.created_at < '2026-10-01'
  GROUP BY ph.student_id, DATE_FORMAT(ph.created_at, '%Y-%m')
), monthly_change AS (
  SELECT student_id, ym, activity_count,
         LAG(activity_count) OVER (PARTITION BY student_id ORDER BY ym) AS prev_month_activity
  FROM monthly_activity
)
SELECT student_id, ym AS month, activity_count, prev_month_activity,
       activity_count - prev_month_activity AS activity_change,
       CASE WHEN prev_month_activity IS NULL            THEN 'baseline'
            WHEN activity_count > prev_month_activity   THEN 'increase'
            WHEN activity_count < prev_month_activity   THEN 'decrease'
            ELSE 'no-change' END                         AS change_status
FROM monthly_change
ORDER BY student_id, month;
