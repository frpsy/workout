// 모바일에서 깨지기 쉬운 스타일 약속을 지키는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('입력 칸 글자는 16px 이상(iOS가 포커스할 때 화면을 확대하지 않음)', () => {
  const rule = (sel) => css.split('\n').find((l) => l.startsWith(sel));
  assert.match(rule('textarea {'), /font-size: 16px/);
  assert.match(css, /input\[type="date"\][^{]*\{[^}]*font-size: 16px/);
});

test('더블탭 확대 지연을 없애고(touch-action) 작은 버튼의 눌리는 영역을 넓힘', () => {
  assert.match(css, /html \{ touch-action: manipulation; \}/);
  assert.match(css, /\.setpips button::after/);
});

test('화면 보기·난이도·효과음 버튼은 손가락으로 누르기 충분한 크기', () => {
  assert.match(css, /\.views button \{ min-width: 44px; height: 30px;/);
  assert.match(css, /\.levels button \{ min-width: 44px; height: 32px;/);
});

test('홈 화면 앱: 상태 표시줄 뒤를 배경색으로 덮고 html 배경도 지정', () => {
  assert.match(css, /\.standalone body::before \{[^}]*height: env\(safe-area-inset-top/);
  assert.match(css, /html \{ background: var\(--bg\); \}/);
});

test('앱 이름: 페이지 제목·홈 화면 이름·설치 이름이 모두 Rep Streak', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.match(html, /<title>Rep Streak<\/title>/);
  assert.match(html, /apple-mobile-web-app-title" content="Rep Streak"/);
  assert.match(html, /class="splash-title">Rep Streak</);
  assert.equal(manifest.name, 'Rep Streak');
  assert.equal(manifest.short_name, 'Rep Streak');
  assert.ok(manifest.short_name.length <= 12, '홈 화면 아이콘 아래에 잘리지 않을 길이');
});

test('기록·설정 탭: 화면 제목이 있고 해당 탭에서만 보임', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(html, /<h1 class="page-title" id="recordTitle" hidden>기록<\/h1>/);
  assert.match(html, /<h1 class="page-title" id="settingsTitle" hidden>설정<\/h1>/);
  assert.match(main, /record: \[el\('recordTitle'\)/);
  assert.match(main, /settings: \[el\('settingsTitle'\)/);
});

test('설정: 쉬는 요일은 한 줄 7칸, 파일 고르기는 한글 버튼, 좁은 화면에서 입력칸이 잘리지 않음', () => {
  assert.match(css, /\.restdays \{ display: grid; grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.daychip input:checked \+ span/);
  assert.match(css, /textarea::placeholder \{ font-family: var\(--font-body\); \}/);
  assert.match(css, /@media \(max-width: 360px\) \{ \.exrow2 label \{ flex-direction: column;/);
});

test('디자인: 기록·설정 내용은 카드로 묶고, 기록 탭의 중복 접기 제목은 숨김, 목표 방식은 나란한 두 칸', () => {
  assert.match(css, /#moreBox > summary \{ display: none; \}/);
  assert.match(css, /#moreBox \.set-body > section, #settings details\.block, #plan-sec details\.block \{ background: var\(--surface\);/);
  assert.match(css, /\.modes \{ display: grid; grid-template-columns: 1fr 1fr;/);
});
