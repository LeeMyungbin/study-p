-- Month-over-month change: CTE + LAG() validation
WITH monthly_activity AS (
 SELECT student_id,substr(created_at,1,7) AS month,COUNT(*) AS activity_count
 FROM point_history
 WHERE student_id IN ('portfolio-test-a','portfolio-test-b','portfolio-test-c')
   AND points>0 AND substr(created_at,1,7) IN ('2026-08','2026-09')
 GROUP BY student_id,substr(created_at,1,7)
), monthly_change AS (
 SELECT student_id,month,activity_count,
 LAG(activity_count) OVER (PARTITION BY student_id ORDER BY month) AS prev_month_activity
 FROM monthly_activity
)
SELECT student_id,month,activity_count,prev_month_activity,
 activity_count-prev_month_activity AS activity_change,
 CASE WHEN prev_month_activity IS NULL THEN 'baseline'
      WHEN activity_count>prev_month_activity THEN 'increase'
      WHEN activity_count<prev_month_activity THEN 'decrease'
      ELSE 'no-change' END AS change_status
FROM monthly_change ORDER BY student_id,month;
