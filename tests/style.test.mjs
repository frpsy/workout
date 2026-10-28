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
