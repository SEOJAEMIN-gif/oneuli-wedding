# 오늘의웨딩 — 결혼을 빠르고, 저렴하게. (결혼식장 빈자리 예약 매칭 사이트)

결혼을 빠르고, 더 저렴하게 할 수 있는 오늘의웨딩.
결혼식장의 비어 있는 자리에 합리적으로 들어가세요.

준비물: **Supabase**(무료) + **Vercel**(무료) + **GitHub**(무료)
회원관리 시스템 만들 때와 똑같은 방식이에요.

---

## A. Supabase 준비

### A-1. 프로젝트 생성
1. https://supabase.com → **New project** → Region: **Seoul**
2. 1~2분 기다려 생성

### A-2. 테이블 만들기
1. 왼쪽 **SQL Editor** → **New query**
2. `supabase/schema.sql` 내용을 **전체 복사 → 붙여넣기** → **Run**
3. "Success" 뜨면 완료 (자리/문의/설정 테이블 + 사진 저장소 생성)

### A-3. 연결 키 복사
1. **Project Settings → API Keys**
2. 상단 탭에서 **"Legacy anon, service_role API keys"** 클릭 ← 중요!
3. **`anon` `public`** 키(`eyJ...`로 시작)를 복사
4. **Project Settings → Data API** 또는 상단 프로젝트 URL에서 **Project URL** 복사
   (예: `https://xxxx.supabase.co`)

> ⚠️ 새 형식(`sb_publishable_...`) 키가 아니라 **Legacy anon 키(`eyJ...`)** 를 써야 로그인이 됩니다.

---

## B. Vercel 배포

### B-1. GitHub에 올리기
GitHub에서 새 저장소를 만들고 이 폴더 전체를 올립니다. (GitHub Desktop 앱 추천)

### B-2. Vercel 연결
1. https://vercel.com → **Add New → Project** → 저장소 Import
2. **Deploy 누르기 전에** Environment Variables 에 아래 2개 입력:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | 복사한 Project URL |
| `VITE_SUPABASE_ANON_KEY` | 복사한 **Legacy anon** 키 (`eyJ...`) |

3. **Deploy** → 1~2분 뒤 주소 완성 ✨

---

## C. 관리자 계정 만들기
1. Supabase → **Authentication → Users → Add user → Create new user**
2. 이메일 + 비밀번호 입력 → **Auto Confirm User 체크** → 생성
3. 사이트 우측 상단 **관리자** → 이 계정으로 로그인

---

## ✅ 사용법

**사이트(방문자용)**
- 예약 가능 리스트 → 카드 클릭 → 상세 → **문의하기(구글폼)**

**관리자**
- **자리 관리**: 자리 등록/수정/삭제, 사진 업로드(최대 4장), 상태 변경(예약가능/문의중/마감)
- **문의**: 사이트 내 폼으로 받은 문의 확인 (구글폼으로 받으면 구글 시트에 쌓임)
- **설정**: **구글폼 링크 입력** → 저장하면 모든 "문의/상담 신청" 버튼이 그 폼으로 연결됩니다

> 처음엔 예시 자리 3개가 보여요. **자리 관리에서 실제 자리를 하나 등록하면 예시는 사라집니다.**

---

## 📌 구글폼 만들기 (문의용)
1. https://forms.google.com 에서 새 폼 생성
2. 질문 예시: 희망 날짜, 지역, 예상 하객 수, 예산, 연락처
3. 우측 상단 **보내기 → 링크** 복사
4. 사이트 관리자 → **설정**에 붙여넣고 저장

---

## 💾 사진 & 데이터
- 자리·문의·설정은 Supabase에 저장 → 어느 기기에서 접속해도 동일
- 사진은 Supabase 저장소(무료 1GB)에 보관, 업로드하면 무료 이미지 대신 실사진이 노출됩니다
- 사진을 안 올린 자리는 분위기에 맞는 무료 이미지(또는 일러스트)가 자동으로 표시됩니다

## 🔧 수정하고 싶으면
Claude에게 말하면 코드를 고쳐줘요. GitHub에 덮어쓰면 Vercel이 자동 재배포합니다.
