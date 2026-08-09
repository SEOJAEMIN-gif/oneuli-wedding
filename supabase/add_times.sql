-- ============================================================
-- 오늘의웨딩 · 여러 예약 날짜 기능 추가용 (한 번만 실행)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 [Run]
-- ============================================================

alter table public.slots
  add column if not exists times jsonb default '[]'::jsonb;

-- 기존 자리(단일 날짜)를 새 형식(times 배열)으로 옮겨두기
update public.slots
set times = jsonb_build_array(
  jsonb_build_object('date', to_char(date, 'YYYY-MM-DD'), 'time', coalesce(time, ''), 'status', coalesce(status, '예약가능'))
)
where date is not null
  and (times is null or jsonb_array_length(times) = 0);
