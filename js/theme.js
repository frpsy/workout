// 화면 색(자동·라이트·다크). 자동은 기기 설정을 따르되, 앱을 오갈 때 잠깐 어둡게 보고되는 값에는 흔들리지 않게
// <html data-theme>을 직접 정하고, 값이 바뀌어도 잠시 기다렸다가 화면이 보이는 상태에서 다시 읽어 반영합니다.

import { readText, writeText } from './local-store.js';

const KEY = 'workout-check:theme';
export const THEMES = ['auto', 'light', 'dark'];
export const THEME_LABEL = { auto: '자동', light: '라이트', dark: '다크' };
export const THEME_COLOR = { light: '#F8F9FF', dark: '#12131A' }; // 상태 표시줄(--bg와 같은 값)
export const SETTLE_MS = 400; // 앱을 오가는 동안의 순간적인 값을 건너뛰고 안정된 값만 읽음

export function loadTheme() {
  const v = readText(KEY);
  return THEMES.includes(v) ? v : 'auto';
}

export function saveTheme(pref) {
  writeText(KEY, THEMES.includes(pref) ? pref : 'auto');
}

/** 고른 값(auto·light·dark)과 기기가 지금 어두운지로 실제 색(light·dark)을 정함 */
export function resolveTheme(pref, deviceDark) {
  return pref === 'light' || pref === 'dark' ? pref : deviceDark ? 'dark' : 'light';
}

export function applyTheme(theme, doc = document) {
  const root = doc.documentElement;
  if (root.getAttribute('data-theme') !== theme) root.setAttribute('data-theme', theme);
  for (const m of doc.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', THEME_COLOR[theme]);
}

/**
 * 시작할 때 한 번 부르면 됩니다. 돌려주는 setPref(pref)는 설정에서 고른 값을 저장하고 바로 적용합니다.
 * 숨겨져 있는 동안의 변화는 무시하고, 다시 보일 때와 기기 설정이 바뀐 뒤 SETTLE_MS가 지나면 그때 값을 한 번만 읽습니다.
 */
export function mountTheme(win = window) {
  const doc = win.document;
  const mq = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-color-scheme: dark)') : null;
  let pref = loadTheme();
  let timer = 0;
  const apply = () => applyTheme(resolveTheme(pref, !!(mq && mq.matches)), doc);
  const settle = () => {
    win.clearTimeout(timer);
    timer = win.setTimeout(() => {
      if (!doc.hidden) apply();
    }, SETTLE_MS);
  };
  apply();
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', settle);
    else if (mq.addListener) mq.addListener(settle);
  }
  doc.addEventListener('visibilitychange', settle);
  return {
    get pref() {
      return pref;
    },
    setPref(next) {
      pref = THEMES.includes(next) ? next : 'auto';
      saveTheme(pref);
      apply();
    },
  };
}
