// 날짜는 모두 기기 현지 시간 기준 'YYYY-MM-DD' 문자열로 다룹니다.

const DAY_MS = 864e5;
export const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export const pad = (n) => String(n).padStart(2, '0');

export function fmt(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fmt(parse(s)) === s;
}

export function addDays(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
}

/** a - b (일) */
export function diffDays(a, b) {
  return Math.round((parse(a) - parse(b)) / DAY_MS);
}

/** 그 주의 월요일 */
export function mondayOf(s) {
  return addDays(s, -((parse(s).getDay() + 6) % 7));
}

export const todayStr = () => fmt(new Date());

export function labelMD(s) {
  const d = parse(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function shortMD(s) {
  const d = parse(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export const dowName = (s) => DOW[parse(s).getDay()];
