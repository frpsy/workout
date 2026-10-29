// 브라우저 저장소(localStorage) 어댑터. GitHub Pages 등 단독 실행용.

const KEY = 'workout-check:v2';
const LEGACY_KEY = 'wk-state'; // v1 단일 파일 버전

function probe() {
  try {
    const k = '__wc_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function read() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return JSON.parse(s);
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const o = JSON.parse(legacy);
      return { config: o.cfg || null, days: o.days || {} };
    }
  } catch {
    /* 손상된 데이터는 무시하고 새로 시작 */
  }
  return null;
}

/** 이 브라우저에 저장된 { config, days } (없으면 null). 계정으로 옮길 때 씁니다. */
export function readLocalData() {
  const o = read();
  return o && (o.config || Object.keys(o.days || {}).length) ? { config: o.config || null, days: o.days || {} } : null;
}

export function createLocalAdapter() {
  const available = probe();
  const loaded = read();
  const data = { config: (loaded && loaded.config) || null, days: (loaded && loaded.days) || {} };

  function write() {
    if (!available) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      // 브라우저마다 이름·번호가 달라 store가 알아보는 code로 바꿉니다.
      if (err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22)) {
        throw Object.assign(new Error('저장 공간 부족'), { code: 'quota_exceeded' });
      }
      throw err;
    }
  }

  return {
    kind: 'local',
    synced: false,
    label: available
      ? '이 브라우저에만 저장됩니다. Google로 로그인하면 계정에 저장되어 다른 기기에서도 볼 수 있습니다.'
      : '이 브라우저는 저장을 막고 있어 새로고침하면 기록이 사라집니다.',

    subscribe({ onConfig, onDays }) {
      onConfig(data.config);
      onDays({ ...data.days });
      // 같은 브라우저의 다른 탭에서 바꾼 내용 반영
      const onStorage = (e) => {
        if (e.key !== KEY || !e.newValue) return;
        try {
          const next = JSON.parse(e.newValue);
          data.config = next.config || null;
          data.days = next.days || {};
          onConfig(data.config);
          onDays({ ...data.days });
        } catch {
          /* 무시 */
        }
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },

    async saveConfig(doc) {
      data.config = doc;
      write();
    },

    async saveDay(date, doc) {
      data.days[date] = doc;
      write();
    },
  };
}
