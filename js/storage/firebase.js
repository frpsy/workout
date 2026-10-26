// Firebase(Google 로그인 + Firestore) 저장소.
// 설정이 없거나 불러오지 못하면 null을 돌려주고, 호출한 쪽이 브라우저 저장으로 넘어갑니다.
// 로그인 전에는 브라우저 저장을 그대로 쓰되 로그인 버튼(account.signIn)을 함께 줍니다.

import { createDbAdapter } from './claude-db.js';

const AUTH_WAIT = 5000;

/**
 * @param config        firebaseConfig
 * @param createLocal   () => 브라우저 저장 어댑터
 * @param readLocal     () => { config, days } | null  (계정이 비어 있을 때 옮길 기록)
 * @param load          () => Promise<{ connect }>  (테스트에서 바꿔 끼움)
 */
export async function createFirebaseStorage({ config, createLocal, readLocal, load = () => import('../vendor/firebase.js') }) {
  let fb;
  try {
    fb = (await load()).connect(config);
  } catch {
    return null;
  }

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
  // Firestore를 아직 만들지 않았거나 규칙이 막고 있으면 기록을 읽고 쓸 수 없습니다.
  // 그대로 쓰면 저장이 모두 실패하므로, 이 경우에는 브라우저 저장으로 열고 이유를 알립니다.
  try {
    await db.doc('config/main').get();
  } catch (e) {
    if (e && e.code === 'permission-denied') {
      return {
        ...createLocal(),
        label: 'Firebase에 접근할 수 없어(Firestore 생성·규칙 설정 확인) 이 브라우저에만 저장합니다. 설정을 마치면 새로고침하세요.',
        account,
      };
    }
    // 오프라인 등은 그대로 진행: 기기에 쌓아 두었다가 연결되면 올립니다.
  }

  await migrateLocal(db, readLocal);
  return createDbAdapter(db, {
    kind: 'firebase',
    label: `${user.email || '계정'}에 저장되어 폰과 PC에서 같은 기록이 보입니다.`,
    account,
  });
}

/** 계정에 기록이 하나도 없고 이 브라우저에 기록이 있으면 한 번 옮겨 둡니다(브라우저 기록은 지우지 않음). */
async function migrateLocal(db, readLocal) {
  try {
    const local = readLocal && readLocal();
    if (!local || !db.setMany) return;
    const [cfg, days] = await Promise.all([db.doc('config/main').get(), db.collection('days').get()]);
    if (cfg.exists || !days.empty) return;
    const map = {};
    if (local.config) map['config/main'] = local.config;
    for (const [date, doc] of Object.entries(local.days)) map['days/' + date] = doc;
    if (Object.keys(map).length) await db.setMany(map);
  } catch {
    /* 오프라인 등: 다음에 접속할 때 다시 시도합니다 */
  }
}
