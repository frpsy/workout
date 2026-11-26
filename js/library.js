// 운동 도감: 집에 있는 기구(맨몸·철봉·아령)로 하는 동작 모음 (순수 데이터와 함수)
//
// 원칙: 관절에 무리가 덜 가는 동작만 고르고, 동작마다 더 쉬운 동작과 더 어려운 동작을 이어 둡니다.
// 자세 요령(cue)은 한 문장으로, 오늘 화면의 지금 할 종목 아래에 보입니다.

/** 기구: body(맨몸)는 늘 쓸 수 있고, 나머지는 설정의 '내 기구'에서 고릅니다 */
export const EQUIPMENT = [
  { id: 'bar', name: '철봉' },
  { id: 'db', name: '아령' },
  { id: 'tread', name: '러닝머신' },
];
export const EQUIPMENT_IDS = EQUIPMENT.map((e) => e.id);

/** 움직임 묶음: 한 주 안에서 고르게 하면 몸 앞뒤·위아래 힘이 균형을 이룹니다 */
export const PATTERNS = [
  { id: 'push', name: '밀기' },
  { id: 'pull', name: '당기기' },
  { id: 'legs', name: '하체' },
  { id: 'hinge', name: '엉덩이·허리' },
  { id: 'core', name: '코어' },
];

/**
 * id: 도감 키, equip: body|bar|db, pattern, unit: reps|sec, base·step·max: 처음 목표·매주 늘리는 양·세트당 상한
 * easier·harder: 더 쉬운·어려운 동작 id, side: 한쪽씩 하는 동작(목표는 한쪽 기준)
 */
