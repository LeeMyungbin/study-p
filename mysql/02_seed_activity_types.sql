-- Activity type labels used in reports (codes come from the app: web/app/api/action/route.ts)
USE study_p;

INSERT INTO activity_types (type_code, name_ko, is_request) VALUES
  ('attendance', '등원',       1),
  ('homework',   '숙제',       1),
  ('worksheet',  '워크시트',   1),
  ('assessment', '평가',       1),
  ('other',      '기타',       1),
  ('adjust',     '관리자 조정', 0),
  ('reward',     '카드 교환',  0);
