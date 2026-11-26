// 운동 도감: 맨몸·철봉·아령으로 하는 동작 모음(러닝머신은 회사·아파트 헬스장 같은 바깥 기구로 봄) (순수 데이터와 함수)
//
// 원칙: 관절에 무리가 덜 가는 동작만 고르고, 아령은 간단한 컬 종류만 둡니다.
// 동작마다 더 쉬운 동작과 더 어려운 동작을 이어 둡니다.
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
  { id: 'arms', name: '팔(아령)' },
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
  // 당기기
  { id: 'dead-hang', name: '매달리기', equip: 'bar', pattern: 'pull', unit: 'sec', base: 20, step: 5, max: 60, harder: 'scap-pullup', cue: '팔을 편 채 편안히 매달리고 숨을 고르게 쉽니다' },
  { id: 'scap-pullup', name: '어깨 당기기', equip: 'bar', pattern: 'pull', unit: 'reps', base: 8, step: 1, max: 15, easier: 'dead-hang', harder: 'negative-pullup', cue: '팔을 편 채 어깨뼈만 아래로 끌어내려 몸을 살짝 올립니다' },
  { id: 'negative-pullup', name: '네거티브 풀업', equip: 'bar', pattern: 'pull', unit: 'reps', base: 3, step: 0.5, max: 8, easier: 'scap-pullup', harder: 'chinup', cue: '흔들리지 않는 발판을 딛고 올라가 3~5초에 걸쳐 천천히 내려옵니다' },
  { id: 'chinup', name: '친업', equip: 'bar', pattern: 'pull', unit: 'reps', base: 4, step: 0.5, max: 12, easier: 'negative-pullup', harder: 'pullup', cue: '손바닥이 나를 보게 잡고 턱이 철봉 위로 올라올 때까지 당깁니다' },
  { id: 'pullup', name: '풀업', equip: 'bar', pattern: 'pull', unit: 'reps', base: 3, step: 0.5, max: 10, easier: 'chinup', cue: '어깨를 먼저 내린 뒤 가슴을 철봉 쪽으로 끌어당깁니다' },
  // 하체
  { id: 'squat', name: '스쿼트', equip: 'body', pattern: 'legs', unit: 'reps', base: 15, step: 2, max: 40, harder: 'split-squat', cue: '무릎은 발끝 방향으로, 의자에 앉듯 엉덩이를 뒤로 뺍니다' },
  { id: 'reverse-lunge', name: '리버스 런지', equip: 'body', pattern: 'legs', unit: 'reps', base: 10, step: 1, max: 20, side: true, easier: 'squat', harder: 'split-squat', cue: '한 발을 뒤로 디뎌 두 무릎이 직각이 될 때까지 내려갑니다' },
  { id: 'split-squat', name: '스플릿 스쿼트', equip: 'body', pattern: 'legs', unit: 'reps', base: 10, step: 1, max: 20, side: true, easier: 'reverse-lunge', cue: '앞뒤로 발을 벌리고 상체를 세운 채 몸을 수직으로 내렸다가 일어납니다' },
  { id: 'calf-raise', name: '카프 레이즈', equip: 'body', pattern: 'legs', unit: 'reps', base: 15, step: 2, max: 30, cue: '발끝으로 천천히 올라가 1초 멈췄다가 천천히 내려옵니다' },
  // 엉덩이·허리
  { id: 'glute-bridge', name: '글루트 브리지', equip: 'body', pattern: 'hinge', unit: 'reps', base: 15, step: 2, max: 30, harder: 'single-bridge', cue: '누워서 무릎을 세우고 엉덩이를 조이며 어깨부터 무릎까지 일자로 듭니다' },
  { id: 'single-bridge', name: '한 다리 브리지', equip: 'body', pattern: 'hinge', unit: 'reps', base: 8, step: 1, max: 15, side: true, easier: 'glute-bridge', cue: '한 다리를 든 채 골반이 기울지 않게 엉덩이를 들어 올립니다' },
  // 코어
  { id: 'plank', name: '플랭크', equip: 'body', pattern: 'core', unit: 'sec', base: 30, step: 5, max: 90, harder: 'side-plank', cue: '팔꿈치를 어깨 아래에 두고 엉덩이가 처지지 않게 일자로 버팁니다' },
  { id: 'side-plank', name: '사이드 플랭크', equip: 'body', pattern: 'core', unit: 'sec', base: 20, step: 5, max: 60, side: true, easier: 'plank', cue: '옆으로 누워 팔꿈치로 받치고 머리부터 발까지 일자로 듭니다' },
  { id: 'dead-bug', name: '데드버그', equip: 'body', pattern: 'core', unit: 'reps', base: 10, step: 1, max: 20, cue: '허리를 바닥에 붙인 채 반대쪽 팔과 다리를 천천히 폅니다' },
  { id: 'bird-dog', name: '버드독', equip: 'body', pattern: 'core', unit: 'reps', base: 10, step: 1, max: 20, cue: '네발 자세에서 허리가 꺾이지 않는 만큼 반대쪽 팔과 다리를 뻗고 2초 멈춥니다' },
  { id: 'hanging-knee-raise', name: '행잉 니 레이즈', equip: 'bar', pattern: 'core', unit: 'reps', base: 6, step: 1, max: 15, cue: '철봉에 매달려 몸이 흔들리지 않게 무릎을 가슴 쪽으로 끌어올립니다' },
  // 팔(아령): 간단한 컬 종류만
  { id: 'db-curl', name: '덤벨 컬', equip: 'db', pattern: 'arms', unit: 'reps', base: 10, step: 1, max: 15, harder: 'concentration-curl', cue: '팔꿈치를 옆구리에 붙인 채 손바닥이 위를 보게 천천히 들어 올립니다' },
  { id: 'hammer-curl', name: '해머 컬', equip: 'db', pattern: 'arms', unit: 'reps', base: 10, step: 1, max: 15, cue: '손바닥이 서로 마주 보게 잡고 팔꿈치를 고정한 채 들어 올립니다' },
  { id: 'concentration-curl', name: '컨센트레이션 컬', equip: 'db', pattern: 'arms', unit: 'reps', base: 8, step: 1, max: 12, side: true, easier: 'db-curl', cue: '앉아서 팔꿈치를 허벅지 안쪽에 대고 한쪽씩 천천히 들어 올립니다' },
];

