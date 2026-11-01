import { test } from 'node:test';
import assert from 'node:assert/strict';

test('화면 켜짐: 운동·휴식 공유, 경합, 백그라운드 복귀 및 정상 해제', async () => {
  const doc = new EventTarget();
  doc.hidden = false;
  const prevDoc = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const prevNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  let requests = 0;
  let releases = 0;
  let resolveFirst;
  const makeLock = () => {
    const l = new EventTarget();
    l.released = false;
    l.release = async () => {
      if (l.released) return;
      l.released = true;
      releases++;
      l.dispatchEvent(new Event('release'));
    };
    return l;
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { wakeLock: { request: () => {
      requests++;
      if (requests === 1) return new Promise((resolve) => { resolveFirst = resolve; });
      return Promise.resolve(makeLock());
    } } },
  });
  const { setScreenAwake } = await import('../js/screen-awake.js');
  const workout = Symbol('workout');
  const rest = Symbol('rest');
  const flush = () => new Promise((r) => setImmediate(r));
  try {
    setScreenAwake(workout, true);
    assert.equal(requests, 1, '첫 운동 시작 시 한 번 요청');
    setScreenAwake(rest, true);
    setScreenAwake(workout, false);
    assert.equal(requests, 1, '대기 중 중복 요청하지 않음');
    resolveFirst(makeLock());
    await flush();
    assert.equal(releases, 0, '운동을 끝내도 휴식 중에는 잠금 유지');
    setScreenAwake(rest, false);
    await flush();
    assert.equal(releases, 1, '마지막 활동 종료 후 해제');

    setScreenAwake(workout, true);
    await flush();
    assert.equal(requests, 2, '다음 운동에서는 새 잠금');
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    assert.equal(releases, 2, '앱을 숨기면 해제');
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    assert.equal(requests, 3, '앱 복귀 시 재획득');
    setScreenAwake(workout, false);
    await flush();
    assert.equal(releases, 3);

    setScreenAwake(rest, true);
    await flush();
    assert.equal(requests, 4);
    setScreenAwake(rest, false);
    await flush();
    assert.equal(releases, 4, '시작과 중지에서 잠금이 남지 않음');
  } finally {
    setScreenAwake(workout, false);
    setScreenAwake(rest, false);
    if (prevDoc) Object.defineProperty(globalThis, 'document', prevDoc);
    else delete globalThis.document;
    if (prevNav) Object.defineProperty(globalThis, 'navigator', prevNav);
    else delete globalThis.navigator;
  }
});

test('화면 켜짐: 비동기 허가가 늦게 돌아오더라도 종료 후 잠금을 남기지 않음', async () => {
  const doc = new EventTarget();
  doc.hidden = false;
  const prevDoc = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const prevNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  let resolveRequest;
  let releases = 0;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { wakeLock: { request: () => new Promise((resolve) => { resolveRequest = resolve; }) } },
  });
  const { setScreenAwake } = await import('../js/screen-awake.js');
  const owner = Symbol('late-request');
  const flush = () => new Promise((r) => setImmediate(r));
  try {
    setScreenAwake(owner, true);
    setScreenAwake(owner, false);
    resolveRequest({ released: false, release: async () => { releases++; } });
    await flush();
    assert.equal(releases, 1, '늦은 허가도 즉시 해제');
  } finally {
    setScreenAwake(owner, false);
    if (prevDoc) Object.defineProperty(globalThis, 'document', prevDoc);
    else delete globalThis.document;
    if (prevNav) Object.defineProperty(globalThis, 'navigator', prevNav);
    else delete globalThis.navigator;
  }
});
