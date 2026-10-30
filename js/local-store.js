// 이 브라우저(localStorage)에 작은 설정·상태를 읽고 쓰는 도우미.
// 저장이 막힌 브라우저(사생활 보호 모드 등)에서는 예외 없이 기본값을 돌려주고, 쓰기는 조용히 무시합니다.
// 그래서 값을 못 남겨도 앱은 그 화면을 연 동안 정상으로 동작하고, 다음에는 기본값으로 시작할 뿐입니다.

/** 글자 그대로 읽음. 없거나 읽을 수 없으면 fallback */
export function readText(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

/** 글자 그대로 저장. value가 null이면 지움 */
export function writeText(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 저장이 막힌 브라우저 */
  }
}

/** JSON 객체로 읽음. 없거나 깨졌거나 객체가 아니면 fallback */
export function readJson(key, fallback = {}) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  writeText(key, JSON.stringify(value));
}
