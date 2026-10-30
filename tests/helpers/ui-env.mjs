// 화면 조각 테스트(ui-*.test.mjs)가 함께 쓰는 가짜 DOM(jsdom) 환경과 도우미.
// 테스트 파일마다 이 모듈을 가져오면 환경이 한 번 만들어지고, 테스트마다 저장소를 비웁니다.
import { afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import { addDays, todayStr } from '../../js/dates.js';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, Event: w.Event, matchMedia: () => ({ matches: true }) });
Object.defineProperty(globalThis, 'localStorage', { value: w.localStorage, configurable: true });
w.HTMLElement.prototype.scrollIntoView = () => {};

export const { createStore } = await import('../../js/store.js');
export const { mountToday } = await import('../../js/ui/today.js');
export const { mountHistory } = await import('../../js/ui/history.js');
export const { mountSettings } = await import('../../js/ui/settings.js');
export const { mountTimer } = await import('../../js/ui/timer.js');
export const { mountJournal } = await import('../../js/ui/journal.js');

// 세트를 체크하면 스톱워치가 저절로 시작되므로, 테스트가 끝날 때 남은 1초 타이머를 모두 멈춰 다음 테스트에 새지 않게 함
const realSetInterval = globalThis.setInterval;
const intervals = new Set();
globalThis.setInterval = (...args) => {
  const id = realSetInterval(...args);
  intervals.add(id);
  return id;
};
afterEach(() => {
  for (const id of intervals) clearInterval(id);
  intervals.clear();
});
beforeEach(() => localStorage.clear());

export const tick = () => new Promise((r) => setImmediate(r));

export function adapter({ days = {}, config = null, kind = 'fake', account } = {}) {
  const saved = { config: [], days: [] };
  return {
    saved,
    kind,
    label: '',
    ...(account ? { account } : {}),
    subscribe({ onConfig, onDays }) {
      onConfig(config);
      onDays(days);
      return () => {};
    },
    async saveConfig(doc) {
      saved.config.push(doc);
    },
    async saveDay(date, doc) {
      saved.days.push([date, doc]);
    },
  };
}

/** 오늘부터 거슬러 n일 동안 세 종목을 모두 마친 기록 */
export function fullDays(n) {
  const e = { push: { done: true }, pull: { done: true }, squat: { done: true } };
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(todayStr(), -i), { v: 2, entries: e }]));
}

export function setup(mount, opts) {
  document.body.innerHTML = '<div id="today"></div><div id="history"></div><div id="settings"></div>';
  const store = createStore(adapter(opts));
  const root = document.getElementById(mount.id);
  const render = mount.fn(root, store);
  store.subscribe(render);
  return { store, root, render };
}

export const today = { id: 'today', fn: (r, s) => mountToday(r, s) };
export const history = { id: 'history', fn: (r, s) => mountHistory(r, s) };

export function setupFull() {
  document.body.innerHTML = '<div id="today"></div><details id="moreBox"></details><details id="planBox"></details>';
  const store = createStore(adapter());
  const root = document.getElementById('today');
  const render = mountToday(root, store);
  store.subscribe(render);
  return { store, root };
}

/** 달력에서 그 날짜를 누름(이번 주 밖이면 한 달 보기로 펼치고, 다른 달이면 ‹로 옮김) */
export function pickDate(root, date) {
  const cell = () => root.querySelector(`#cal button.cell[data-date="${date}"]`);
  if (!cell()) root.querySelector('#calToggle').click();
  for (let i = 0; i < 24 && !cell(); i++) root.querySelector('#calPrev').click();
  cell().click();
}
