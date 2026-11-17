// 세트 기록: 세트를 마칠 때마다 한 줄씩 남기는 기록 { ex: 종목 id, n: 그 세트에 한 개수(초), t: 마친 시각(ms), r: 회차(0부터) }.
// 완료 여부·세트 수는 기존 entries가 그대로 맡고, 이 기록은 세트별 개수와 볼륨(총 개수)을 위해 함께 쌓입니다.
// 순수 함수만 두어 store와 화면이 같이 씁니다.

export const MAX_LOG = 300; // 하루에 남기는 세트 기록 수 상한

/** 그 회차·종목의 기록 수를 want개로 맞춤: 많으면 마지막 것부터 지우고, 적으면 n개로 채움(기존 기록의 개수·시각은 그대로) */
export function syncSets(log, ex, r, want, n, now) {
  const out = Array.isArray(log) ? log.slice() : [];
  let have = out.filter((x) => x.ex === ex && x.r === r).length;
  for (let i = out.length - 1; i >= 0 && have > want; i--) {
    if (out[i].ex === ex && out[i].r === r) {
      out.splice(i, 1);
      have--;
    }
  }
  for (; have < want; have++) out.push({ ex, n, t: now, r });
  return out.slice(-MAX_LOG);
}

/** 마친 종목의 세트당 개수를 고쳤을 때: 그 회차·종목의 모든 기록 개수를 n으로 */
export function setSetCount(log, ex, r, n) {
  return (log || []).map((x) => (x.ex === ex && x.r === r ? { ...x, n } : x));
}

/** 그날 종목의 세트별 개수 [15, 15, 12]. 세트 기록이 없는 예전 기록은 entries로 짐작(세트당 개수 × 마친 세트) */
export function setsOf(day, ex) {
  if (!day) return [];
  const logged = (day.log || []).filter((x) => x.ex === ex).map((x) => x.n);
  if (logged.length) return logged;
  const e = day.entries && day.entries[ex];
  if (!e || !Number.isFinite(e.count)) return [];
  const k = e.done ? (Number.isFinite(e.sets) ? e.sets : 1) : e.setsDone || 0;
  return Array.from({ length: k }, () => e.count);
}

/** 기간(from~to, 날짜 문자열 포함) 동안 종목의 총 개수(초) */
export function volume(days, ex, from, to) {
  let sum = 0;
  for (const [date, day] of Object.entries(days)) {
    if (date < from || date > to) continue;
    for (const n of setsOf(day, ex)) sum += n;
  }
  return sum;
}