export const LIBRARY = [
  // 밀기
  { id: 'wall-pushup', name: '벽 푸시업', equip: 'body', pattern: 'push', unit: 'reps', base: 12, step: 1, max: 25, harder: 'knee-pushup', cue: '벽에서 한 걸음 물러나 몸을 일자로 두고 가슴을 벽 가까이 내립니다' },
  { id: 'knee-pushup', name: '무릎 푸시업', equip: 'body', pattern: 'push', unit: 'reps', base: 10, step: 1, max: 20, easier: 'wall-pushup', harder: 'pushup', cue: '무릎부터 머리까지 일자로 두고 가슴이 주먹 하나 높이까지 내려갑니다' },
  { id: 'pushup', name: '푸시업', equip: 'body', pattern: 'push', unit: 'reps', base: 8, step: 1, max: 30, easier: 'knee-pushup', harder: 'pike-pushup', cue: '손은 어깨너비, 팔꿈치는 몸통에서 45도로 벌려 내려갑니다' },
  { id: 'pike-pushup', name: '파이크 푸시업', equip: 'body', pattern: 'push', unit: 'reps', base: 6, step: 1, max: 15, easier: 'pushup', cue: '엉덩이를 높이 들어 ㅅ자를 만들고 정수리를 손 사이로 내립니다' },
  { id: 'db-floor-press', name: '아령 플로어 프레스', equip: 'db', pattern: 'push', unit: 'reps', base: 10, step: 1, max: 15, cue: '바닥에 누워 위팔이 바닥에 닿을 때까지 내렸다가 밀어 올립니다' },
  { id: 'db-shoulder-press', name: '아령 숄더 프레스', equip: 'db', pattern: 'push', unit: 'reps', base: 8, step: 1, max: 12, cue: '배에 힘을 주어 허리가 꺾이지 않게 하고 머리 위로 곧게 밉니다' },
  // 당기기
  { id: 'dead-hang', name: '매달리기', equip: 'bar', pattern: 'pull', unit: 'sec', base: 20, step: 5, max: 60, harder: 'scap-pullup', cue: '팔을 편 채 편안히 매달리고 숨을 고르게 쉽니다' },
  { id: 'scap-pullup', name: '어깨 당기기', equip: 'bar', pattern: 'pull', unit: 'reps', base: 8, step: 1, max: 15, easier: 'dead-hang', harder: 'negative-pullup', cue: '팔을 편 채 어깨뼈만 아래로 끌어내려 몸을 살짝 올립니다' },
  { id: 'negative-pullup', name: '네거티브 풀업', equip: 'bar', pattern: 'pull', unit: 'reps', base: 3, step: 0.5, max: 8, easier: 'scap-pullup', harder: 'chinup', cue: '흔들리지 않는 발판을 딛고 올라가 3~5초에 걸쳐 천천히 내려옵니다' },
  { id: 'chinup', name: '친업', equip: 'bar', pattern: 'pull', unit: 'reps', base: 4, step: 0.5, max: 12, easier: 'negative-pullup', harder: 'pullup', cue: '손바닥이 나를 보게 잡고 턱이 철봉 위로 올라올 때까지 당깁니다' },
  { id: 'pullup', name: '풀업', equip: 'bar', pattern: 'pull', unit: 'reps', base: 3, step: 0.5, max: 10, easier: 'chinup', cue: '어깨를 먼저 내린 뒤 가슴을 철봉 쪽으로 끌어당깁니다' },
  { id: 'db-row', name: '아령 로우', equip: 'db', pattern: 'pull', unit: 'reps', base: 10, step: 1, max: 15, side: true, cue: '등을 평평하게 두고 팔꿈치를 뒷주머니 쪽으로 당깁니다' },
  { id: 'db-reverse-fly', name: '아령 리버스 플라이', equip: 'db', pattern: 'pull', unit: 'reps', base: 10, step: 1, max: 15, cue: '상체를 숙이고 팔꿈치를 살짝 굽힌 채 양옆으로 엽니다' },
  // 하체
  { id: 'squat', name: '스쿼트', equip: 'body', pattern: 'legs', unit: 'reps', base: 15, step: 2, max: 40, harder: 'split-squat', cue: '무릎은 발끝 방향으로, 의자에 앉듯 엉덩이를 뒤로 뺍니다' },
  { id: 'reverse-lunge', name: '리버스 런지', equip: 'body', pattern: 'legs', unit: 'reps', base: 10, step: 1, max: 20, side: true, easier: 'squat', harder: 'split-squat', cue: '한 발을 뒤로 디뎌 두 무릎이 직각이 될 때까지 내려갑니다' },
  { id: 'split-squat', name: '스플릿 스쿼트', equip: 'body', pattern: 'legs', unit: 'reps', base: 10, step: 1, max: 20, side: true, easier: 'reverse-lunge', cue: '앞뒤로 발을 벌리고 상체를 세운 채 몸을 수직으로 내렸다가 일어납니다' },
  { id: 'calf-raise', name: '카프 레이즈', equip: 'body', pattern: 'legs', unit: 'reps', base: 15, step: 2, max: 30, cue: '발끝으로 천천히 올라가 1초 멈췄다가 천천히 내려옵니다' },
  { id: 'goblet-squat', name: '고블릿 스쿼트', equip: 'db', pattern: 'legs', unit: 'reps', base: 10, step: 1, max: 15, cue: '아령을 가슴에 붙여 들고 등을 편 채 자세가 무너지지 않는 깊이까지 앉습니다' },
  { id: 'db-reverse-lunge', name: '아령 리버스 런지', equip: 'db', pattern: 'legs', unit: 'reps', base: 8, step: 1, max: 12, side: true, cue: '양손에 아령을 들고 상체를 세운 채 뒤로 디뎌 내려갑니다' },
  // 엉덩이·허리
  { id: 'glute-bridge', name: '글루트 브리지', equip: 'body', pattern: 'hinge', unit: 'reps', base: 15, step: 2, max: 30, harder: 'single-bridge', cue: '누워서 무릎을 세우고 엉덩이를 조이며 어깨부터 무릎까지 일자로 듭니다' },
  { id: 'single-bridge', name: '한 다리 브리지', equip: 'body', pattern: 'hinge', unit: 'reps', base: 8, step: 1, max: 15, side: true, easier: 'glute-bridge', cue: '한 다리를 든 채 골반이 기울지 않게 엉덩이를 들어 올립니다' },
  { id: 'db-rdl', name: '아령 루마니안 데드리프트', equip: 'db', pattern: 'hinge', unit: 'reps', base: 10, step: 1, max: 15, cue: '무릎을 살짝 굽히고 등을 곧게 편 채 엉덩이를 뒤로 밀며 숙입니다' },
  // 코어
  { id: 'plank', name: '플랭크', equip: 'body', pattern: 'core', unit: 'sec', base: 30, step: 5, max: 90, harder: 'side-plank', cue: '팔꿈치를 어깨 아래에 두고 엉덩이가 처지지 않게 일자로 버팁니다' },
  { id: 'side-plank', name: '사이드 플랭크', equip: 'body', pattern: 'core', unit: 'sec', base: 20, step: 5, max: 60, side: true, easier: 'plank', cue: '옆으로 누워 팔꿈치로 받치고 머리부터 발까지 일자로 듭니다' },
  { id: 'dead-bug', name: '데드버그', equip: 'body', pattern: 'core', unit: 'reps', base: 10, step: 1, max: 20, cue: '허리를 바닥에 붙인 채 반대쪽 팔과 다리를 천천히 폅니다' },
  { id: 'bird-dog', name: '버드독', equip: 'body', pattern: 'core', unit: 'reps', base: 10, step: 1, max: 20, cue: '네발 자세에서 허리가 꺾이지 않는 만큼 반대쪽 팔과 다리를 뻗고 2초 멈춥니다' },
  { id: 'hanging-knee-raise', name: '행잉 니 레이즈', equip: 'bar', pattern: 'core', unit: 'reps', base: 6, step: 1, max: 15, cue: '철봉에 매달려 몸이 흔들리지 않게 무릎을 가슴 쪽으로 끌어올립니다' },
  { id: 'farmer-carry', name: '아령 들고 걷기', equip: 'db', pattern: 'core', unit: 'sec', base: 30, step: 5, max: 60, cue: '양손에 아령을 들고 어깨를 내린 채 똑바로 걷습니다' },
];