/**
 * 운동법 영상: 동작마다 조회수 높은 한국어 자세 영상 하나(2026-11-26 유튜브 검색에서 고르고 열리는지 확인).
 * ch는 채널 이름. 한국어 영상이 없던 동작(어깨 당기기·한 다리 브리지)은 가장 가까운 동작의 영상을 씀
 */
export const VIDEOS = {
  'wall-pushup': { id: 'nXifOjEgUR0', ch: 'Sean Lee' },
  'knee-pushup': { id: 'vfLVQQ0CsNw', ch: '채코치의 운동생활' },
  pushup: { id: '-_DUjHxgmWk', ch: '바벨라토르 홈트레이닝' },
  'pike-pushup': { id: 'XMQo6XZwaoc', ch: 'Master Choi' },
  'dead-hang': { id: 'juhis5jjF7c', ch: '보통사람을 위한 운동채널' },
  'scap-pullup': { id: '4HLGdRyMkIU', ch: '바벨라토르 홈트레이닝' },
  'negative-pullup': { id: '551f1r0wdc4', ch: '세계적으로 유명한 운동 정보' },
  chinup: { id: '6GWGVAO8oU4', ch: '핏블리' },
  pullup: { id: 'nWhS28U6bCY', ch: '바벨라토르 홈트레이닝' },
  squat: { id: '9Sl5tI4_J-0', ch: '메루치양식장' },
  'reverse-lunge': { id: '7erin-2cpRo', ch: '이득근' },
  'split-squat': { id: 'isX0pDUue8g', ch: '핏블리' },
  'calf-raise': { id: '-azhxuWVYCM', ch: '쇠질연구소' },
  'glute-bridge': { id: '6EGYtkbj_34', ch: '자세요정' },
  'single-bridge': { id: '6EGYtkbj_34', ch: '자세요정' },
  plank: { id: 'v54Jtmi2BwU', ch: '힙으뜸' },
  'side-plank': { id: 'fHJA-x1bh58', ch: '채코치의 운동생활' },
  'dead-bug': { id: 'EHn2WswT5uU', ch: '움직이기' },
  'bird-dog': { id: 'k9uHaNi4lSM', ch: '알쓸물치' },
  'hanging-knee-raise': { id: '9DY22a5Zc9I', ch: '세계적으로 유명한 운동 정보' },
  'db-curl': { id: '3t03ehGkH-Q', ch: '키다리형' },
  'hammer-curl': { id: 'n4L2Kvdtg-8', ch: '강경원' },
  'concentration-curl': { id: 'lzRl0hd0fUg', ch: '양선수의 온라인PT' },
};
export const videoOf = (item) => (item && VIDEOS[item.id]) || null;

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
