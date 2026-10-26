import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalAdapter } from '../js/storage/local.js';

const KEY = 'workout-check:v2';

function fakeLocalStorage() {
  const m = new Map();
  return {
    full: false,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      if (this.full && k === KEY) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      m.set(k, String(v));
    },
    removeItem: (k) => m.delete(k),
  };
}

beforeEach(() => {
  globalThis.localStorage = fakeLocalStorage();
});

test('저장 공간 초과는 quota_exceeded 코드로', async () => {
  const ad = createLocalAdapter();
  localStorage.full = true;
  await assert.rejects(ad.saveDay('2026-10-26', { entries: {} }), { code: 'quota_exceeded' });
});

test('saveDays는 여러 날을 한 번에 쓰고 기존 날은 유지', async () => {
  const ad = createLocalAdapter();
  await ad.saveDay('2026-10-01', { entries: { a: { done: true } } });
  await ad.saveDays({ '2026-10-02': { entries: {} }, '2026-10-03': { entries: {} } });
  const saved = JSON.parse(localStorage.getItem(KEY));
  assert.deepEqual(Object.keys(saved.days).sort(), ['2026-10-01', '2026-10-02', '2026-10-03']);
});

test('예전 단일 파일 버전(wk-state) 기록을 읽음', () => {
  localStorage.setItem('wk-state', JSON.stringify({ cfg: { startDate: '2026-10-01' }, days: { '2026-10-01': { push: { done: true } } } }));
  const ad = createLocalAdapter();
  let cfg;
  let days;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  ad.subscribe({ onConfig: (c) => (cfg = c), onDays: (d) => (days = d) });
  delete globalThis.window;
  assert.equal(cfg.startDate, '2026-10-01');
  assert.ok(days['2026-10-01'].push.done);
});
