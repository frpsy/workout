// 아령 무게: 저장 형식, 세트 기록, 이중 점진(무게를 올리면 개수는 다시 시작 개수부터)
import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { normalizeConfig, normalizeLog, validateConfig } from '../js/model.js';
import { createTargetResolver } from '../js/progression.js';
import { kgOf, kgStep, syncSets } from '../js/setlog.js';
import { adapter, setup, today, complete, tick, createStore, mountSettings } from './helpers/ui-env.mjs';

const START = '2026-11-02';
const base = (ex) => ({ startDate: START, exercises: [{ id: 'g', name: '고블릿 스쿼트', unit: 'reps', base: 10, step: 1, max: 15, sets: 3, lib: 'goblet-squat', ...ex }] });

test('무게: 0.5kg 단위로 맞추고, 범위 밖이면 버림, from 날짜를 지킴', () => {
  const c = normalizeConfig(base({ kg: 7.3, from: '2026-11-16' }), START);
  assert.equal(c.exercises[0].kg, 7.5);
  assert.equal(c.exercises[0].from, '2026-11-16');
  assert.equal('kg' in normalizeConfig(base({ kg: 0 }), START).exercises[0], false);
  assert.equal('kg' in normalizeConfig(base({ kg: 999 }), START).exercises[0], false);
  assert.ok(validateConfig({ ...normalizeConfig(base({}), START), exercises: [{ ...base({}).exercises[0], kg: 0 }] }).some((m) => m.includes('무게')));
});

test('세트 기록: 그때 무게를 함께 남기고, 그날 무게는 마지막 세트 기준', () => {
  let log = syncSets([], 'g', 0, 2, 10, 1000, 8);
  assert.deepEqual(log.map((x) => x.kg), [8, 8]);
  log = syncSets(log, 'g', 0, 3, 10, 2000, 9);
  assert.equal(kgOf({ log }, 'g'), 9);
  assert.equal(kgOf({ log: syncSets([], 'p', 0, 1, 10, 1) }, 'p'), 0, '맨몸은 0');
  assert.equal('kg' in syncSets([], 'p', 0, 1, 10, 1)[0], false);
  assert.deepEqual(normalizeLog([{ ex: 'g', n: 10, t: 5, r: 0, kg: 8.2 }, { ex: 'g', n: 10, t: 5, r: 0, kg: -1 }]).map((x) => x.kg), [8, undefined]);
});

test('무게 눈금: 10kg 미만은 1kg, 그 이상은 2kg', () => {
  assert.equal(kgStep(5), 1);
  assert.equal(kgStep(9.5), 1);
  assert.equal(kgStep(10), 2);
});

test('이중 점진: from이 든 주부터 목표가 시작 개수로 돌아가 다시 늘어남(매주·해낸 주만 모두)', () => {
  for (const mode of ['linear', 'adaptive']) {
    const cfg = normalizeConfig({ ...base({ from: '2026-11-16' }), plan: { mode, recoveryEvery: 0, passDays: 1 } }, START);
    const res = createTargetResolver(cfg, {}, '2026-11-16'); // 해낸 주만: 아직 오지 않은 주는 해낸다고 봄
    const ex = cfg.exercises[0];
    assert.equal(res.targetForDate(ex, '2026-11-09'), 10, `${mode}: 올리기 전 주는 0주째부터`);
    assert.equal(res.targetForDate(ex, '2026-11-16'), 10, `${mode}: 올린 주는 시작 개수`);
    assert.equal(res.targetForDate(ex, '2026-11-23'), 11, `${mode}: 다음 주 +1`);
  }
});

test('오늘: 아령 종목은 무게 꼬리표, 상한 개수로 마치면 무게 올리기 제안 → 누르면 무게+1, 목표는 시작 개수', async () => {
  const t = todayStr();
  const start = addDays(t, -28);
  const config = { startDate: start, plan: { mode: 'linear', recoveryEvery: 0 }, exercises: [{ id: 'g', name: '고블릿 스쿼트', unit: 'reps', base: 10, step: 2, max: 15, sets: 1, kg: 8, lib: 'goblet-squat' }] };
  const { store, root } = setup(today, { config });
  await tick();
  const row = root.querySelector('.row');
  assert.equal(row.querySelector('.goal .kg').textContent, '8kg');
  assert.equal(row.querySelector('[data-f="target"]').textContent, '15', '4주째라 상한 15');
  assert.equal(row.querySelector('.kgup').hidden, true, '마치기 전에는 숨김');
  complete(row);
  const up = root.querySelector('.row .kgup');
  assert.equal(up.hidden, false);
  assert.match(up.textContent, /9kg/);
  up.click();
  await tick();
  const ex = store.state.config.exercises[0];
  assert.equal(ex.kg, 9);
  assert.equal(ex.from, t);
  assert.equal(root.querySelector('.row .goal .kg').textContent, '9kg');
  store.actions.flushAll();
});

test('설정: 아령 동작·직접 만든 종목에만 무게 칸, 비우면 맨몸으로 저장', async () => {
  const ad = adapter({ config: { startDate: START, exercises: [{ id: 'push', name: '푸시업', unit: 'reps', base: 10, step: 1, sets: 3 }, { id: 'g', name: '고블릿 스쿼트', unit: 'reps', base: 10, step: 1, sets: 3, lib: 'goblet-squat', kg: 8 }] } });
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  await tick();
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  assert.equal(root.querySelector('#kg-push'), null);
  const kg = root.querySelector('#kg-g');
  assert.equal(kg.value, '8');
  kg.value = '10';
  kg.dispatchEvent(new Event('input', { bubbles: true }));
  root.querySelector('#saveCfg').click();
  await tick();
  assert.equal(ad.saved.config.at(-1).exercises[1].kg, 10);
  kg.value = '';
  kg.dispatchEvent(new Event('input', { bubbles: true }));
  root.querySelector('#saveCfg').click();
  await tick();
  assert.equal('kg' in ad.saved.config.at(-1).exercises[1], false);
});
