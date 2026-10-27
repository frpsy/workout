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
