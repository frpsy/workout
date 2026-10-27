import { before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let W, mountWeather, doc;
before(async () => {
  const w = new JSDOM('<!doctype html><body><div id="weather"></div></body>', { url: 'http://localhost/' }).window;
  doc = w.document;
  Object.assign(globalThis, { window: w, document: w.document });
  Object.defineProperty(globalThis, 'localStorage', { value: w.localStorage, configurable: true });
  W = await import('../js/weather.js');
  ({ mountWeather } = await import('../js/ui/weather.js'));
});
beforeEach(() => {
  localStorage.clear();
  doc.body.innerHTML = '<div id="weather"></div>';
});

const sample = (over = {}) => ({
  daily: {
    weather_code: [0, 2],
    temperature_2m_max: [20.4, 21.6],
    temperature_2m_min: [10.2, 12.4],
    precipitation_probability_max: [0, 20],
    ...over,
  },
});
const okFetch = (json, calls = []) => async (url) => {
  calls.push(url);
  return { ok: true, json: async () => json };
};

test('날씨 코드: 맑음·흐림·비·눈·뇌우를 한글로', () => {
  assert.equal(W.describe(0).label, '맑음');
  assert.equal(W.describe(3).label, '흐림');
  assert.equal(W.describe(63).label, '비');
  assert.equal(W.describe(81).label, '비');
  assert.equal(W.describe(73).label, '눈');
  assert.equal(W.describe(95).label, '뇌우');
  assert.equal(W.describe(45).label, '안개');
  assert.equal(W.describe(999).label, '날씨');
});

test('응답에서 내일(둘째 날)만 뽑아 반올림하고, 이상한 값은 null', () => {
  const t = W.parseTomorrow(sample());
  assert.deepEqual([t.label, t.min, t.max, t.rain], ['구름 조금', 12, 22, 20]);
  assert.equal(W.formatLine(t), '⛅ 구름 조금 12°/22° · 비 20%');
  assert.equal(W.formatLine({ ...t, rain: 5 }), '⛅ 구름 조금 12°/22°', '강수확률이 낮으면 생략');
  assert.equal(W.parseTomorrow({}), null);
  assert.equal(W.parseTomorrow(sample({ weather_code: [1] })), null);
  assert.equal(W.parseTomorrow(sample({ temperature_2m_max: [1, null] })), null);
  assert.ok(W.forecastUrl(W.SEOUL).includes('forecast_days=2') && W.forecastUrl(W.SEOUL).includes('timezone=auto'));
});

test('가져오기: 같은 위치는 3시간 동안 저장해 둔 것을 쓰고, 실패하면 null', async () => {
  const calls = [];
  let t = 1_000;
  const a = await W.loadTomorrow(W.SEOUL, { fetchFn: okFetch(sample(), calls), now: () => t });
  assert.equal(a.max, 22);
  await W.loadTomorrow(W.SEOUL, { fetchFn: okFetch(sample(), calls), now: () => (t += 60_000) });
  assert.equal(calls.length, 1, '3시간 안에는 다시 받지 않음');
  await W.loadTomorrow({ lat: 35.1, lon: 129.0 }, { fetchFn: okFetch(sample(), calls), now: () => t });
  assert.equal(calls.length, 2, '위치가 다르면 새로 받음');
  await W.loadTomorrow(W.SEOUL, { fetchFn: okFetch(sample(), calls), now: () => (t += 4 * 3600_000) });
  assert.equal(calls.length, 3, '3시간이 지나면 새로 받음');
  localStorage.clear();
  assert.equal(await W.loadTomorrow(W.SEOUL, { fetchFn: async () => ({ ok: false }) }), null);
  assert.equal(await W.loadTomorrow(W.SEOUL, { fetchFn: async () => { throw new Error('offline'); } }), null);
});

test('화면: 서울 기준 한 줄이 보이고, 누르면 내 위치로 바뀌며 거절하면 그대로', async () => {
  const root = doc.getElementById('weather');
  const calls = [];
  await mountWeather(root, { fetchFn: okFetch(sample(), calls), getPosition: async () => null });
  const btn = root.querySelector('#wxBtn');
  assert.equal(btn.hidden, false);
  assert.equal(root.querySelector('#wxText').textContent, '내일 ⛅ 구름 조금 12°/22° · 비 20% · 서울');
  btn.click();
  await new Promise((r) => setTimeout(r, 5));
  assert.match(root.querySelector('#wxText').textContent, /서울$/, '거절하면 서울 그대로');

  doc.body.innerHTML = '<div id="weather"></div>';
  const root2 = doc.getElementById('weather');
  await mountWeather(root2, { fetchFn: okFetch(sample(), calls), getPosition: async () => ({ lat: 35.18, lon: 129.07 }) });
  root2.querySelector('#wxBtn').click();
  await new Promise((r) => setTimeout(r, 5));
  assert.match(root2.querySelector('#wxText').textContent, /내 위치$/);
  assert.deepEqual(W.savedPlace(), { lat: 35.18, lon: 129.07 }, '내 위치를 기억');
});

test('화면: 날씨를 받지 못하면 줄을 숨김', async () => {
  const root = doc.getElementById('weather');
  await mountWeather(root, { fetchFn: async () => { throw new Error('offline'); } });
  assert.equal(root.querySelector('#wxBtn').hidden, true);
});
