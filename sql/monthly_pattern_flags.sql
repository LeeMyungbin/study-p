-- 2026-09 monthly pattern analysis (portfolio test scenarios)
WITH monthly AS (
 SELECT student_id,type,CAST(substr(created_at,9,2) AS INTEGER) AS day
 FROM point_history
 WHERE student_id IN ('portfolio-test-a','portfolio-test-b','portfolio-test-c')
   AND substr(created_at,1,7)='2026-09' AND points>0
), summary AS (
 SELECT student_id,COUNT(*) AS total_activity,COUNT(DISTINCT type) AS activity_types,
 ROUND(100.0*SUM(CASE WHEN type='attendance' THEN 1 ELSE 0 END)/COUNT(*),1) AS attendance_pct,
 SUM(CASE WHEN day<=15 THEN 1 ELSE 0 END) AS early_activity,
 SUM(CASE WHEN day>=16 THEN 1 ELSE 0 END) AS late_activity
 FROM monthly GROUP BY student_id
)
SELECT student_id,total_activity,activity_types,attendance_pct,early_activity,late_activity,
 CASE WHEN attendance_pct>=70 THEN 'Y' ELSE '-' END AS attendance_heavy,
 CASE WHEN early_activity>=4 AND late_activity<=early_activity*0.5 THEN 'Y' ELSE '-' END AS late_month_decline,
 CASE WHEN activity_types>=4 AND total_activity>=8 THEN 'Y' ELSE '-' END AS diverse_activity
FROM summary ORDER BY student_id;
