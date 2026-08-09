-- ============================================================
-- 오늘의웨딩 · 상담 문의 폼 필드 추가용 (한 번만 실행)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 [Run]
-- ============================================================

alter table public.inquiries
  add column if not exists region text,
  add column if not exists guests text,
  add column if not exists budget text,
  add column if not exists wish_date text;
