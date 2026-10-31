// 문서 db 어댑터. claude.ai 아티팩트의 db 기능과 Firebase(Firestore)가 같은 모양의 db를 주므로 함께 씁니다.
//   db: { doc(path).onSnapshot/set, collection(path).onSnapshot, setMany?(map) }
// 문서 구조: config/main, days/<YYYY-MM-DD>

export function createClaudeDbAdapter(db) {
  return createDbAdapter(db, { kind: 'claude-db', label: '계정에 저장되어 폰과 PC에서 같은 기록이 보입니다.' });
}

export function createDbAdapter(db, { kind, label, account }) {
  const chains = new Map();

  // 한 문서에는 한 번에 하나씩만 쓰도록 순서를 맞춥니다.
  function enqueue(path, fn) {
    // Firestore는 호출 순서대로 로컬에 반영하고 오프라인 큐를 영구 보관합니다.
    // 서버 확인을 기다리면 후속 기록이 메모리에만 남으므로 즉시 전달합니다.
    if (kind === 'firebase') return fn();
    const prev = chains.get(path) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    chains.set(path, next);
    return next;
  }

  return {
    kind,
    synced: true,
    label,
    account,

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
