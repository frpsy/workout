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

test('브라우저 저장 차단은 성공 대신 오류를 반환', async () => {
  localStorage.setItem = () => { throw new Error('blocked'); };
  const ad = createLocalAdapter();
  await assert.rejects(ad.saveDay('2026-10-26', { entries: {} }), { code: 'storage_unavailable' });
  await assert.rejects(ad.saveConfig({}), { code: 'storage_unavailable' });
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
