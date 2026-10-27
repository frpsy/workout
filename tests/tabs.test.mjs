import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountTabs, tabFromHash } from '../js/ui/tabs.js';

function setup(url = 'http://localhost/') {
  const dom = new JSDOM(
    '<!doctype html><body><div id="a"></div><div id="b"><details id="d"></details></div><div id="c"></div><nav id="nav"><button data-tab="today"></button><button data-tab="record"></button><button data-tab="settings"></button></nav></body>',
    { url },
  );
  const w = dom.window;
  w.scrollTo = () => {};
  const doc = w.document;
  const el = (id) => doc.getElementById(id);
  const tabs = mountTabs(el('nav'), { today: [el('a')], record: [el('b')], settings: [el('c')] }, { win: w, doc });
  return { w, doc, el, tabs };
}

test('탭 이름은 주소 뒤 #이름에서 읽고, 모르는 값은 오늘로', () => {
  assert.equal(tabFromHash(''), 'today');
  assert.equal(tabFromHash('#record'), 'record');
  assert.equal(tabFromHash('#settings'), 'settings');
  assert.equal(tabFromHash('#엉뚱'), 'today');
});

test('탭: 처음엔 오늘만 보이고, 누르면 그 탭만 보이며 주소에 남음', () => {
  const { w, doc, el, tabs } = setup();
  assert.equal(tabs.current, 'today');
  assert.equal(el('a').hidden, false);
  assert.equal(el('b').hidden, true);
  doc.querySelector('[data-tab="record"]').click();
  assert.equal(el('a').hidden, true);
  assert.equal(el('b').hidden, false);
  assert.equal(w.location.hash, '#record');
  assert.equal(doc.querySelector('[data-tab="record"]').getAttribute('aria-selected'), 'true');
  assert.equal(doc.querySelector('[data-tab="today"]').getAttribute('aria-selected'), 'false');
  assert.equal(el('d').open, true, '기록·설정 탭 안의 접힌 항목은 펼쳐 줌');
  doc.querySelector('[data-tab="today"]').click();
  assert.equal(el('a').hidden, false);
  assert.equal(w.location.hash, '');
});

test('탭: 주소의 #settings로 열면 설정 탭, 이벤트로도 이동', () => {
  const { w, doc, el, tabs } = setup('http://localhost/#settings');
  assert.equal(tabs.current, 'settings');
  assert.equal(el('c').hidden, false);
  doc.dispatchEvent(new w.CustomEvent('workout:goto-tab', { detail: 'today' }));
  assert.equal(tabs.current, 'today');
  assert.equal(el('a').hidden, false);
});

test('탭 전환이 "불러오는 중…" 문구를 다시 띄우지 않음(탭 대상에서 제외)', async () => {
  const { readFileSync } = await import('node:fs');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const call = main.slice(main.indexOf('mountTabs('), main.indexOf('});', main.indexOf('mountTabs(')));
  assert.ok(!call.includes('boot-status'));
});

test('홈 화면 앱: 화면을 끝까지 쓰고(viewport-fit=cover) 위·아래 안전 영역만큼 여백을 직접 둠', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.ok(html.includes('viewport-fit=cover'));
  assert.match(css, /\.standalone body \{ padding-top: calc\(env\(safe-area-inset-top, 0px\) \+ 21px\); \}/);
  assert.match(css, /\.tabbar \{[^}]*padding-bottom: calc\(env\(safe-area-inset-bottom, 0px\) \+ 10px\)/);
  assert.match(css, /\.wrap \{ padding-bottom: calc\(70px \+ env\(safe-area-inset-bottom/);
});
