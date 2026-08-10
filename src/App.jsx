import { useState, useMemo, useEffect } from "react";
import * as db from "./supabase";

/* ============================================================
   오늘의웨딩 — 결혼식장 예약 가능 자리 매칭 (작동 버전)
   공개: 리스트 → 상세 → 문의(구글폼)
   관리자: 자리 등록/수정/삭제 · 사진 업로드 · 상태 · 문의 · 구글폼 설정
   ============================================================ */

const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

const won = (n) => Number(n || 0).toLocaleString("ko-KR");
const priceText = (s) => `${won(s.price_min)}만~${won(s.price_max)}만원`;
const dateParts = (iso) => { const p = (iso || "").split("-"); return { m: +p[1] || 0, d: +p[2] || 0 }; };
const weekdayOf = (iso) => ["일", "월", "화", "수", "목", "금", "토"][new Date(iso).getDay()] || "";
const dday = (iso) => {
  const n = Math.round((new Date(iso) - new Date()) / 86400000);
  return n > 0 ? `D-${n}` : n === 0 ? "D-DAY" : "지남";
};
const STATUS = { 예약가능: "ok", 문의중: "wait", 마감: "closed" };
const STATUS_LIST = ["예약가능", "문의중", "마감"];

// 한 업체의 여러 날짜/시간을 표준화해서 반환 (구버전 단일 date/time도 호환)
const venueTimes = (s) => {
  if (Array.isArray(s.times) && s.times.length) {
    return s.times.filter((t) => t && t.date);
  }
  if (s.date) return [{ date: s.date, time: s.time || "", status: s.status || "예약가능" }];
  return [];
};
// 가장 가까운(예약가능 우선) 날짜
const primaryTime = (s) => {
  const ts = venueTimes(s);
  if (!ts.length) return null;
  const sorted = [...ts].sort((a, b) => new Date(a.date) - new Date(b.date));
  return sorted.find((t) => t.status === "예약가능") || sorted[0];
};
// 업체 대표 상태 (하나라도 예약가능이면 예약가능)
const venueStatus = (s) => {
  const ts = venueTimes(s);
  if (ts.some((t) => t.status === "예약가능")) return "예약가능";
  if (ts.some((t) => t.status === "문의중")) return "문의중";
  return ts.length ? "마감" : (s.status || "예약가능");
};
const monthKey = (iso) => { const p = (iso || "").split("-"); return p[0] && p[1] ? `${+p[1]}월` : ""; };
const KIND_PAL = {
  chapel: { s1: "#f7e9ec", s2: "#efd7dd", ac: "#c98b95", gl: "#fff6f2", kw: "wedding,chapel" },
  garden: { s1: "#eef2ea", s2: "#dde7d8", ac: "#8fa886", gl: "#f7fbf3", kw: "wedding,garden" },
  ballroom: { s1: "#f6efe6", s2: "#efe1cf", ac: "#c9a86a", gl: "#fdf8f0", kw: "wedding,ballroom" },
};
const palOf = (s) => KIND_PAL[s.kind] || KIND_PAL.chapel;

// 데모용 초기 데이터 (DB 비어있을 때만 화면에 보임 — 저장은 안 됨)
const DEMO = [
  { id: "demo1", venue: "그랜드 발렌시아", region: "서울 강남", district: "청담", times: [{ date: "2026-11-15", time: "오후 2시", status: "예약가능" }, { date: "2026-11-22", time: "오후 5시", status: "예약가능" }, { date: "2026-12-06", time: "오후 12시", status: "문의중" }], date: "2026-11-15", time: "오후 2시", price_min: 3000, price_max: 4000, cap: "300~400명", hall: "채플 · 단독홀", parking: "발렛 가능", meal: "코스/뷔페 선택", status: "예약가능", kind: "chapel", desc: "청담 대표 프리미엄 채플홀. 자연 채광이 아름다운 단독홀입니다.", photos: [], _demo: true },
  { id: "demo2", venue: "라포엠 웨딩", region: "서울 서초", district: "반포", times: [{ date: "2026-10-25", time: "오후 12시", status: "예약가능" }], date: "2026-10-25", time: "오후 12시", price_min: 2500, price_max: 3200, cap: "200~300명", hall: "밝은 홀 · 반단독", parking: "200대", meal: "뷔페", status: "예약가능", kind: "garden", desc: "화이트·그린톤의 밝고 싱그러운 홀. 합리적인 예산의 인기 식장입니다.", photos: [], _demo: true },
  { id: "demo3", venue: "아펠가모 선릉", region: "서울 강남", district: "선릉", times: [{ date: "2026-11-29", time: "오후 2시 30분", status: "문의중" }, { date: "2026-12-13", time: "오후 6시", status: "예약가능" }], date: "2026-11-29", time: "오후 2시 30분", price_min: 2800, price_max: 3600, cap: "300~400명", hall: "컨벤션 · 단독", parking: "300대", meal: "뷔페", status: "문의중", kind: "ballroom", desc: "샹들리에가 빛나는 클래식 볼룸. 대규모 하객도 우아하게 수용합니다.", photos: [], _demo: true },
];

