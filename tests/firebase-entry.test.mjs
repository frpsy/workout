import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('Firebase SDK 쓰기는 4초 뒤에도 대기하며 늦은 거부를 호출자에게 전달', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => { mock.timers.reset(); delete globalThis.firebaseWriteHarness; });
  const rejects = [];
  globalThis.firebaseWriteHarness = () => new Promise((resolve, reject) => rejects.push(reject));
  const bundled = await build({
    entryPoints: ['scripts/firebase-entry.js'], bundle: true, write: false, format: 'esm',
    plugins: [{ name: 'fake-sdk', setup(b) {
      b.onResolve({ filter: /^firebase\// }, (args) => ({ path: args.path, namespace: 'fake-sdk' }));
      b.onLoad({ filter: /.*/, namespace: 'fake-sdk' }, () => ({ contents: `
        export const initializeApp = () => ({}), getAuth = () => ({}), initializeFirestore = () => ({});
        export const persistentLocalCache = () => ({}), persistentMultipleTabManager = () => ({}), doc = () => ({});
        export const setDoc = (...args) => globalThis.firebaseWriteHarness(...args);
        export const writeBatch = () => ({set(){}, commit: () => globalThis.firebaseWriteHarness()});
        export const GoogleAuthProvider = class {};
        export const onAuthStateChanged = () => {}, signInWithPopup = () => {}, signInWithRedirect = () => {}, signOut = () => {};
        export const collection = () => {}, getDoc = () => {}, getDocs = () => {}, getFirestore = () => {}, onSnapshot = () => {};
      ` }));
    } }],
  });
  const { connect } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  const db = connect({}).db('user');
  const write = db.doc('days/2026-10-31').set({});
  const batch = db.setMany(Object.fromEntries(Array.from({length:401}, (_, i) => ['days/' + i, {}])));
  assert.equal(rejects.length, 3, '여러 배치를 서버 확인 전에 모두 SDK에 전달');
  let settled = 0;
  const dayError = assert.rejects(write, { code: 'permission-denied' }).then(() => settled++);
  const batchError = assert.rejects(batch, { code: 'quota_exceeded' }).then(() => settled++);
  mock.timers.tick(5000);
  await new Promise((r) => setImmediate(r));
  assert.equal(settled, 0);
  rejects[0](Object.assign(new Error('denied'), {code:'permission-denied'}));
  rejects[1](Object.assign(new Error('full'), {code:'resource-exhausted'}));
  rejects[2](Object.assign(new Error('full'), {code:'resource-exhausted'}));
  await Promise.all([dayError, batchError]);
});
