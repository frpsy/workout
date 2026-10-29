// Firebase(Google 로그인 + Firestore) 저장소.
// 설정이 없거나 불러오지 못하면 null을 돌려주고, 호출한 쪽이 브라우저 저장으로 넘어갑니다.
// 로그인 전에는 브라우저 저장을 그대로 쓰되 로그인 버튼(account.signIn)을 함께 줍니다.

import { createDbAdapter } from './claude-db.js';

const AUTH_WAIT = 5000;
const PROBE_WAIT = 6000; // 이보다 오래 걸리면 오프라인으로 보고 기기에 저장된 값으로 엽니다
const OK_KEY = 'workout-check:account-ok'; // 이 기기에서 이 계정의 기록을 정상으로 읽어 본 적이 있으면 그 uid

const knownGood = (uid) => {
  try {
    return localStorage.getItem(OK_KEY) === uid;
  } catch {
    return false;
  }
};
const markGood = (uid, ok) => {
  try {
    if (ok) localStorage.setItem(OK_KEY, uid);
    else localStorage.removeItem(OK_KEY);
  } catch {
    /* 저장이 막힌 브라우저: 매번 확인하고 열 뿐입니다 */
  }
};

/**
 * @param config        firebaseConfig
 * @param createLocal   () => 브라우저 저장 어댑터
 * @param readLocal     () => { config, days } | null  (계정이 비어 있을 때 옮길 기록)
 * @param load          () => Promise<{ connect }>  (테스트에서 바꿔 끼움)
 */
export async function createFirebaseStorage({ config, createLocal, readLocal, load = () => import('../vendor/firebase.js'), onStep = () => {} }) {
  let fb;
  try {
    fb = (await load()).connect(config);
  } catch {
    return null;
  }

  onStep('auth');
  let user;
  try {
    user = await fb.authReady(AUTH_WAIT);
  } catch {
    return null;
  }

  const reload = () => location.reload();

  if (!user) {
    return {
      ...createLocal(),
      account: {
        async signIn() {
          const r = await fb.signIn();
          if (r === true) reload();
          return r;
        },
      },
    };
  }

  const account = {
    email: user.email || '',
    async signOut() {
      await fb.signOut();
      reload();
    },
  };

  const db = fb.db(user.uid);
  const open = () => {
    const adapter = createDbAdapter(db, {
      kind: 'firebase',
      label: `${user.email || '계정'}에 저장되어 폰과 PC에서 같은 기록이 보입니다.`,
      account,
    });
    // 나중에 읽기가 막히면 다음 실행부터는 다시 확인하고 열도록 표시를 지움
    const subscribe = adapter.subscribe;
    adapter.subscribe = (handlers) => subscribe({ ...handlers, onError: (e) => (markGood(user.uid, false), handlers.onError && handlers.onError(e)) });
    return adapter;
  };

  // 지난번에 정상으로 열렸던 계정이면 서버 확인을 기다리지 않고 바로 엽니다.
  // 화면은 기기에 저장된 사본으로 먼저 뜨고, 서버 값은 도착하는 대로 알아서 반영됩니다.
  if (knownGood(user.uid)) return open();

  onStep('data');
  // 앱이 쓰는 두 가지(설정 문서, 날짜별 기록 목록)를 먼저 읽어 봅니다.
  // Firestore를 만들지 않았거나 규칙이 막으면 기록을 불러오지 못해 화면이 멈추므로,
  // 이 경우에는 브라우저 저장으로 열고 이유를 알립니다.
  let current = null;
  try {
    current = await withTimeout(Promise.all([db.doc('config/main').get(), db.collection('days').get()]), PROBE_WAIT);
  } catch (e) {
    if (e && e.code === 'permission-denied') {
      markGood(user.uid, false);
      return {
        ...createLocal(),
        label: 'Firebase 보안 규칙이 기록 읽기를 막고 있어 이 브라우저에만 저장합니다. firestore.rules를 다시 게시한 뒤 새로고침하세요.',
        account,
      };
    }
    // 오프라인 등은 그대로 진행: 기기에 쌓아 두었다가 연결되면 올립니다.
  }

  if (current) {
    await migrateLocal(db, readLocal, current);
    markGood(user.uid, true); // 서버에서 정상으로 읽었음 (오프라인·시간 초과로 읽지 못한 경우는 표시하지 않음)
  }
  return open();
}

/** 오래 걸리면 기다리지 않고 null로 넘어갑니다 (오류는 그대로 던짐). */
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([promise, new Promise((resolve) => (timer = setTimeout(() => resolve(null), ms)))]).finally(() => clearTimeout(timer));
}

/** 계정에 기록이 하나도 없고 이 브라우저에 기록이 있으면 한 번 옮겨 둡니다(브라우저 기록은 지우지 않음). */
async function migrateLocal(db, readLocal, [cfg, days]) {
  try {
    const local = readLocal && readLocal();
    if (!local || !db.setMany) return;
    if (cfg.exists || !days.empty) return;
    const map = {};
    if (local.config) map['config/main'] = local.config;
    for (const [date, doc] of Object.entries(local.days)) map['days/' + date] = doc;
    if (Object.keys(map).length) await db.setMany(map);
  } catch {
    /* 오프라인 등: 다음에 접속할 때 다시 시도합니다 */
  }
}
