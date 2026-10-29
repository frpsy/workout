// 모바일에서 깨지기 쉬운 스타일 약속을 지키는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('입력 칸 글자는 16px 이상(iOS가 포커스할 때 화면을 확대하지 않음)', () => {
  assert.match(css, /input\[type="date"\][^{]*\{[^}]*font-size: 16px/);
});

test('더블탭 확대 지연을 없애고(touch-action) 작은 버튼의 눌리는 영역을 넓힘', () => {
  assert.match(css, /html \{ touch-action: manipulation;/);
  assert.match(css, /\.setpips button::after/);
  assert.match(css, /\.levels button::after, \.views button::after, \.snd::after \{ content: ''; position: absolute; inset: -6px 0; \}/, '보이는 크기는 작게, 누르는 영역은 44px');
});

test('화면 보기·난이도·효과음 버튼은 손가락으로 누르기 충분한 크기', () => {
  assert.match(css, /\.views button \{ position: relative; min-width: 44px; height: 32px;/);
  assert.match(css, /\.levels button \{ position: relative; min-width: 44px; height: 32px;/);
  assert.match(css, /\.snd \{ position: relative; flex: none; display: grid; place-items: center; width: 44px; height: 34px;/);
  assert.doesNotMatch(css, /\.(levels|views) \{[^}]*overflow: hidden/, '틀이 넘침을 자르면 누르는 영역이 32px로 줄어듦');
});

test('홈 화면 앱: 상태 표시줄 뒤를 배경색으로 덮고 html 배경도 지정', () => {
  assert.match(css, /\.standalone body::before \{[^}]*height: env\(safe-area-inset-top/);
  assert.match(css, /html \{ touch-action: manipulation; background: var\(--bg\); \}/);
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

test('설정: 쉬는 요일은 한 줄 7칸, 좁은 화면에서 입력칸이 잘리지 않음', () => {
  assert.match(css, /\.restdays \{ display: grid; grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.daychip input:checked \+ span/);
  assert.match(css, /\.exrow2 label \{ display: flex; flex-direction: column;/, '라벨은 입력칸 위에(어느 폭에서나 입력칸 너비가 같음)');
});

test('디자인: 기록 내용은 카드로 묶고 중복 접기 제목은 숨김, 설정은 작은 제목 + 줄 목록, 목표 방식은 나란한 두 칸', () => {
  assert.match(css, /#moreBox > summary \{ display: none; \}/);
  assert.match(css, /#moreBox \.set-body > section, #plan-sec details\.block \{ background: var\(--surface\);/);
  assert.match(css, /\.modes \{ display: grid; grid-template-columns: 1fr 1fr;/);
  assert.match(css, /\.seg input:checked \+ span \{/, ':has() 없이 선택 표시(옛 iOS에서도 보임)');
  assert.doesNotMatch(css, /:has\(/);
  assert.match(css, /\.slist \{ background: var\(--surface\);/);
  assert.match(css, /\.switch input:checked \+ i \{ background: var\(--accent-fill\); \}/);
});

test('키가 작은 폰(높이 700px 이하): 줄 간격을 줄이고 팁은 감추며, 마무리 칸은 탭 막대에 가려지지 않게 스크롤 여백을 둠', () => {
  assert.match(css, /@media \(max-height: 700px\) \{\s*\.row \{ padding: 7px 12px;[^}]*\}\s*\.rows \{ gap: 4px; \}\s*\.timer \{ height: 44px; \}\s*#timer \{ position: sticky;[^}]*\}[^\n]*\s*\.tip \{ display: none; \}/);
  assert.match(css, /\.journal \{ scroll-margin-bottom: calc\(84px \+ env\(safe-area-inset-bottom, 0px\)\);/);
});

test('iOS Safari: 선택칸·날짜칸은 기본 모양 대신 같은 모양, details 삼각형 숨김, 입력칸 테두리는 3:1 이상 색', () => {
  assert.match(css, /select \{ -webkit-appearance: none; appearance: none; padding-right: 32px; background: var\(--surface\) var\(--chev\)/);
  assert.match(css, /input\[type="date"\] \{ -webkit-appearance: none; appearance: none;/);
  assert.match(css, /details summary::-webkit-details-marker \{ display: none; \}/);
  assert.match(css, /--ctrl-line: #7F8F87;/, '밝은 배경과 3.07:1 이상');
  assert.match(css, /--ctrl-line: #64776D;/, '어두운 배경과 3.5:1 이상');
});
