import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anon);
export const BUCKET = "venue-photos";

// ---------- 예약 가능 자리(slots) ----------
export async function loadSlots() {
  const { data, error } = await supabase
    .from("slots")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertSlot(s) {
  const { data, error } = await supabase.from("slots").upsert(s).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSlot(id) {
  const { error } = await supabase.from("slots").delete().eq("id", id);
  if (error) throw error;
}

// ---------- 문의(inquiries) — 사이트 내 폼으로 받을 경우 ----------
export async function loadInquiries() {
  const { data, error } = await supabase
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function insertInquiry(q) {
  const { data, error } = await supabase.from("inquiries").insert(q).select().single();
  if (error) throw error;
  return data;
}

export async function deleteInquiry(id) {
  const { error } = await supabase.from("inquiries").delete().eq("id", id);
  if (error) throw error;
}

// ---------- 설정(settings) — 구글폼 링크 등 ----------
export async function loadSettings() {
  const { data, error } = await supabase.from("settings").select("*");
  if (error) throw error;
  const o = {};
  (data || []).forEach((r) => (o[r.key] = r.value));
  return o;
}

export async function saveSetting(key, value) {
  const { error } = await supabase.from("settings").upsert({ key, value });
  if (error) throw error;
}

// ---------- 사진(비공개 버킷 + 서명 URL) ----------
export async function uploadPhoto(slotId, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${slotId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function deletePhoto(path) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function signedUrlMap(paths) {
  const uniq = [...new Set(paths.filter(Boolean))];
  if (uniq.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(uniq, 60 * 60);
  if (error) return {};
  const map = {};
  (data || []).forEach((d) => { if (d.signedUrl && d.path) map[d.path] = d.signedUrl; });
  return map;
}
