import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDbAdapter } from '../js/storage/claude-db.js';
import { createFirebaseStorage } from '../js/storage/firebase.js';

/** Firestore를 흉내 낸 메모리 db (users/<uid>/ 아래만 다룸) */
function fakeDb(initial = {}) {
  const data = new Map(Object.entries(initial));
  const snap = (path) => ({ exists: data.has(path), data: () => data.get(path) });
  const days = () => [...data.keys()].filter((k) => k.startsWith('days/')).map((k) => ({ id: k.slice(5), data: () => data.get(k) }));
  return {
    data,
    doc: (path) => ({
      get: async () => snap(path),
      set: async (d) => void data.set(path, d),
      onSnapshot: (ok) => (ok(snap(path)), () => {}),
    }),
    collection: () => ({
      get: async () => ({ docs: days(), empty: !days().length }),
      onSnapshot: (ok) => (ok({ docs: days() }), () => {}),
    }),
    setMany: async (map) => {
      for (const [k, v] of Object.entries(map)) data.set(k, v);
    },
  };
}

const local = { config: { v: 2, startDate: '2026-10-01' }, days: { '2026-10-25': { v: 2, date: '2026-10-25', entries: { a: { done: true } } } } };
const localAdapter = () => ({ kind: 'local', label: '이 브라우저에만 저장됩니다.', subscribe() {} });

function loader({ user, db = fakeDb(), signIn = async () => true, signOut = async () => {} }) {
  const calls = { signOut: 0 };
  return {
    calls,
    db,
    load: async () => ({
      connect: () => ({
        authReady: async () => user,
        signIn,
        signOut: async () => {
          calls.signOut++;
          await signOut();
        },
        db: () => db,
      }),
    }),
  };
}

const run = (l, readLocal = () => local) => createFirebaseStorage({ config: {}, createLocal: localAdapter, readLocal, load: l.load });

test('db 어댑터: 같은 모양으로 저장·일괄 저장', async () => {
  const db = fakeDb();
  const ad = createDbAdapter(db, { kind: 'firebase', label: 'x' });
  await ad.saveDay('2026-10-26', { entries: {} });
  await ad.saveDays({ '2026-10-24': { entries: {} }, '2026-10-25': { entries: {} } });
  assert.deepEqual([...db.data.keys()].sort(), ['days/2026-10-24', 'days/2026-10-25', 'days/2026-10-26']);
  const seen = [];
  ad.subscribe({ onConfig: (c) => seen.push(c), onDays: (d) => seen.push(Object.keys(d).length), onError() {} });
  assert.deepEqual(seen, [null, 3]);
});

test('db 어댑터: 일괄 쓰기가 없는 db는 saveDays를 내놓지 않음', () => {
  const db = fakeDb();
  delete db.setMany;
  assert.equal(createDbAdapter(db, { kind: 'k', label: 'x' }).saveDays, undefined);
});

test('로그인하지 않았으면 브라우저 저장 + 로그인 버튼, 로그인하면 true일 때 새로고침', async () => {
  let reloaded = 0;
  globalThis.location = { reload: () => reloaded++ };
  const ad = await run(loader({ user: null }));
  assert.equal(ad.kind, 'local');
  assert.equal(typeof ad.account.signIn, 'function');
  assert.equal(await ad.account.signIn(), true);
  assert.equal(reloaded, 1);
  const closed = await run(loader({ user: null, signIn: async () => false }));
  assert.equal(await closed.account.signIn(), false);
  assert.equal(reloaded, 1, '창을 닫으면 새로고침하지 않음');
  delete globalThis.location;
});

test('로그인했고 계정이 비어 있으면 이 브라우저 기록을 옮김', async () => {
  const l = loader({ user: { uid: 'u1', email: 'me@example.com' } });
  const ad = await run(l);
  assert.equal(ad.kind, 'firebase');
  assert.match(ad.label, /me@example\.com/);
  assert.deepEqual([...l.db.data.keys()].sort(), ['config/main', 'days/2026-10-25']);
});

test('계정에 기록이 이미 있으면 덮어쓰지 않음', async () => {
  const mine = { v: 2, startDate: '2026-01-01' };
  const l = loader({ user: { uid: 'u1', email: 'me@example.com' }, db: fakeDb({ 'config/main': mine }) });
  await run(l);
  assert.deepEqual([...l.db.data.keys()], ['config/main']);
  assert.equal(l.db.data.get('config/main'), mine);
});

test('옮길 기록이 없거나 옮기다 실패해도 어댑터는 정상', async () => {
  const none = await run(loader({ user: { uid: 'u', email: '' } }), () => null);
  assert.equal(none.kind, 'firebase');
  const db = fakeDb();
  db.setMany = async () => {
    throw new Error('offline');
  };
  const failed = await run(loader({ user: { uid: 'u', email: '' }, db }));
  assert.equal(failed.kind, 'firebase');
});

test('Firestore 접근이 막혀 있으면(permission-denied) 브라우저 저장으로 열고 로그아웃은 가능', async () => {
  const db = fakeDb();
  db.doc = () => ({
    get: async () => {
      throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    },
  });
  const ad = await run(loader({ user: { uid: 'u', email: 'me@example.com' }, db }));
  assert.equal(ad.kind, 'local');
  assert.match(ad.label, /보안 규칙/);
  assert.equal(typeof ad.account.signOut, 'function');
});

