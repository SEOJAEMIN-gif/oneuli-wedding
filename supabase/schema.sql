-- ============================================================
-- 오늘의웨딩 · Supabase 초기 설정
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 [Run] 하세요.
-- ============================================================

-- 1) 예약 가능 자리
create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  venue text,
  region text,
  district text,
  date date,
  time text,
  price_min int default 0,
  price_max int default 0,
  cap text,
  hall text,
  parking text,
  meal text,
  status text default '예약가능',
  kind text default 'chapel',
  "desc" text,
  photos jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- 2) 문의 (사이트 내 폼으로 받을 경우)
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  message text,
  created_at timestamptz default now()
);

-- 3) 설정 (구글폼 링크 등)
create table if not exists public.settings (
  key text primary key,
  value text
);

-- 4) RLS
alter table public.slots enable row level security;
alter table public.inquiries enable row level security;
alter table public.settings enable row level security;

-- 자리/설정: 누구나 볼 수 있고(공개 사이트), 수정은 로그인한 관리자만
create policy "public read slots" on public.slots for select using (true);
create policy "admin write slots" on public.slots for all to authenticated using (true) with check (true);

create policy "public read settings" on public.settings for select using (true);
create policy "admin write settings" on public.settings for all to authenticated using (true) with check (true);

-- 문의: 누구나 등록 가능(방문자가 남김), 조회/삭제는 관리자만
create policy "anyone insert inquiry" on public.inquiries for insert with check (true);
create policy "admin read inquiry" on public.inquiries for select to authenticated using (true);
create policy "admin delete inquiry" on public.inquiries for delete to authenticated using (true);

-- 5) 사진 버킷 (비공개)
insert into storage.buckets (id, name, public)
values ('venue-photos', 'venue-photos', false)
on conflict (id) do nothing;

create policy "auth read venue photos" on storage.objects for select to authenticated using (bucket_id = 'venue-photos');
create policy "public read venue photos" on storage.objects for select using (bucket_id = 'venue-photos');
create policy "auth upload venue photos" on storage.objects for insert to authenticated with check (bucket_id = 'venue-photos');
create policy "auth delete venue photos" on storage.objects for delete to authenticated using (bucket_id = 'venue-photos');