const BY_ID = new Map(LIBRARY.map((x) => [x.id, x]));
export const libById = (id) => BY_ID.get(id) || null;

/** 기본 운동(예전 설정의 push·pull·squat)은 도감의 같은 동작으로 봅니다 */
const DEFAULT_LIB = { push: 'pushup', pull: 'pullup', squat: 'squat' };
const BY_NAME = new Map(LIBRARY.map((x) => [x.name, x]));

/** 종목에 맞는 도감 항목(lib 필드 → 기본 운동 → 같은 이름 순). 없으면 null */
export function libFor(ex) {
  if (!ex) return null;
  return libById(ex.lib) || libById(DEFAULT_LIB[ex.id]) || BY_NAME.get(ex.name) || null;
}

/** 내 기구 정규화: 알려진 기구만, 중복 없이. 저장된 값이 없으면 모두 있다고 봄 */
export function normalizeEquipment(raw) {
  if (!Array.isArray(raw)) return null;
  return EQUIPMENT_IDS.filter((id) => raw.includes(id));
}

/** 이 기구 목록(null이면 모두)으로 할 수 있는 동작인지 */
export function usable(item, equipment) {
  return item.equip === 'body' || !equipment || equipment.includes(item.equip);
}

/** 설정의 추가 목록: 움직임 묶음별로, 내 기구로 할 수 있고 아직 목록에 없는 동작 */
export function libraryGroups(equipment, exercises) {
  const have = new Set(exercises.map((e) => libFor(e)?.id).filter(Boolean));
  return PATTERNS.map((p) => ({
    ...p,
    items: LIBRARY.filter((x) => x.pattern === p.id && usable(x, equipment) && !have.has(x.id)),
  })).filter((g) => g.items.length);
}
