// Firebase SDK 중 쓰는 부분만 묶어 js/vendor/firebase.js로 만들 때의 진입점입니다.
// 앱은 이 파일의 connect()만 알면 되고, 문서 접근 모양은 claude-db 어댑터가 쓰는 db 인터페이스와 같습니다.
// 빌드: npm run build:firebase

import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

const ACK_WAIT = 4000; // 오프라인이면 서버 응답을 기다리지 않고 기기 안에 쌓아 둡니다.
const BATCH = 400; // Firestore 일괄 쓰기 한도(500) 아래

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function mapError(e) {
  if (e && e.code === 'resource-exhausted') return Object.assign(new Error('저장 공간 부족'), { code: 'quota_exceeded' });
  return e;
}

export function connect(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  let firestore;
  const fs = () => {
    if (firestore) return firestore;
    try {
      // 오프라인에서도 열리고, 탭 여러 개를 열어도 같은 캐시를 씁니다.
      firestore = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    } catch {
      firestore = getFirestore(app); // 비공개 모드 등 캐시를 못 쓰는 환경
    }
    return firestore;
  };

  const docSnap = (s) => ({ exists: s.exists(), data: () => s.data() });
  const colSnap = (s) => ({ docs: s.docs.map((d) => ({ id: d.id, data: () => d.data() })), empty: s.empty });

  return {
    /** 처음 로그인 상태를 알려 줍니다. 오래 걸리면 null */
    authReady(timeout = 5000) {
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), timeout);
        const off = onAuthStateChanged(auth, (u) => {
          clearTimeout(timer);
          off();
          resolve(u ? { uid: u.uid, email: u.email || '' } : null);
        });
      });
    },

    /** true: 로그인함, false: 창을 닫음, 'redirect': 페이지를 옮겨 로그인 중 */
    async signIn() {
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
        return true;
      } catch (e) {
        if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return false;
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider);
          return 'redirect';
        }
        throw e;
      }
    },

    signOut: () => signOut(auth),

    /** 사용자 uid 아래 문서만 다루는 db */
    db(uid) {
      const p = (path) => `users/${uid}/${path}`;
      return {
        doc(path) {
          const ref = () => doc(fs(), p(path));
          return {
            onSnapshot: (ok, err) => onSnapshot(ref(), (s) => ok(docSnap(s)), err),
            get: async () => docSnap(await getDoc(ref())),
            set(data) {
              const write = setDoc(ref(), data);
              write.catch(() => {}); // 기다리지 않은 쓰기의 늦은 실패가 처리되지 않은 오류가 되지 않게
              return Promise.race([write, wait(ACK_WAIT)]).catch((e) => {
                throw mapError(e);
              });
            },
          };
        },
        collection(path) {
          const ref = () => collection(fs(), p(path));
          return {
            onSnapshot: (ok, err) => onSnapshot(ref(), (s) => ok(colSnap(s)), err),
            get: async () => colSnap(await getDocs(ref())),
          };
        },
        /** { 'days/2026-10-26': doc, ... } 를 일괄로 저장 */
        async setMany(map) {
          const entries = Object.entries(map);
          try {
            for (let i = 0; i < entries.length; i += BATCH) {
              const batch = writeBatch(fs());
              for (const [path, data] of entries.slice(i, i + BATCH)) batch.set(doc(fs(), p(path)), data);
              const commit = batch.commit();
              commit.catch(() => {});
              await Promise.race([commit, wait(ACK_WAIT)]);
            }
          } catch (e) {
            throw mapError(e);
          }
        },
      };
    },
  };
}
