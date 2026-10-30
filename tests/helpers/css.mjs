// style.css를 규칙 단위로 읽는 작은 도우미. 줄바꿈·정렬 모양과 상관없이 "이 선택자의 이 속성 값"을 확인합니다.
import { readFileSync } from 'node:fs';

export const css = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');

/** [{ media: '@media (...)' | '', selectors: ['.a', '.b'], decls: { prop: value } }] (@font-face·@keyframes 제외) */
export function parseRules(text = css) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const ctx = [];
  let rule = null;
  for (const m of src.matchAll(/([^{};]+)\{|\}|([^{};]+);/g)) {
    if (m[1] !== undefined) {
      const head = m[1].trim().replace(/\s+/g, ' ');
      ctx.push(head);
      rule = head.startsWith('@') ? null : { media: ctx.filter((c) => c.startsWith('@media')).join(' '), selectors: head.split(/,\s*/), decls: {} };
      if (rule && !ctx.some((c) => /^@(font-face|keyframes)/.test(c))) out.push(rule);
    } else if (m[0] === '}') {
      ctx.pop();
      rule = null;
    } else if (rule) {
      const d = m[2].trim();
      const i = d.indexOf(':');
      if (i > 0) rule.decls[d.slice(0, i).trim()] = d.slice(i + 1).trim().replace(/\s+/g, ' ');
    }
  }
  return out;
}

const RULES = parseRules();
const ROOT = Object.assign({}, ...RULES.filter((r) => !r.media && r.selectors.includes(':root')).map((r) => r.decls));

/** var(--x)를 밝은 테마 :root 값으로 바꿈 */
export const resolve = (value) => value.replace(/var\((--[\w-]+)\)/g, (all, name) => (name in ROOT ? resolve(ROOT[name]) : all));

/** 선택자(정확히 같은 글자)와 미디어 조건에 맞는 규칙들에서 속성 값. 여러 개면 뒤의 것. 없으면 undefined */
export function value(selector, prop, { media = '', raw = false } = {}) {
  let v;
  for (const r of RULES) if (r.media === media && r.selectors.includes(selector) && prop in r.decls) v = r.decls[prop];
  return v === undefined || raw ? v : resolve(v);
}

export const rules = RULES;