/* ---------- 일러스트 (사진 없을 때) ---------- */
function VenueArt({ slot }) {
  const p = palOf(slot); const id = String(slot.id).replace(/\W/g, "");
  const Flower = ({ x, y, sc = 1 }) => (
    <g transform={`translate(${x} ${y}) scale(${sc})`}>
      {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-6" rx="3.4" ry="6" fill={p.ac} transform={`rotate(${a})`} opacity="0.95" />)}
      <circle r="2.6" fill={p.gl} />
    </g>
  );
  return (
    <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" className="art">
      <defs>
        <linearGradient id={`sk${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={p.s1} /><stop offset="100%" stopColor={p.s2} /></linearGradient>
        <radialGradient id={`gl${id}`} cx="50%" cy="42%" r="55%"><stop offset="0%" stopColor={p.gl} stopOpacity="0.95" /><stop offset="100%" stopColor={p.gl} stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="400" height="250" fill={`url(#sk${id})`} />
      <ellipse cx="200" cy="120" rx="180" ry="130" fill={`url(#gl${id})`} />
      <path d="M120 250 L120 120 Q120 46 200 46 Q280 46 280 120 L280 250 Z" fill={p.gl} opacity="0.55" />
      <path d="M120 250 L120 120 Q120 46 200 46 Q280 46 280 120 L280 250" fill="none" stroke={p.ac} strokeWidth="2.5" opacity="0.55" />
      <path d="M160 250 L200 150 L240 250 Z" fill={p.gl} opacity="0.5" />
      {slot.kind === "ballroom" ? (
        <g stroke={p.ac} strokeWidth="1.4" opacity="0.7">
          <line x1="200" y1="46" x2="200" y2="78" /><ellipse cx="200" cy="86" rx="22" ry="9" fill="none" /><ellipse cx="200" cy="96" rx="14" ry="6" fill="none" />
          {[-22, -8, 8, 22].map((dx) => <circle key={dx} cx={200 + dx} cy="92" r="2.5" fill={p.gl} stroke="none" />)}
        </g>
      ) : (
        <g><Flower x="160" y="60" sc="1.1" /><Flower x="200" y="48" sc="1.3" /><Flower x="240" y="60" sc="1.1" /><Flower x="132" y="96" sc="0.9" /><Flower x="268" y="96" sc="0.9" /></g>
      )}
      {[[90, 60], [320, 90], [70, 150], [330, 170], [110, 200]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill={p.ac} opacity="0.5" />)}
    </svg>
  );
}

/* ---------- 사진: 업로드본 > 무료사진 > 일러스트 ---------- */
function Photo({ slot, urlMap, seed = 0, className }) {
  const paths = slot.photos || [];
  const uploaded = paths[seed] ? urlMap[paths[seed]] : (paths[0] ? urlMap[paths[0]] : null);
  const free = `https://loremflickr.com/800/560/${palOf(slot).kw}?lock=${String(slot.id).length * 7 + seed}`;
  const [src, setSrc] = useState(uploaded || free);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setSrc(uploaded || free); setFailed(false); }, [uploaded, free]);
  if (failed) return <VenueArt slot={slot} />;
  return <img src={src} className={className} alt={slot.venue} loading="lazy" style={{ objectFit: "cover" }}
    onError={() => { if (src !== free && !uploaded) { setSrc(free); } else { setFailed(true); } }} />;
}

function DateChip({ iso, big }) {
  const { m, d } = dateParts(iso);
  return <div className={`datechip ${big ? "big" : ""}`}><span className="dc-md">{m}.{d}</span><span className="dc-wd">{weekdayOf(iso)}요일</span></div>;
}

/* ---------- 공개: 리스트 ---------- */
function Listing({ slots, urlMap, formUrl, onGoConsult, onOpen }) {
  const [region, setRegion] = useState("전체");
  const [cap, setCap] = useState("전체");
  const [month, setMonth] = useState("전체");
  const regions = ["전체", ...new Set(slots.map((s) => s.region).filter(Boolean))];
  // 데이터에 존재하는 월 목록 (가까운 순)
  const months = useMemo(() => {
    const set = new Set();
    slots.forEach((s) => venueTimes(s).forEach((t) => { const k = monthKey(t.date); if (k) set.add(k); }));
    return ["전체", ...[...set].sort((a, b) => parseInt(a) - parseInt(b))];
  }, [slots]);

  const list = useMemo(() =>
    slots.filter((s) => region === "전체" || s.region === region)
      .filter((s) => cap === "전체" || (s.cap || "").includes(cap.replace("명 이상", "")))
      .filter((s) => month === "전체" || venueTimes(s).some((t) => monthKey(t.date) === month)),
    [slots, region, cap, month]);

  const openCount = slots.reduce((n, s) => n + venueTimes(s).filter((t) => t.status === "예약가능").length, 0);

  return (
    <>
      <header className="nav">
        <div className="logo">오늘의<span className="logo-em">웨딩</span></div>
        <nav className="nav-links">
          <button className="cta-sm" onClick={onGoConsult}>상담 신청</button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-live"><span className="live-dot" /> 지금 예약 가능한 날짜 {openCount}건</div>
        <h1 className="hero-title">기다리던 그 날짜가,<br /><em>지금 예약 가능</em>합니다</h1>
        <p className="hero-sub">식장 잡는데 1년?<br />아닙니다. 더 빠르고, 저렴하게 이용하세요.</p>
        <button className="hero-cta" onClick={onGoConsult}>희망 내용 작성하기 →</button>
      </section>

      <section className="board">
        <div className="board-head">
          <h2>예약 가능 리스트</h2>
          <div className="filters">
            <select className={region === "전체" ? "ph" : ""} value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="전체">지역 선택</option>
              {regions.filter((r) => r !== "전체").map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className={cap === "전체" ? "ph" : ""} value={cap} onChange={(e) => setCap(e.target.value)}>
              <option value="전체">인원 선택</option>
              {["200명 이상", "300명 이상"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={month === "전체" ? "ph" : ""} value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="전체">날짜 선택</option>
              {months.filter((m) => m !== "전체").map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {list.length === 0 ? (
          <div className="empty">현재 안내 중인 자리가 없어요. 곧 새로운 자리가 올라옵니다 💐</div>
        ) : (
          <div className="slot-grid">
            {list.map((s) => {
              const pt = primaryTime(s); const ts = venueTimes(s); const st = venueStatus(s);
              return (
              <button className="slot-card" key={s.id} onClick={() => onOpen(s.id)}>
                <div className="slot-photo">
                  <Photo slot={s} urlMap={urlMap} seed={0} className="art" />
                  {pt && <DateChip iso={pt.date} />}
                  <span className={`status status-${STATUS[st]}`}>{st}</span>
                  <span className="slot-photo-name">{s.venue}</span>
                </div>
                <div className="slot-info">
                  <div className="slot-row1"><span className="slot-venue">{s.venue}</span>{pt && <span className="dday">{dday(pt.date)}</span>}</div>
                  <div className="slot-when">
                    {pt ? `${pt.time} · ` : ""}{s.region} {s.district}
                    {ts.length > 1 && <span className="more-dates">날짜 {ts.length}개</span>}
                  </div>
                  <div className="slot-price">{priceText(s)} <em>옵션에 따라 변동</em></div>
                  <div className="slot-tags"><span>{s.cap}</span><span>{s.hall}</span></div>
                </div>
              </button>
            );})}
          </div>
        )}
      </section>
      <ConsultForm />
      <Foot formUrl={formUrl} />
    </>
  );
}

/* ---------- 하단: 상담 문의 폼 ---------- */
function ConsultForm() {
  const [f, setF] = useState({ name: "", phone: "", region: "", guests: "", budget: "", wish_date: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name.trim() || !f.phone.trim()) { alert("이름과 연락처는 꼭 입력해 주세요."); return; }
    setBusy(true);
    try {
      await db.insertInquiry({
        name: f.name.trim(), phone: f.phone.trim(),
        region: f.region.trim(), guests: f.guests.trim(),
        budget: f.budget.trim(), wish_date: f.wish_date.trim(),
      });
      setDone(true);
    } catch (e) { alert("전송에 실패했어요. 잠시 후 다시 시도해 주세요."); }
    setBusy(false);
  };

  return (
    <section className="consult" id="consult">
      <div className="consult-inner">
        {done ? (
          <div className="consult-done">
            <div className="consult-done-mark">♥</div>
            <h2>문의가 접수되었어요!</h2>
            <p>남겨주신 연락처로 담당자가 빠르게 연락드릴게요.<br />오늘의웨딩과 함께 완벽한 날을 준비해요 💐</p>
            <button className="consult-again" onClick={() => { setF({ name: "", phone: "", region: "", guests: "", budget: "", wish_date: "" }); setDone(false); }}>다시 작성하기</button>
          </div>
        ) : (
          <>
            <div className="consult-head">
              <p className="consult-eyebrow">CONTACT</p>
              <h2>상담 문의</h2>
              <p className="consult-desc">원하는 조건을 남겨주시면, 담당자가 딱 맞는 자리를 직접 찾아 연락드려요.</p>
            </div>
            <div className="consult-grid">
              <label>이름 *<input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="성함을 입력해 주세요" /></label>
              <label>연락처 *<input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="010-0000-0000" /></label>
              <label>희망 지역<input value={f.region} onChange={(e) => set("region", e.target.value)} placeholder="예: 서울 강남" /></label>
              <label>예상 인원<input value={f.guests} onChange={(e) => set("guests", e.target.value)} placeholder="예: 250명" /></label>
              <label>예산<input value={f.budget} onChange={(e) => set("budget", e.target.value)} placeholder="예: 3천만원대" /></label>
              <label>희망 날짜<input value={f.wish_date} onChange={(e) => set("wish_date", e.target.value)} placeholder="예: 2026년 11월경" /></label>
            </div>
            <button className="consult-btn" onClick={submit} disabled={busy}>{busy ? "보내는 중…" : "문의 남기기"}</button>
            <p className="consult-note">* 이름과 연락처는 필수예요. 입력하신 정보는 상담 목적으로만 사용됩니다.</p>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------- 공개: 상세 ---------- */
function Detail({ slot, urlMap, formUrl, onGoConsult, onBack }) {
  const s = slot;
  const photoCount = Math.max((s.photos || []).length, 3);
  const [main, setMain] = useState(0);
  const times = useMemo(() => [...venueTimes(s)].sort((a, b) => new Date(a.date) - new Date(b.date)), [s]);
  const [pick, setPick] = useState(() => {
    const i = times.findIndex((t) => t.status === "예약가능");
    return i === -1 ? 0 : i;
  });
  const sel = times[pick] || null;
  const goForm = () => window.open(formUrl || "#", "_blank");
  return (
    <>
      <header className="nav">
        <div className="logo" onClick={onBack} style={{ cursor: "pointer" }}>오늘의<span className="logo-em">웨딩</span></div>
        <nav className="nav-links"><button className="link" onClick={onBack}>← 목록</button><button className="cta-sm" onClick={onGoConsult}>상담 신청</button></nav>
      </header>
      <div className="detail">
        <div className="detail-main">
          <div className="gallery">
            <div className="gallery-main"><Photo slot={s} urlMap={urlMap} seed={main} className="art" /></div>
            <div className="thumbs">
              {Array.from({ length: photoCount }).slice(0, 4).map((_, i) => (
                <button key={i} className={`thumb ${main === i ? "on" : ""}`} onClick={() => setMain(i)}><Photo slot={s} urlMap={urlMap} seed={i} className="art" /></button>
              ))}
            </div>
          </div>
          <div className="detail-body">
            <span className={`status status-${STATUS[venueStatus(s)]} big`}>{venueStatus(s)}</span>
            <h1 className="detail-venue">{s.venue}</h1>
            <p className="detail-loc">{s.region} {s.district}</p>
            {s.desc && <p className="detail-desc">{s.desc}</p>}

            {times.length > 0 && (
              <div className="date-picker">
                <div className="date-picker-title">예약 가능한 날짜 {times.length > 1 ? `(${times.length})` : ""}</div>
                <div className="date-chips">
                  {times.map((t, i) => (
                    <button key={i} disabled={t.status === "마감"}
                      className={`date-chip ${pick === i ? "on" : ""} dc-${STATUS[t.status]}`}
                      onClick={() => setPick(i)}>
                      <b>{(t.date || "").replaceAll("-", ".").slice(5)}</b>
                      <span>{weekdayOf(t.date)} · {t.time}</span>
                      {t.status !== "예약가능" && <em>{t.status}</em>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="spec">
              {sel && <div className="spec-row"><span>선택 날짜</span><b>{(sel.date || "").replaceAll("-", ".")} ({weekdayOf(sel.date)}) {sel.time}</b></div>}
              <div className="spec-row"><span>예상 가격</span><b className="spec-price">{priceText(s)} <em>옵션에 따라 변동</em></b></div>
              <div className="spec-row"><span>수용 인원</span><b>{s.cap}</b></div>
              <div className="spec-row"><span>홀 타입</span><b>{s.hall}</b></div>
              {s.parking && <div className="spec-row"><span>주차</span><b>{s.parking}</b></div>}
              {s.meal && <div className="spec-row"><span>식사</span><b>{s.meal}</b></div>}
            </div>
          </div>
        </div>
        <aside className="ask-box">
          {sel && <DateChip iso={sel.date} big />}
          <div className="ask-price">{priceText(s)}</div>
          {sel && <div className="ask-note">{sel.time} · {dday(sel.date)}</div>}
          <button className="ask-main" onClick={onGoConsult}>문의하기</button>
          <p className="ask-hint">희망 조건(날짜·인원·지역·예산)을 남겨주시면<br />담당자가 직접 연락드려요.</p>
          <ul className="ask-list"><li>♡ 제휴 웨딩홀 정식 예약</li><li>♡ 원하는 날짜 빠른 진행</li><li>♡ 합리적인 가격 안내</li></ul>
        </aside>
      </div>
      <Foot formUrl={formUrl} />
    </>
  );
}

function Foot({ formUrl }) {
  const goForm = () => formUrl ? window.open(formUrl, "_blank") : null;
  return (
    <footer className="foot">
      <div className="foot-inner">
        <div className="foot-left">
          <div className="foot-logo">오늘의웨딩</div>
          <p className="foot-tag">제휴 웨딩홀의 예약 가능한 자리를 정식으로 안내합니다.</p>
          <div className="foot-partner">
            <span>제휴 웨딩홀을 찾고 있어요.</span>
            <button className="foot-partner-btn" onClick={goForm}>제휴 문의하기</button>
          </div>
        </div>
        <div className="foot-right">
          <div className="foot-item"><span className="foot-label">대표번호</span><a href="tel:1666-5437">1666-5437</a></div>
          <div className="foot-item"><span className="foot-label">이메일</span><a href="mailto:sjs66622@naver.com">sjs66622@naver.com</a></div>
          <div className="foot-item"><span className="foot-label">주소</span><span>서울특별시 강남구 강남대로 338, 1512호 (루카831)</span></div>
        </div>
      </div>
      <div className="foot-copy">© 2026 오늘의웨딩. All rights reserved.</div>
    </footer>
  );
}

/* ================= 메인 ================= */
export default function App() {
  const [slots, setSlots] = useState([]);
  const [settings, setSettings] = useState({});
  const [urlMap, setUrlMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [route, setRoute] = useState({ page: "list", id: null }); // list/detail

  const formUrl = settings.google_form || "";

  // 페이지 이동 (브라우저 히스토리 반영 + 맨 위로 스크롤)
  const navigate = (next, push = true) => {
    setRoute(next);
    if (push && typeof history !== "undefined") history.pushState(next, "");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  // 폰 뒤로가기 버튼 → 이전 화면으로 (창 닫힘 방지)
  useEffect(() => {
    if (typeof history !== "undefined") history.replaceState({ page: "list", id: null }, "");
    const onPop = (e) => {
      setRoute(e.state || { page: "list", id: null });
      window.scrollTo({ top: 0, behavior: "auto" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 상담 폼으로 부드럽게 스크롤 (상세 페이지면 목록으로 이동 후 스크롤)
  const goConsult = () => {
    if (route.page !== "list") navigate({ page: "list", id: null });
    setTimeout(() => {
      const el = document.getElementById("consult");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const refresh = async () => {
    try {
      const [sl, st] = await Promise.all([db.loadSlots(), db.loadSettings()]);
      const data = sl.length ? sl : DEMO;
      setSlots(data);
      setSettings(st);
      const paths = data.flatMap((s) => s.photos || []);
      setUrlMap(await db.signedUrlMap(paths));
      setErr("");
    } catch (e) {
      // DB 아직 설정 전이면 데모라도 보여줌
      setSlots(DEMO);
      setErr("데이터 연결 전이에요. Supabase 설정(테이블/키)을 확인하면 실제 자리가 표시됩니다.");
    }
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const slot = slots.find((s) => s.id === route.id);

  if (loading) return <div className="boot"><Style /><span className="boot-logo">오늘의<b>웨딩</b></span></div>;

  return (
    <div className="root fade-in">
      <Style />
      {err && route.page === "list" && <div className="err-bar">{err}</div>}
      {route.page === "list" && (
        <Listing slots={slots} urlMap={urlMap} formUrl={formUrl} onGoConsult={goConsult}
          onOpen={(id) => navigate({ page: "detail", id })} />
      )}
      {route.page === "detail" && slot && <Detail slot={slot} urlMap={urlMap} formUrl={formUrl} onGoConsult={goConsult} onBack={() => history.back()} />}
      {route.page === "detail" && !slot && <div className="empty" style={{ padding: 80 }}>자리를 찾을 수 없어요. <button className="link" onClick={() => navigate({ page: "list", id: null })}>목록으로</button></div>}
    </div>
  );
}

function Style() {
  return (
    <style>{`
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
    @import url('https://fonts.googleapis.com/css2?family=Hahmlet:wght@400;500;600;700&display=swap');
    :root{
      --bg:#ffffff; --bg2:#fff5f8; --ink:#3a2f34; --ink2:#8a7a80; --ink3:#c2b2b8;
      --rose:#e35b86; --rose-deep:#c93f6e; --gold:#c9a86a; --blush:#ffe1ea; --line:#f4e3e8;
      --ok:#8fa886; --wait:#c9a86a; --closed:#b3aab0;
    }
    *{box-sizing:border-box}
    .root{font-family:'Pretendard',system-ui,sans-serif; color:var(--ink); background:var(--bg); min-height:100vh}
    button{font-family:inherit; cursor:pointer}
    .boot{min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); font-family:'Pretendard',sans-serif}
    .boot-logo{font-size:26px; font-weight:800; color:var(--ink); letter-spacing:-.5px; animation:pulse 1.1s ease-in-out infinite}
    .boot-logo b{color:var(--rose); font-weight:800}
    @keyframes pulse{0%,100%{opacity:.45}50%{opacity:1}}
    .fade-in{animation:fadeIn .4s ease both}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    .empty{padding:60px; text-align:center; color:var(--ink2)}
    .err-bar{margin:0 40px; margin-top:14px; padding:12px 16px; border-radius:12px; font-size:13px; background:#fdf0ee; border:1px solid #f3d9d5; color:#b06e7a}

    .nav{display:flex; align-items:center; justify-content:space-between; padding:20px 44px; border-bottom:1px solid var(--line); background:rgba(255,252,251,.92); backdrop-filter:blur(8px); position:sticky; top:0; z-index:20}
    .logo{font-family:'Hahmlet',serif; font-weight:700; font-size:23px; letter-spacing:.5px; color:var(--ink)}
    .logo-em{color:var(--rose-deep)}
    .logo .adm{font-family:'Pretendard'; font-size:12px; font-weight:700; letter-spacing:2px; color:var(--gold); margin-left:6px}
    .nav-links{display:flex; align-items:center; gap:18px}
    .link{border:0; background:none; color:var(--ink2); font-size:14px; font-weight:500}
    .link:hover{color:var(--ink)}
    .cta-sm{background:var(--rose); color:#fff; padding:9px 18px; border-radius:100px; font-size:14px; font-weight:600; border:0}
    .cta-sm:hover{background:var(--rose-deep)}

    .hero{max-width:900px; margin:0 auto; padding:82px 40px 58px; text-align:center}
    .hero-live{display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--rose-deep); background:var(--blush); padding:8px 16px; border-radius:100px; margin-bottom:26px}
    .live-dot{width:7px; height:7px; border-radius:50%; background:var(--ok); box-shadow:0 0 0 3px rgba(143,168,134,.25)}
    .hero-title{font-family:'Hahmlet',serif; font-size:44px; font-weight:600; line-height:1.4; letter-spacing:-.5px; margin:0 0 22px}
    .hero-title em{font-style:normal; color:var(--rose-deep)}
    .hero-sub{color:var(--ink2); font-size:16px; line-height:1.85; margin:0 0 32px}
    .hero-cta{border:0; background:var(--rose); color:#fff; padding:15px 32px; border-radius:100px; font-size:16px; font-weight:700; box-shadow:0 8px 22px rgba(201,139,149,.32)}
    .hero-cta:hover{background:var(--rose-deep)}

    .board{max-width:1120px; margin:0 auto; padding:20px 40px 70px}
    .board-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; flex-wrap:wrap; gap:14px}
    .board-head h2{font-family:'Hahmlet',serif; font-size:27px; font-weight:600; margin:0}
    .filters{display:flex; gap:10px; flex-wrap:wrap}
    .filters select{border:1px solid var(--line); background:#fff; color:var(--ink); padding:11px 16px; border-radius:100px; font-family:inherit; font-size:14px; outline:none; cursor:pointer}
    .filters select:focus{border-color:var(--rose)}
    .filters select.ph{color:var(--ink3); border-color:var(--line)}

    .more-dates{display:inline-block; margin-left:8px; font-size:11px; font-weight:700; color:var(--rose-deep); background:var(--blush); padding:2px 9px; border-radius:100px}

    /* 상세: 날짜 선택 */
    .date-picker{margin:0 0 24px}
    .date-picker-title{font-size:14px; font-weight:700; color:var(--ink); margin-bottom:11px}
    .date-chips{display:flex; gap:10px; flex-wrap:wrap}
    .date-chip{position:relative; border:1.5px solid var(--line); background:#fff; border-radius:14px; padding:11px 16px; cursor:pointer; text-align:center; min-width:92px; transition:.15s; font-family:inherit}
    .date-chip b{display:block; font-family:'Hahmlet',serif; font-size:17px; color:var(--ink); line-height:1.2}
    .date-chip span{display:block; font-size:11.5px; color:var(--ink2); margin-top:3px}
    .date-chip em{display:block; font-style:normal; font-size:10px; font-weight:700; margin-top:4px; color:var(--wait)}
    .date-chip:hover{border-color:var(--rose)}
    .date-chip.on{border-color:var(--rose); background:var(--bg2); box-shadow:0 4px 14px rgba(227,91,134,.16)}
    .date-chip.dc-closed{opacity:.5; cursor:not-allowed}
    .date-chip.dc-closed em{color:var(--closed)}
    .date-chip.dc-wait em{color:var(--wait)}

    /* 관리자: 여러 날짜 입력 */
    .times-box{margin-top:20px; border:1px solid var(--line); border-radius:14px; padding:18px}
    .times-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:12px}
    .times-head span{font-size:13px; font-weight:700; color:var(--ink2)}
    .add-time{border:1px solid var(--rose); background:var(--blush); color:var(--rose-deep); padding:7px 14px; border-radius:100px; font-family:inherit; font-size:13px; font-weight:700; cursor:pointer}
    .add-time:hover{background:var(--rose); color:#fff}
    .time-row{display:grid; grid-template-columns:1.3fr 1fr 1fr auto; gap:8px; margin-bottom:8px; align-items:center}
    .time-row input,.time-row select{border:1px solid var(--line); border-radius:9px; padding:9px 11px; font-family:inherit; font-size:13.5px; color:var(--ink); outline:none; background:#fff}
    .time-row input:focus,.time-row select:focus{border-color:var(--rose)}
    .time-del{border:1px solid var(--line); background:#fff; color:var(--ink2); width:34px; height:34px; border-radius:9px; cursor:pointer; font-size:12px}
    .time-del:hover:not(:disabled){border-color:var(--rose); color:var(--rose-deep)}
    .time-del:disabled{opacity:.35; cursor:not-allowed}

    .cnt-tag{font-style:normal; font-size:11px; font-weight:700; color:var(--rose-deep); background:var(--blush); padding:2px 8px; border-radius:100px; margin-left:7px}

    /* 하단 상담 문의 폼 */
    .consult{background:linear-gradient(180deg,#fff,var(--bg2)); border-top:1px solid var(--line); padding:64px 20px}
    .consult-inner{max-width:720px; margin:0 auto; background:#fff; border:1px solid var(--line); border-radius:24px; padding:40px 40px 34px; box-shadow:0 18px 50px rgba(227,91,134,.08)}
    .consult-head{text-align:center; margin-bottom:28px}
    .consult-eyebrow{color:var(--rose); font-weight:700; font-size:12px; letter-spacing:3px; margin:0 0 10px}
    .consult-head h2{font-family:'Hahmlet',serif; font-size:30px; font-weight:600; margin:0 0 12px}
    .consult-desc{color:var(--ink2); font-size:15px; line-height:1.7; margin:0}
    .consult-grid{display:grid; grid-template-columns:1fr 1fr; gap:16px}
    .consult-grid label{display:flex; flex-direction:column; gap:8px; font-size:13px; font-weight:700; color:var(--ink2)}
    .consult-grid input{border:1px solid var(--line); border-radius:12px; padding:13px 14px; font-family:inherit; font-size:14px; color:var(--ink); outline:none; background:var(--bg2)}
    .consult-grid input:focus{border-color:var(--rose); background:#fff}
    .consult-btn{width:100%; margin-top:22px; border:0; background:var(--rose); color:#fff; padding:16px; border-radius:14px; font-family:inherit; font-size:16px; font-weight:700; cursor:pointer; box-shadow:0 10px 24px rgba(227,91,134,.28); transition:.15s}
    .consult-btn:hover{background:var(--rose-deep)}
    .consult-btn:disabled{opacity:.6; cursor:default}
    .consult-note{text-align:center; color:var(--ink3); font-size:12px; margin:16px 0 0}
    .consult-done{text-align:center; padding:20px 0}
    .consult-done-mark{width:64px; height:64px; margin:0 auto 18px; border-radius:50%; background:var(--blush); color:var(--rose-deep); font-size:28px; display:flex; align-items:center; justify-content:center}
    .consult-done h2{font-family:'Hahmlet',serif; font-size:26px; font-weight:600; margin:0 0 12px}
    .consult-done p{color:var(--ink2); font-size:15px; line-height:1.7; margin:0 0 22px}
    .consult-again{border:1px solid var(--rose); background:none; color:var(--rose-deep); padding:11px 22px; border-radius:100px; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer}
    .consult-again:hover{background:var(--blush)}

    /* 관리자: 문의 카드 */
    .inq-list{display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px}
    .inq-card{position:relative; border:1px solid var(--line); border-radius:16px; padding:18px 20px; background:#fff}
    .inq-card-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--line)}
    .inq-who b{font-family:'Hahmlet',serif; font-size:17px}
    .inq-phone{color:var(--rose-deep); font-size:13px; font-weight:600; margin-left:10px; text-decoration:none}
    .inq-date{font-size:12px; color:var(--ink3)}
    .inq-fields{display:grid; grid-template-columns:1fr 1fr; gap:10px 14px}
    .inq-fields span{display:flex; flex-direction:column; gap:3px; font-size:14px; color:var(--ink)}
    .inq-fields em{font-style:normal; font-size:11px; font-weight:700; color:var(--ink3)}
    .inq-msg2{margin-top:12px; padding-top:12px; border-top:1px solid var(--line); font-size:13.5px; color:var(--ink2); line-height:1.6}
    .inq-del{position:absolute; top:16px; right:16px; border:1px solid var(--line); background:#fff; color:var(--ink2); border-radius:100px; padding:5px 12px; font-size:12px; cursor:pointer}
    .inq-del:hover{border-color:var(--rose); color:var(--rose-deep)}

    .slot-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:26px}
    .slot-card{text-align:left; border:1px solid var(--line); background:#fff; border-radius:22px; overflow:hidden; padding:0; transition:.2s}
    .slot-card:hover{transform:translateY(-5px); box-shadow:0 22px 48px rgba(176,110,122,.16); border-color:var(--blush)}
    .slot-photo{position:relative; aspect-ratio:16/11; overflow:hidden}
    .art{position:absolute; inset:0; width:100%; height:100%; object-fit:cover}
    img.art{background:var(--bg2)}
    .slot-photo-name{position:absolute; left:16px; bottom:14px; color:#fff; font-family:'Hahmlet',serif; font-size:17px; font-weight:600; z-index:2; text-shadow:0 1px 10px rgba(0,0,0,.4)}
    .datechip{position:absolute; top:14px; left:14px; z-index:2; background:rgba(255,255,255,.96); border-radius:14px; padding:8px 13px; text-align:center; box-shadow:0 6px 16px rgba(176,110,122,.18)}
    .dc-md{display:block; font-family:'Hahmlet',serif; font-size:20px; font-weight:700; color:var(--ink); line-height:1}
    .dc-wd{display:block; font-size:11px; color:var(--rose-deep); font-weight:700; margin-top:3px}
    .datechip.big{position:static; padding:16px; margin-bottom:16px; box-shadow:none}
    .datechip.big .dc-md{font-size:32px}
    .datechip.big .dc-wd{font-size:13px}
    .status{position:absolute; top:16px; right:14px; z-index:2; font-size:12px; font-weight:700; padding:5px 12px; border-radius:100px}
    .status-ok{background:rgba(143,168,134,.95); color:#fff}
    .status-wait{background:rgba(201,168,106,.95); color:#fff}
    .status-closed{background:rgba(179,170,176,.9); color:#fff}
    .status.big{position:static; display:inline-block; margin-bottom:14px}
    .slot-info{padding:17px 19px 21px}
    .slot-row1{display:flex; align-items:center; justify-content:space-between}
    .slot-venue{font-family:'Hahmlet',serif; font-weight:600; font-size:18px}
    .dday{font-size:12px; font-weight:700; color:var(--rose-deep); background:var(--blush); padding:3px 10px; border-radius:100px}
    .slot-when{color:var(--ink2); font-size:14px; margin-top:7px}
    .slot-price{margin-top:12px; font-size:17px; font-weight:800; color:var(--ink)}
    .slot-price em{font-style:normal; font-size:11px; font-weight:500; color:var(--ink3); margin-left:4px}
    .slot-tags{display:flex; gap:7px; margin-top:12px; flex-wrap:wrap}
    .slot-tags span{font-size:11.5px; color:var(--ink2); background:var(--bg2); border:1px solid var(--line); padding:4px 11px; border-radius:100px}

    .detail{max-width:1120px; margin:0 auto; padding:40px; display:grid; grid-template-columns:1fr 320px; gap:44px; align-items:start}
    .gallery-main{position:relative; aspect-ratio:16/10; border-radius:20px; overflow:hidden; margin-bottom:12px; background:var(--bg2)}
    .thumbs{display:flex; gap:10px}
    .thumb{position:relative; flex:1; aspect-ratio:4/3; border-radius:12px; border:2px solid transparent; overflow:hidden; padding:0; opacity:.65; transition:.15s; background:var(--bg2)}
    .thumb.on{opacity:1; border-color:var(--rose)}
    .detail-body{margin-top:34px}
    .detail-venue{font-family:'Hahmlet',serif; font-size:34px; font-weight:600; margin:0 0 6px}
    .detail-loc{color:var(--ink2); font-size:15px; margin:0 0 18px}
    .detail-desc{font-size:16px; line-height:1.9; color:#4d4149; margin:0 0 28px; white-space:pre-line}
    .spec{border:1px solid var(--line); border-radius:16px; overflow:hidden}
    .spec-row{display:grid; grid-template-columns:120px 1fr; padding:15px 20px; border-bottom:1px solid var(--line); font-size:15px}
    .spec-row:last-child{border-bottom:0}
    .spec-row span{color:var(--ink2)}
    .spec-price em{font-style:normal; font-size:12px; color:var(--ink3); font-weight:500; margin-left:6px}
    .ask-box{position:sticky; top:104px; border:1px solid var(--line); border-radius:20px; padding:26px 24px; text-align:center; background:linear-gradient(180deg,#fff,#fdf6f4); box-shadow:0 14px 36px rgba(176,110,122,.1)}
    .ask-box .datechip.big{background:var(--bg2); border:1px solid var(--line)}
    .ask-price{font-size:24px; font-weight:800; color:var(--ink)}
    .ask-note{font-size:12.5px; color:var(--ink2); margin:6px 0 20px}
    .ask-main{border:0; display:block; width:100%; background:var(--rose); color:#fff; padding:15px; border-radius:100px; font-size:16px; font-weight:700}
    .ask-main:hover{background:var(--rose-deep)}
    .ask-main.sm{width:auto; display:inline-block; padding:11px 20px; font-size:14px}
    .ask-hint{font-size:12.5px; color:var(--ink2); line-height:1.7; margin:14px 0 0}
    .ask-list{list-style:none; padding:18px 0 0; margin:18px 0 0; border-top:1px solid var(--line); font-size:13px; text-align:left; display:flex; flex-direction:column; gap:10px}
    .ask-list li{color:var(--rose-deep); font-weight:500}

    /* 관리자 */
    .nav-admin{background:var(--ink)}
    .nav-admin .logo{color:#fff}
    .nav-admin .link{color:#c9bcc2}
    .admin{max-width:1000px; margin:0 auto; padding:34px 40px}
    .atabs{display:flex; gap:6px; border-bottom:1px solid var(--line); margin-bottom:26px}
    .atabs button{border:0; background:none; padding:12px 18px; font-size:15px; font-weight:600; color:var(--ink2); margin-bottom:-1px}
    .atabs button.on{color:var(--rose-deep); border-bottom:2.5px solid var(--rose)}
    .admin-head{display:flex; justify-content:space-between; align-items:center; margin-bottom:20px}
    .admin-head h2{font-family:'Hahmlet',serif; font-size:24px; font-weight:600; margin:0}
    .demo-note{background:#fdf6ee; border:1px solid #f0e2cf; color:#a8843e; font-size:13px; padding:11px 15px; border-radius:10px; margin-bottom:16px}
    .admin-table{border:1px solid var(--line); border-radius:14px; overflow:hidden}
    .arow{display:grid; grid-template-columns:1.6fr 1.4fr 1.3fr 1fr .9fr 1.1fr; align-items:center; padding:14px 18px; border-bottom:1px solid var(--line); font-size:14px}
    .arow.inq{grid-template-columns:1fr 1.3fr 2fr 1fr .7fr}
    .arow:last-child{border-bottom:0}
    .ahead{background:var(--bg2); font-weight:700; color:var(--ink2); font-size:13px}
    .a-venue{font-weight:600; font-family:'Hahmlet',serif}
    .arow .status{position:static; display:inline-block; width:fit-content}
    .a-act{display:flex; gap:8px}
    .a-act button{border:1px solid var(--line); background:#fff; border-radius:100px; padding:6px 13px; font-size:13px}
    .demo-tag{font-style:normal; font-size:12px; color:var(--ink3)}
    .inq-msg{color:var(--ink2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
    .ahint{font-size:12px; color:var(--ink2); line-height:1.6; margin:8px 0 0}
    .setting-box{border:1px solid var(--line); border-radius:14px; padding:24px}
    .set-label{font-weight:700; font-size:15px}
    .set-row{display:flex; gap:10px; margin-top:14px}
    .set-row input{flex:1; border:1px solid var(--line); border-radius:10px; padding:11px 13px; font-family:inherit; font-size:14px; outline:none}
    .set-row input:focus{border-color:var(--rose)}

    /* 자리 등록 모달 */
    .overlay{position:fixed; inset:0; background:rgba(63,51,58,.5); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:50; padding:20px}
    .amodal{width:min(680px,100%); max-height:92vh; overflow:auto; background:#fff; border-radius:20px}
    .amodal-head{display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid var(--line); font-size:17px}
    .amodal-head b{font-family:'Hahmlet',serif}
    .xbtn{border:0; background:var(--bg2); width:32px; height:32px; border-radius:9px; color:var(--ink2)}
    .amodal-body{padding:22px 24px}
    .photos{display:flex; gap:10px; flex-wrap:wrap}
    .photo-item{position:relative; width:84px; height:84px; border-radius:12px; overflow:hidden; border:1px solid var(--line)}
    .photo-item img{width:100%; height:100%; object-fit:cover}
    .photo-del{position:absolute; top:3px; right:3px; width:20px; height:20px; border:0; border-radius:6px; background:rgba(0,0,0,.55); color:#fff; font-size:11px}
    .photo-add{width:84px; height:84px; border:1px dashed var(--rose); border-radius:12px; background:var(--bg2); color:var(--rose-deep); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font-size:20px; cursor:pointer}
    .photo-add span{font-size:11px}
    .fgrid{display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:18px}
    .fgrid label{display:flex; flex-direction:column; gap:6px; font-size:12.5px; font-weight:600; color:var(--ink2)}
    .fgrid label.full{grid-column:1/-1}
    .fgrid input,.fgrid textarea,.fgrid select{border:1px solid var(--line); border-radius:10px; padding:10px 12px; font-family:inherit; font-size:14px; color:var(--ink); outline:none; background:#fff}
    .fgrid input:focus,.fgrid textarea:focus,.fgrid select:focus{border-color:var(--rose)}
    .amodal-foot{display:flex; justify-content:flex-end; gap:10px; padding:18px 24px; border-top:1px solid var(--line)}
    .ghost{border:1px solid var(--line); background:none; color:var(--ink2); padding:10px 18px; border-radius:100px; font-size:14px; font-weight:600}

    .foot{border-top:1px solid var(--line); margin-top:20px; background:var(--bg2)}
    .foot-inner{max-width:1120px; margin:0 auto; padding:44px 40px 30px; display:flex; justify-content:space-between; gap:40px; flex-wrap:wrap}
    .foot-logo{font-family:'Hahmlet',serif; font-weight:700; font-size:22px; color:var(--rose-deep); margin-bottom:12px}
    .foot-tag{color:var(--ink2); font-size:14px; margin:0 0 20px; line-height:1.6}
    .foot-partner{display:flex; align-items:center; gap:14px; flex-wrap:wrap}
    .foot-partner span{font-size:14px; color:var(--ink); font-weight:600}
    .foot-partner-btn{border:1px solid var(--rose); background:none; color:var(--rose-deep); padding:9px 18px; border-radius:100px; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer}
    .foot-partner-btn:hover{background:#fff}
    .foot-right{display:flex; flex-direction:column; gap:12px; min-width:280px}
    .foot-item{display:flex; gap:14px; font-size:14px; color:var(--ink2)}
    .foot-label{min-width:60px; color:var(--rose-deep); font-weight:700; font-size:13px}
    .foot-item a{color:var(--ink2); text-decoration:none}
    .foot-item a:hover{color:var(--rose-deep)}
    .foot-copy{border-top:1px solid var(--line); text-align:center; padding:18px; font-size:12px; color:var(--ink3)}

    @media(max-width:820px){
      .detail{grid-template-columns:1fr} .ask-box{position:static}
      .hero-title{font-size:32px} .nav{padding:16px 20px}
      .hero,.board,.detail,.admin{padding-left:20px; padding-right:20px}
      .fgrid{grid-template-columns:1fr} .arow{grid-template-columns:1fr 1fr; gap:8px; font-size:13px}
      .arow.inq{grid-template-columns:1fr 1fr}
      .consult-grid{grid-template-columns:1fr}
      .consult-inner{padding:30px 22px 26px}
      .inq-list{grid-template-columns:1fr}
      .foot-inner{flex-direction:column; gap:26px; padding:36px 20px 24px}
      .foot-right{min-width:0}
    }
    `}</style>
  );
}
