// 저장소 선택.
//
// 어댑터는 모두 같은 모양입니다:
//   {
//     kind, label, synced,
//     subscribe({ onConfig(rawOrNull), onDays({date: raw}), onError(err) }) -> unsubscribe,
//     saveConfig(doc) -> Promise,
//     saveDay(date, doc) -> Promise,
//   }
// 저장 공간이 가득 차면 { code: 'quota_exceeded' } 오류를 던집니다.
// 선택 사항: account = { email?, signIn?(), signOut?() } — 설정 화면에 로그인·로그아웃 버튼을 보여 줍니다.
// 다른 백엔드를 붙이려면 같은 모양으로 파일을 하나 만들고 아래 createStorage()의 순서에 넣으면 됩니다.
// 앱의 다른 부분은 바꿀 필요가 없습니다.

import { createClaudeDbAdapter } from './claude-db.js';
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { createFirebaseStorage } from './firebase.js';
import { createLocalAdapter, readLocalData } from './local.js';

/** claude.ai 뷰어가 주입하는 window.claude를 잠깐 기다립니다. 뷰어 안(iframe)이 아니면 기다리지 않음 */
function waitForClaude(ms) {
  const embedded = typeof window !== 'undefined' && window.parent !== window;
  if (!embedded && !(typeof window !== 'undefined' && window.claude)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const started = Date.now();
    (function poll() {
      const c = typeof window !== 'undefined' ? window.claude : undefined;
      if (c && typeof c.use === 'function') return resolve(c);
      if (Date.now() - started >= ms) return resolve(null);
      setTimeout(poll, 50);
    })();
  });
}

/** onStep('auth' | 'data'): 시작 화면 진행 막대용 알림 */
export async function createStorage({ onStep = () => {} } = {}) {
  const claude = await waitForClaude(800);
  if (claude) {
    try {
      const db = await claude.use('db');
      if (db) return createClaudeDbAdapter(db);
    } catch {
      /* 로그인하지 않은 경우 등: 브라우저 저장으로 */
    }
  }
  if (FIREBASE_CONFIG) {
    const fb = await createFirebaseStorage({ config: FIREBASE_CONFIG, createLocal: createLocalAdapter, readLocal: readLocalData, onStep });
    if (fb) return fb;
  }
  return createLocalAdapter();
}
