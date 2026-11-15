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
  assert.equal(value('.undo::after', 'inset'), '-9px', '되돌리기: 보이는 26px + 9px씩 = 44px');
  assert.equal(value('.check', 'width'), '64px', '세트 완료는 버튼 하나로(보이는 64×44, 누르는 영역은 ::after로 넓힘)');
  assert.equal(value('.check::after', 'inset'), '-6px');
  assert.equal(value('.video::after', 'inset'), '-8px', '유튜브 아이콘: 보이는 28px + 8px씩 = 44px');
  for (const sel of ['.wbtn', '.wsec', '.timer .tgo']) assert.equal(value(sel, 'height'), '36px', sel + ': 보이는 크기는 작게');
  for (const sel of ['.stepper button', '.timer .tstep']) {
    assert.equal(value(sel, 'height'), '32px', sel + ': 가끔 쓰는 조절 버튼은 더 작게');
    assert.equal(value(sel + '::after', 'inset'), '-6px 0', sel + ': 누르는 영역은 44px');
  }
  assert.equal(value('.rows .check', 'touch-action'), 'pan-y pinch-zoom', '조작부에서 손가락이 옆으로 미끄러져도 옆 탭으로 넘어가지 않음');
  assert.equal(value('.rows', 'touch-action'), undefined, '카드의 빈 곳에서는 옆으로 밀어 탭을 넘길 수 있음');
  assert.equal(value('.page', 'overscroll-behavior-y'), 'contain');
  assert.match(css, /\.wbtn::after, \.wsec::after \{[^}]*inset: -4px 0/);
  assert.match(css, /\.timer \.tstep::after, \.timer \.tgo::after[^{]*\{[^}]*inset: -5px 0/);
  assert.equal(value('.setpips button'), undefined, '세트 표시는 누르는 버튼이 아님');
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
  // iOS 26 이후 홈 화면 앱의 위쪽 흐림: 불투명·고정된 진짜 요소가 상태 표시줄 아래 몇 px까지 눌림 판정에 잡혀야 WebKit이 흐림을 걷음
  assert.equal(value('.standalone .topcap', 'position'), 'fixed');
  assert.equal(value('.standalone .topcap', 'top'), '0');
  assert.equal(value('.standalone .topcap', 'height', { raw: true }), 'calc(env(safe-area-inset-top, 0px) + 8px)');
  assert.equal(value('.standalone .topcap', 'background', { raw: true }), 'var(--surface)', '앱 바탕과 다른 면 색(아래 탭 막대와 같음)');
  assert.equal(value('.standalone .topcap', 'border-bottom', { raw: true }), '1px solid var(--line)', '얇은 구분선');
  assert.equal(value('.standalone .topcap', 'pointer-events'), undefined, 'pointer-events: none이면 판정에 잡히지 않음');
  assert.equal(value('.standalone .wrap', 'padding-top', { raw: true }), 'calc(env(safe-area-inset-top, 0px) + 22px)', '내용은 덮개 아래에서 시작');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<body>\s*<div class="topcap" aria-hidden="true"><\/div>/);
  assert.match(html, /apple-mobile-web-app-status-bar-style" content="default"/, 'black-translucent이면 이 방법이 통하지 않음');
  assert.equal(value('html', 'background', { raw: true }), 'var(--bg)');
});

test('시작 화면: 로고는 뷰포트 가운데가 아니라 --splash-cy(화면 높이의 절반, 위 가장자리 기준)에 고정되고, 값이 없으면 50%', () => {
  assert.equal(value('.splash-brand', 'position'), 'absolute');
  assert.equal(value('.splash-brand', 'top', { raw: true }), 'calc(var(--splash-cy, 50%) - 56px)', '로고 높이 113px의 반');
  assert.equal(value('.splash-load', 'top', { raw: true }), 'calc(var(--splash-cy, 50%) + 84px)');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /navigator\.standalone \|\| matchMedia\('\(display-mode: standalone\)'\)\.matches/, '설치형 앱에서만');
  assert.match(html, /setProperty\('--splash-cy', Math\.round\(screen\.height \/ 2\) \+ 'px'\)/);
  assert.ok(html.indexOf('--splash-cy') < html.indexOf('<link rel="stylesheet"'), '첫 그림 전에 값이 들어가야 함');
});

test('앱 이름: 페이지 제목·홈 화면 이름·설치 이름·시작 화면이 Repday로 통일', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.match(html, /<title>Repday · 매일 운동 기록<\/title>/);
  assert.match(html, /apple-mobile-web-app-title" content="Repday"/);
  assert.match(html, /class="splash-word" role="img" aria-label="Repday"><use href="#wordmark"\/>/, '시작 화면 이름은 글꼴 없이 그린 SVG');
  assert.match(html, /<symbol id="wordmark" viewBox="[^"]+"><path d="[^"]+" fill="currentColor"\/><path d="[^"]+" style="fill:var\(--wm-day,var\(--accent\)\)"\/><\/symbol>/);
  assert.doesNotMatch(html, /오늘운동/);
  assert.equal(manifest.name, 'Repday · 매일 운동 기록');
  assert.equal(manifest.short_name, 'Repday');
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
  assert.equal(value('#timer', 'position'), 'sticky', '화면 크기와 상관없이 휴식 타이머는 탭 막대 위에');
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

test('보기 단계: 기본(compact)은 펼친 종목만, 상세(normal)는 모든 종목의 조절 줄을 보임', () => {
  assert.equal(value('[data-view="normal"] .row:not(.current):not(.open):not(.timing) .ctrl', 'display'), undefined, '상세는 모든 종목의 조절 줄을 보임(기본과 달라야 함)');
  assert.equal(value('[data-view="compact"] .row:not(.open):not(.timing) .ctrl', 'display'), 'none', '시간을 재는 중인 종목은 접지 않음');
  assert.equal(value('.row .hint', 'display'), undefined, '다음 주 안내(상세)는 없어짐');
  assert.equal(value('[data-view="normal"] .more', 'display'), 'none');
});

test('휴식 타이머: 바탕 채움(.tfill)은 늘 버튼·숫자 뒤에(아이폰에서 채움이 내용을 덮지 않게)', () => {
  assert.equal(value('.timer', 'isolation'), 'isolate');
  assert.equal(value('.timer > *', 'z-index'), '1');
  assert.equal(value('.timer > .tfill', 'z-index'), '0');
  assert.equal(value('.timer > .tfill', 'pointer-events'), 'none');
  assert.equal(value('.timer > .tfill', 'height'), '3px', '진행 막대는 줄 전체를 덮지 않고 얇게');
  assert.equal(value('.timer > .tfill', 'bottom'), '4px');
  assert.equal(value('.timer > .tfill', 'inset'), undefined);
});

test('휴식 타이머: 쉬는 중·끝남은 같은 높이(64px, 아주 작은 폰 56px)의 큰 줄이고 숫자는 40px', () => {
  assert.equal(value('.timer.running', 'height'), '64px');
  assert.equal(value('.timer.done', 'height'), '64px');
  assert.equal(value('.timer.running', 'height', { media: '@media (max-height: 600px)' }), '56px');
  assert.equal(value('.timer.running .time', 'font-size'), '40px');
});

test('시작 화면: 걷힐 때는 전환(transition)이 아니라 투명도·크기만 바꾸는 애니메이션', () => {
  assert.match(value('.splash.leaving', 'animation'), /^splash-out 0\.26s/);
  assert.equal(value('.splash', 'transition'), undefined);
  assert.match(css, /@keyframes splash-out \{ to \{ opacity: 0; visibility: hidden; \} \}/);
});
