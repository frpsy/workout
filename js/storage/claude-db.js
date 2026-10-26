// claude.ai 아티팩트의 db 기능 어댑터. 계정에 저장되어 기기 간에 같은 기록이 보입니다.
// 문서 구조: config/main, days/<YYYY-MM-DD>

export function createClaudeDbAdapter(db) {
  const chains = new Map();

  // 한 문서에는 한 번에 하나씩만 쓰도록 순서를 맞춥니다.
  function enqueue(path, fn) {
    const prev = chains.get(path) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    chains.set(path, next);
    return next;
  }

  return {
    kind: 'claude-db',
    synced: true,
    canDownload: false,
    label: '계정에 저장되어 폰과 PC에서 같은 기록이 보입니다.',

    subscribe({ onConfig, onDays, onError }) {
      const unsubs = [
        db.doc('config/main').onSnapshot((s) => onConfig(s.exists ? s.data() : null), onError),
        db.collection('days').onSnapshot((s) => {
          const out = {};
          s.docs.forEach((d) => {
            out[d.id] = d.data();
          });
          onDays(out);
        }, onError),
      ];
      return () => unsubs.forEach((u) => u());
    },

    saveConfig(doc) {
      return enqueue('config/main', () => db.doc('config/main').set(doc));
    },

    saveDay(date, doc) {
      return enqueue('days/' + date, () => db.doc('days/' + date).set(doc));
    },
  };
}
