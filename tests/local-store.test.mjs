import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readJson, readText, writeJson, writeText } from '../js/local-store.js';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
const store = dom.window.localStorage;
Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
beforeEach(() => store.clear());

test('글자: 쓴 값을 읽고, 없으면 fallback, null을 쓰면 지움', () => {
  assert.equal(readText('k'), null);
  assert.equal(readText('k', 'x'), 'x');
  writeText('k', 'on');
  assert.equal(readText('k'), 'on');
  writeText('k', null);
  assert.equal(readText('k'), null);
});

test('JSON: 객체만 돌려주고, 없거나 깨졌거나 객체가 아니면 fallback', () => {
  assert.deepEqual(readJson('k'), {});
  assert.equal(readJson('k', null), null);
  writeJson('k', { a: 1 });
  assert.deepEqual(readJson('k'), { a: 1 });
  store.setItem('k', '{깨짐');
  assert.deepEqual(readJson('k'), {});
  store.setItem('k', '5');
  assert.deepEqual(readJson('k'), {}, '숫자는 객체가 아니므로 fallback');
  store.setItem('k', 'null');
  assert.equal(readJson('k', null), null);
});

test('저장이 막힌 브라우저: 읽기는 fallback, 쓰기는 조용히 무시', () => {
  const blocked = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: blocked, configurable: true });
  try {
    assert.equal(readText('k', 'x'), 'x');
    assert.deepEqual(readJson('k'), {});
    assert.doesNotThrow(() => writeText('k', 'v'));
    assert.doesNotThrow(() => writeText('k', null));
    assert.doesNotThrow(() => writeJson('k', { a: 1 }));
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
  }
});
