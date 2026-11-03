-- Activity type master data
-- TODO: check names and points against the paper stamp board before the pilot
USE study_p;

INSERT INTO activity_types (type_code, name_ko, default_points, daily_limit) VALUES
  ('attendance', '등원',       1, 1),
  ('homework',   '숙제 완료',  1, NULL),
  ('worksheet',  '워크시트',   1, NULL),
  ('assessment', '평가',       2, NULL),
  ('extra',      '추가 학습',  1, NULL),
  ('reward',     '보상 교환', -1, NULL);   -- used only for negative point_history rows
