// 모바일에서 깨지기 쉬운 스타일 약속을 지키는지 확인 (줄바꿈·순서 모양이 아니라 규칙의 값을 봄)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { css, rules, value } from './helpers/css.mjs';

const MH = '@media (max-height: 700px)';

test('입력 칸 글자는 16px 이상(iOS가 포커스할 때 화면을 확대하지 않음)', () => {
  for (const sel of ['input[type="date"]', 'input[type="number"]', 'input:not([type])', 'select']) assert.equal(value(sel, 'font-size'), '16px', sel);
});

test('더블탭 확대 지연을 없애고(touch-action) 작은 버튼의 눌리는 영역을 넓힘', () => {
  assert.equal(value('html', 'touch-action'), 'manipulation');
  assert.equal(value('.setpips button::after', 'content'), "''");
  assert.equal(value('.levels button::after', 'inset'), '-7px 0', '보이는 크기는 작게, 누르는 영역은 44px');
  assert.equal(value('.views button::after', 'inset'), '-7px 0');
});

test('화면 보기·난이도·효과음 버튼은 손가락으로 누르기 충분한 크기', () => {
  assert.equal(value('.levels button', 'min-width'), '44px');
  assert.equal(value('.levels button', 'height'), '30px', '겉 높이 34px(30 + 틀 위아래 2)');
  assert.equal(value('.snd', 'width'), '44px');
  assert.equal(value('.snd', 'height'), '34px');
  assert.equal(value('.levels', 'overflow'), undefined, '틀이 넘침을 자르면 누르는 영역이 32px로 줄어듦');
});

test('홈 화면 앱: 상태 표시줄 뒤를 배경색으로 덮고 html 배경도 지정', () => {
  assert.match(value('.standalone body::before', 'height'), /^env\(safe-area-inset-top/);
  assert.equal(value('html', 'background', { raw: true }), 'var(--bg)');
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

test('기록·설정 탭: 화면 제목이 그 탭 화면 안에 있음', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<div class="page" data-tab="record">\s*<div class="wrap">\s*<h1 class="page-title" id="recordTitle">기록<\/h1>/);
  assert.match(html, /<div class="page" data-tab="settings">\s*<div class="wrap">\s*<h1 class="page-title" id="settingsTitle">설정<\/h1>/);
});

test('설정: 쉬는 요일은 좁은 화면에서도 한 줄 7칸', () => {
  assert.equal(value('.restdays', 'grid-template-columns'), 'repeat(7, minmax(0, 1fr))');
});

test('옛 iOS에서도 보이도록 :has() 선택자를 쓰지 않음', () => {
  assert.doesNotMatch(css, /:has\(/);
});

test('키가 작은 폰(높이 700px 이하): 줄 간격을 줄이고 팁은 감추며, 마무리 칸은 탭 막대에 가려지지 않게 스크롤 여백을 둠', () => {
  assert.equal(value('.row', 'padding', { media: MH }), '7px 12px');
  assert.equal(value('.rows', 'gap', { media: MH }), '4px');
  assert.equal(value('.timer', 'height', { media: MH }), '44px');
  assert.equal(value('#timer', 'position', { media: MH }), 'sticky', '종목이 많아도 휴식 타이머는 탭 막대 위에');
  assert.equal(value('.tip', 'display', { media: MH }), 'none');
  assert.equal(value('.journal', 'scroll-margin-bottom', { raw: true }), 'calc(var(--tabbar-h) + 21px)', '탭 막대 높이 + 여백');
});

test('iOS Safari: 선택칸·날짜칸은 기본 모양 대신 같은 모양, details 삼각형 숨김, 입력칸 테두리는 3:1 이상 색', () => {
  assert.equal(value('select', 'appearance'), 'none');
  assert.equal(value('select', 'padding-right'), '32px');
  assert.match(value('select', 'background', { raw: true }), /^var\(--surface\) var\(--chev\)/);
  assert.equal(value('input[type="date"]', 'appearance'), 'none');
  assert.equal(value('details summary::-webkit-details-marker', 'display'), 'none');
  assert.match(css, /--ctrl-line: #7F8F87;/, '밝은 배경과 3.07:1 이상');
  assert.match(css, /--ctrl-line: #64776D;/, '어두운 배경과 3.5:1 이상');
});

test('디자인 값: 글자 크기·그림자 색은 :root 변수로만 정함', () => {
  for (const r of rules) {
    if (r.selectors.every((sel) => sel.startsWith(':root'))) continue; // 변수를 정의하는 블록(밝은·어두운 테마)
    for (const [prop, v] of Object.entries(r.decls)) {
      if (prop === 'font-size') assert.match(v, /^(var\(--fs-[\w-]+\)|inherit)$/, `${r.selectors} font-size: ${v}`);
      assert.doesNotMatch(v, /rgba\(/, `${r.selectors} ${prop}: 그림자 색은 --shadow-* 변수로`);
    }
  }
});

test('어두운 테마: 기기 설정 블록과 data-theme 블록의 값이 같음', () => {
  const dark = (pick) => Object.entries(rules.find(pick).decls).filter(([p]) => p.startsWith('--') || p === 'color-scheme');
  const byMedia = dark((r) => r.media === '@media (prefers-color-scheme: dark)' && r.selectors.includes(':root:not([data-theme="light"])'));
  const byAttr = dark((r) => !r.media && r.selectors.includes(':root[data-theme="dark"]'));
  assert.ok(byMedia.length >= 15);
  assert.deepEqual(byAttr, byMedia);
});