test('설정 문서는 읽히지만 날짜별 기록 목록만 규칙에 막혀도(permission-denied) 브라우저 저장으로 열기', async () => {
  const db = fakeDb();
  db.collection = () => ({
    get: async () => {
      throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    },
  });
  const ad = await run(loader({ user: { uid: 'u', email: 'me@example.com' }, db }));
  assert.equal(ad.kind, 'local', '화면이 멈추지 않고 브라우저 저장으로 열림');
  assert.match(ad.label, /보안 규칙/);
  assert.equal(typeof ad.account.signOut, 'function');
  assert.deepEqual([...db.data.keys()], [], '막힌 상태에서는 쓰지 않음');
});

test('오프라인처럼 다른 오류는 계정 저장소로 그대로 진행', async () => {
  const db = fakeDb();
  db.doc = () => ({
    get: async () => {
      throw Object.assign(new Error('offline'), { code: 'unavailable' });
    },
  });
  const ad = await run(loader({ user: { uid: 'u', email: '' }, db }));
  assert.equal(ad.kind, 'firebase');
});

test('로그아웃은 signOut 뒤 새로고침', async () => {
  let reloaded = 0;
  globalThis.location = { reload: () => reloaded++ };
  const l = loader({ user: { uid: 'u1', email: 'me@example.com' } });
  const ad = await run(l);
  await ad.account.signOut();
  assert.equal(l.calls.signOut, 1);
  assert.equal(reloaded, 1);
  delete globalThis.location;
});

test('SDK를 불러오지 못하면 null (브라우저 저장으로 넘어감)', async () => {
  const ad = await createFirebaseStorage({
    config: {},
    createLocal: localAdapter,
    readLocal: () => null,
    load: async () => {
      throw new Error('network');
    },
  });
  assert.equal(ad, null);
});

function fakeLocalStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), m };
}

test('빠른 열기: 정상으로 읽어 본 계정은 다음부터 서버 확인을 기다리지 않고 바로 열림', async () => {
  const ls = fakeLocalStorage();
  globalThis.localStorage = ls;
  try {
    const user = { uid: 'u1', email: 'me@example.com' };
    // 처음: 확인하고 열고, 정상이면 표시를 남김
    const first = await run(loader({ user, db: fakeDb({ 'config/main': { v: 2 } }) }));
    assert.equal(first.kind, 'firebase');
    assert.equal(ls.getItem('workout-check:account-ok'), 'u1');

    // 다음: 서버 확인(get)을 아예 부르지 않음 (서버가 느려도 기다리지 않는 것)
    const db = fakeDb({ 'config/main': { v: 2 } });
    let probed = 0;
    const doc = db.doc;
    db.doc = (path) => ({ ...doc(path), get: async () => (probed++, doc(path).get()) });
    const second = await run(loader({ user, db }));
    assert.equal(second.kind, 'firebase');
    assert.equal(probed, 0, '서버 확인 없이 바로');

    // 다른 계정이면 다시 확인
    probed = 0;
    await run(loader({ user: { uid: 'u2', email: 'x@example.com' }, db }));
    assert.equal(probed, 1);
  } finally {
    delete globalThis.localStorage;
  }
});

test('빠른 열기: 나중에 읽기가 막히면 표시를 지워 다음 실행에서는 다시 확인하고, 막혀 있으면 브라우저 저장으로 엶', async () => {
  const ls = fakeLocalStorage();
  globalThis.localStorage = ls;
  try {
    ls.setItem('workout-check:account-ok', 'u1');
    const user = { uid: 'u1', email: 'me@example.com' };
    const db = fakeDb();
    let onErr;
    db.collection = () => ({ get: async () => ({ docs: [], empty: true }), onSnapshot: (ok, err) => ((onErr = err), () => {}) });
    const ad = await run(loader({ user, db }));
    let shown = 0;
    ad.subscribe({ onConfig() {}, onDays() {}, onError: () => shown++ });
    onErr(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    assert.equal(shown, 1, '화면에는 그대로 알림');
    assert.equal(ls.getItem('workout-check:account-ok'), null, '표시를 지움');

    // 다음 실행: 다시 확인하고, 막혀 있으면 브라우저 저장으로
    const blocked = fakeDb();
    blocked.doc = () => ({ get: async () => { throw Object.assign(new Error('denied'), { code: 'permission-denied' }); } });
    const next = await run(loader({ user, db: blocked }));
    assert.equal(next.kind, 'local');
    assert.equal(ls.getItem('workout-check:account-ok'), null);
  } finally {
    delete globalThis.localStorage;
  }
});

test('빠른 열기: 오프라인·시간 초과로 확인하지 못한 경우에는 표시를 남기지 않음', async () => {
  const ls = fakeLocalStorage();
  globalThis.localStorage = ls;
  try {
    const db = fakeDb();
    db.doc = () => ({ get: async () => { throw Object.assign(new Error('offline'), { code: 'unavailable' }); } });
    await run(loader({ user: { uid: 'u1', email: '' }, db }));
    assert.equal(ls.getItem('workout-check:account-ok'), null);
  } finally {
    delete globalThis.localStorage;
  }
});
