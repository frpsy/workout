// 저장소 선택.
//
// 어댑터는 모두 같은 모양입니다:
//   {
//     kind, label, synced, canDownload,
//     subscribe({ onConfig(rawOrNull), onDays({date: raw}), onError(err) }) -> unsubscribe,
//     saveConfig(doc) -> Promise,
//     saveDay(date, doc) -> Promise,
//     saveDays?({date: doc}) -> Promise,   // 선택: 여러 날을 한 번에 (없으면 saveDay를 차례로)
//   }
// 저장 공간이 가득 차면 { code: 'quota_exceeded' } 오류를 던집니다.
// 다른 백엔드(예: Firebase)를 붙이려면 같은 모양으로 파일을 하나 만들고
// 아래 createStorage()의 순서에 넣으면 됩니다. 앱의 다른 부분은 바꿀 필요가 없습니다.

import { createClaudeDbAdapter } from './claude-db.js';
import { createLocalAdapter } from './local.js';

/** claude.ai 뷰어가 주입하는 window.claude를 잠깐 기다립니다. */
function waitForClaude(ms) {
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

export async function createStorage() {
  const claude = await waitForClaude(800);
  if (claude) {
    try {
      const db = await claude.use('db');
      if (db) return createClaudeDbAdapter(db);
    } catch {
      /* 로그인하지 않은 경우 등: 브라우저 저장으로 */
    }
  }
  return createLocalAdapter();
}
