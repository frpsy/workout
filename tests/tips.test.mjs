import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { pickTipIndex, TIPS } from '../js/tips.js';

test('운동 팁은 30개이고 모두 다르며 비어 있지 않음', () => {
  assert.equal(TIPS.length, 30);
  assert.equal(new Set(TIPS).size, 30);
  for (const t of TIPS) assert.ok(t.trim().length > 10 && t.length <= 90, t);
});

test('팁 고르기: 범위 안이고, 지금 보이는 팁과 같은 것은 다시 고르지 않음', () => {
  for (let i = 0; i < 200; i++) {
    const cur = i % TIPS.length;
    const n = pickTipIndex(cur);
    assert.ok(Number.isInteger(n) && n >= 0 && n < TIPS.length);
    assert.notEqual(n, cur);
  }
  // 난수가 같은 번호만 내놓아도 무한 반복 없이 다른 번호로 넘어감(번호가 올라가는 난수)
  let calls = 0;
  const seq = () => (calls++ < 1 ? 5 / TIPS.length : 6 / TIPS.length);
  assert.equal(pickTipIndex(5, seq), 6);
});

test('팁 화면: 열면 팁 하나가 보이고, 누르면 다른 팁으로 바뀜', async () => {
  const w = new JSDOM('<!doctype html><body><div id="tip"></div></body>').window;
  Object.assign(globalThis, { document: w.document });
  const { mountTip } = await import('../js/ui/tip.js');
  let n = 0;
  const handle = mountTip(w.document.getElementById('tip'), () => ((n++ * 7) % TIPS.length) / TIPS.length);
  const text = () => w.document.getElementById('tipText').textContent;
  const first = text();
  assert.ok(TIPS.includes(first));
  w.document.getElementById('tipBtn').click();
  assert.ok(TIPS.includes(text()));
  assert.notEqual(text(), first);
  assert.ok(handle.current >= 0);
});
