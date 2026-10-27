// 내일 날씨: Open-Meteo(키 없이 쓰는 무료 예보)에서 하루치 요약만 받아 한 줄로 보여 줍니다.
// 위치는 기본 서울, 사용자가 누르면 '내 위치'로 바꿉니다(좌표는 이 브라우저에만 저장).

export const SEOUL = { lat: 37.5665, lon: 126.978 };
const KEY = 'workout-check:weather';
const TTL_MS = 3 * 60 * 60 * 1000; // 같은 위치는 3시간 동안 다시 받지 않음

/** WMO 날씨 코드 → 아이콘·한글 */
export function describe(code) {
  if (code === 0) return { icon: '☀️', label: '맑음' };
  if (code === 1) return { icon: '🌤️', label: '대체로 맑음' };
  if (code === 2) return { icon: '⛅', label: '구름 조금' };
  if (code === 3) return { icon: '☁️', label: '흐림' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: '안개' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: '이슬비' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: '🌧️', label: '비' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '❄️', label: '눈' };
  if (code >= 95 && code <= 99) return { icon: '⛈️', label: '뇌우' };
  return { icon: '🌡️', label: '날씨' };
}

export const forecastUrl = ({ lat, lon }) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}` +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=2';

/** 응답에서 내일(둘째 날) 요약. 값이 이상하면 null */
export function parseTomorrow(json) {
  const d = json && json.daily;
  if (!d || !Array.isArray(d.weather_code) || d.weather_code.length < 2) return null;
  const num = (a) => (Array.isArray(a) && Number.isFinite(a[1]) ? Math.round(a[1]) : null);
  const code = d.weather_code[1];
  const max = num(d.temperature_2m_max);
  const min = num(d.temperature_2m_min);
  if (!Number.isFinite(code) || max === null || min === null) return null;
  return { ...describe(code), min, max, rain: num(d.precipitation_probability_max) };
}

/** 화면에 보일 한 줄: ⛅ 구름 조금 12°/21° · 비 20% */
export function formatLine(w) {
  return `${w.icon} ${w.label} ${w.min}°/${w.max}°${w.rain !== null && w.rain >= 10 ? ` · 비 ${w.rain}%` : ''}`;
}

const sameSpot = (a, b) => Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lon - b.lon) < 0.05;

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function writeSaved(patch) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readSaved(), ...patch }));
  } catch {
    /* 저장이 막혀도 날씨는 보임 */
  }
}

/** 저장해 둔 '내 위치'(없으면 null) */
export function savedPlace() {
  const p = readSaved().place;
  return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? p : null;
}
export const savePlace = (place) => writeSaved({ place });

/**
 * 내일 날씨를 가져옴(최근 3시간 안에 같은 위치로 받은 것이 있으면 그것을 씀).
 * 실패하면 null — 화면은 그냥 날씨 줄을 숨깁니다.
 */
export async function loadTomorrow(place, { fetchFn = globalThis.fetch, now = Date.now } = {}) {
  const c = readSaved().cache;
  if (c && c.at && now() - c.at < TTL_MS && c.place && sameSpot(c.place, place) && c.data) return c.data;
  try {
    const res = await fetchFn(forecastUrl(place));
    if (!res.ok) return null;
    const data = parseTomorrow(await res.json());
    if (data) writeSaved({ cache: { at: now(), place, data } });
    return data;
  } catch {
    return null;
  }
}
