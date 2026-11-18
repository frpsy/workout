// 앱 상태와 동작. 화면은 subscribe로 상태를 받아 그리기만 합니다.

import { LEVELS, LIMITS } from './config.js';
import { entryView, hasChecks, markDone, markProgress, markSets, markUndone, mergeRounds, plannedTarget } from './day.js';
import { isDateStr, todayStr } from './dates.js';
import { MAX_SESSIONS, NOTE_MAX, normalizeConfig, normalizeDay, serializeConfig, serializeDay } from './model.js';
import { createTargetResolver } from './progression.js';
import { setSetCount, syncSets } from './setlog.js';

const SAVE_DELAY = 350;

export function createStore(adapter) {
  const today = todayStr();
  const state = {
    adapter,
    today,
    selected: today,
    config: normalizeConfig(null, today),
    configSaved: false, // 저장소에 설정 문서가 있는지
    days: {},
    loaded: { config: false, days: false },
    ready: false,
    status: { text: '불러오는 중…', error: false },
    rev: 0,
    // 화면 조각이 다시 그릴지 판단하는 값: 기록(days)·설정(config)이 실제로 바뀔 때만 올라감
    daysRev: 0,
    configRev: 0,
  };

  const listeners = new Set();
  const timers = new Map(); // date -> timeout (아직 저장 안 된 변경)
  const dirtyDays = new Map(); // 전송 중·실패한 변경도 서버 확인까지 보호
  const inFlight = new Map();
  let dayRevision = 0;
  let configWrite = null;
  let configDirty = false;
  let configRevision = 0;
  let statusTimer;

  function emit() {
    state.rev++;
    state.ready = state.loaded.config && state.loaded.days;
    listeners.forEach((fn) => fn(state));
  }

  function setStatus(text, error = false) {
    clearTimeout(statusTimer);
    state.status = { text, error };
    if (text && !error) {
      statusTimer = setTimeout(() => {
        state.status = { text: '', error: false };
        emit();
      }, 2200);
    }
    emit();
  }

  function saveFailed(err) {
    const code = err && err.code;
    if (code === 'quota_exceeded') setStatus('저장 공간이 가득 찼습니다. 오래된 기록을 정리해야 합니다.', true);
    else if (code === 'storage_unavailable') setStatus('이 브라우저는 저장을 막고 있습니다. 새로고침하면 기록이 사라집니다.', true);
    else setStatus('저장하지 못했습니다. 연결과 기록 권한을 확인해 주세요. 화면을 다시 열면 재시도합니다.', true);
  }

  /* ---------- 저장소에서 들어오는 값 ---------- */

  adapter.subscribe({
    onConfig(raw) {
      if (configWrite || configDirty) return;
      state.config = normalizeConfig(raw, state.config.startDate);
      state.configRev++;
      state.configSaved = !!raw;
      state.loaded.config = true;
      if (state.loaded.days && state.status.text === '불러오는 중…') state.status = { text: '', error: false };
      emit();
    },
    onDays(rawMap) {
      const next = {};
      for (const [date, raw] of Object.entries(rawMap)) if (isDateStr(date)) next[date] = normalizeDay(raw);
      // 저장 대기 중인 날은 화면의 값을 유지
      for (const date of dirtyDays.keys()) if (state.days[date]) next[date] = state.days[date];
      state.days = next;
      state.daysRev++;
      state.loaded.days = true;
      if (state.loaded.config && state.status.text === '불러오는 중…') state.status = { text: '', error: false };
      emit();
    },
    onError(err) {
      setStatus(err && err.code === 'migration_failed'
        ? '계정으로 기록을 옮기지 못했습니다. 이 브라우저의 원본은 남아 있습니다. 연결을 확인하고 새로고침해 주세요.'
        : '기록을 불러오지 못했습니다. 새로고침해 주세요.', true);
    },
  });

  /* ---------- 저장 ---------- */

  function persistConfig(force = false) {
    if (configWrite && !force) return configWrite;
    const revision = configRevision;
    const doc = serializeConfig(state.config);
    configDirty = true;
    const write = Promise.resolve().then(() => adapter.saveConfig(doc)).then(() => {
      if (revision === configRevision) {
        state.configSaved = true;
        configDirty = false;
      }
    }).finally(() => { if (configWrite === write) configWrite = null; });
    configWrite = write;
    return configWrite;
  }

  function flushDay(date) {
    timers.delete(date);
    const revision = dirtyDays.get(date);
    if (revision === undefined || inFlight.get(date) === revision) return;
    inFlight.set(date, revision);
    const doc = serializeDay(date, state.days[date] || { entries: {} });
    // 첫 설정의 서버 응답을 기다리지 않고 날짜 기록도 오프라인 큐에 보냄.
    const pending = adapter.synced ? setTimeout(() => {
      if (dirtyDays.has(date) && !state.status.error) {
        state.status = { text: '서버 동기화를 기다리고 있습니다. 연결되면 자동으로 저장됩니다.', error: false };
        emit();
      }
    }, 4000) : null;
    Promise.resolve()
      .then(() => Promise.all([state.configSaved ? null : persistConfig(), adapter.saveDay(date, doc)]))
      .then(() => {
        if (dirtyDays.get(date) === revision) dirtyDays.delete(date);
        if (!dirtyDays.size) setStatus(''); // 정상 저장은 아무 문구도 남기지 않음(느린 저장·실패만 보임)
      })
      .catch(saveFailed)
      .finally(() => {
        clearTimeout(pending);
        if (inFlight.get(date) === revision) inFlight.delete(date);
      });
  }

  function scheduleSave(date) {
    clearTimeout(statusTimer);
    clearTimeout(timers.get(date));
    dirtyDays.set(date, ++dayRevision);
    timers.set(date, setTimeout(() => flushDay(date), SAVE_DELAY));
    if (!state.status.error) state.status = { text: '', error: false };
  }

  // 페이지를 닫기 직전 대기 중인 저장을 바로 보냄
  function flushAll() {
    if (configDirty && !configWrite) persistConfig().then(() => {
      if (!dirtyDays.size) setStatus('');
    }).catch(saveFailed);
    for (const date of dirtyDays.keys()) {
      clearTimeout(timers.get(date));
      flushDay(date);
    }
  }

  /* ---------- 계산 도우미 ---------- */

  function resolver() {
    return createTargetResolver(state.config, state.days, state.today);
  }

  function activeExercises() {
    return state.config.exercises.filter((e) => e.active);
  }

  /** 선택한 날의 종목 상태 (완료했으면 그때 목표를 그대로 보여줌) */
  function view(date, ex, res = resolver(), { aggregate = false } = {}) {
    const day = state.days[date];
    const entries = !aggregate && date === state.today && date === state.selected && day?.rounds?.length
      ? day.activeEntries || {} : day?.entries || {};
    const level = (day && day.level) || 'normal';
    return entryView(entries[ex.id], ex, plannedTarget(res.targetForDate(ex, date), level, ex.unit), level);
  }

  const findExercise = (id) => state.config.exercises.find((e) => e.id === id);

  function ensureDay(date) {
    if (!state.days[date]) state.days[date] = { entries: {} };
    return state.days[date];
  }

  function ensureEntry(date, id) {
    const day = ensureDay(date);
    const box = day.rounds?.length && date === state.today ? day.activeEntries : day.entries;
    if (!box[id]) box[id] = { done: false };
    return box[id];
  }

  /** 사용 중인 종목을 모두 마쳤는지 (휴식·완료 효과음·종료 버튼 강조의 기준) */
  function allDone(date = state.selected) {
    const res = resolver();
    const exs = activeExercises();
    return exs.length > 0 && exs.every((e) => view(date, e, res).done);
  }

  /** 회차 종료 여부는 목표 완료와 별개로 관리합니다. 예전 전체 완료 기록도 종료로 간주합니다. */
  function isSessionClosed(date = state.selected) {
    return !!state.days[date]?.sessionClosed || allDone(date);
  }

  /** 그날 체크한 세트·완료가 하나라도 있는지 */
  function hasProgress(date, { current = false } = {}) {
    const day = state.days[date];
    if (!day) return false;
    return hasChecks(current && date === state.today && day.rounds?.length ? day.activeEntries : day.entries);
  }

  /** 세션별 운동을 하루 기록으로 합산: 달성·연속·목표 집계는 기존과 동일하게 일 단위로 계산합니다. */
  function updateAggregate(date) {
    const day = state.days[date];
    if (!day?.rounds?.length || date !== state.today) return;
    day.entries = mergeRounds(day);
  }

  /** 세트 기록을 남길 회차: 오늘은 지금 회차, 회차가 나뉜 지난 날은 어느 회차인지 알 수 없어 남기지 않음(null) */
  function roundOf(date) {
    const n = state.days[date]?.rounds?.length || 0;
    if (!n) return 0;
    return date === state.today ? n : null;
  }

  /** 체크 상태가 바뀐 종목의 세트 기록을 맞춤: 마친 세트 수만큼, 새 세트는 지금 세트당 개수로 */
  function logSets(date, id) {
    const r = roundOf(date);
    const ex = findExercise(id);
    if (r === null || !ex) return;
    const v = view(date, ex);
    const day = ensureDay(date);
    const log = syncSets(day.log, id, r, v.done ? v.sets : v.setsDone, v.count, Date.now());
    if (log.length) day.log = log;
    else delete day.log;
  }

  /** 그날 기록을 바꾼 뒤: 저장 예약 + 화면 갱신 */
  function commitDay(date) {
    updateAggregate(date);
    scheduleSave(date);
    state.daysRev++;
    emit();
  }

  /* ---------- 동작 ---------- */

  const actions = {
    /** 운동시간 종료 또는 전체 종목 완료 시 현 회차 종료. 세트 기록은 변경하지 않습니다. */
    closeSession() {
      if (!state.ready || state.selected !== state.today || isSessionClosed()) return false;
      ensureDay(state.today).sessionClosed = true;
      commitDay(state.today);
      return true;
    },

    /** 오늘 운동을 한 차례 더 시작: 이전 회차는 보존하고 새 세트 체크만 비웁니다. */
    startAnotherSession() {
      if (!state.ready || state.selected !== state.today || !isSessionClosed()) return false;
      const day = ensureDay(state.today);
      if ((day.rounds?.length || 0) >= MAX_SESSIONS - 1) return false;
      const snapshot = day.rounds?.length ? day.activeEntries || {} : day.entries;
      day.rounds = [...(day.rounds || []), { entries: JSON.parse(JSON.stringify(snapshot)) }];
      day.activeEntries = {};
      delete day.sessionClosed;
      commitDay(state.today);
      return true;
    },

    toggle(id) {
      if (!state.ready) return;
      const ex = findExercise(id);
      if (!ex) return;
      const date = state.selected;
      const v = view(date, ex);
      const entry = ensureEntry(date, id);
      if (v.done) markUndone(entry, v, ex);
      else markDone(entry, v);
      logSets(date, id);
      commitDay(date);
    },

    /** 세트를 n개까지 마쳤다고 체크(0~세트 수). 모두 마치면 종목 완료, 아니면 진행 중 */
    setProgress(id, n) {
      if (!state.ready || !Number.isFinite(n)) return;
      const ex = findExercise(id);
      if (!ex) return;
      const date = state.selected;
      const v = view(date, ex);
      const k = Math.max(0, Math.min(v.sets, Math.round(n)));
      markProgress(ensureEntry(date, id), v, k);
      logSets(date, id);
      commitDay(date);
    },

    setCount(id, n) {
      if (!state.ready) return;
      const ex = findExercise(id);
      if (!ex || !Number.isFinite(n)) return emit();
      const date = state.selected;
      const entry = ensureEntry(date, id);
      entry.count = Math.max(LIMITS.count[0], Math.min(LIMITS.count[1], Math.round(n)));
      // 마친 종목의 개수를 고치면 그 회차 세트 기록도 같이 고침(진행 중이면 다음 세트부터 새 개수)
      const r = roundOf(date);
      const day = state.days[date];
      if (entry.done && r !== null && day.log) day.log = setSetCount(day.log, id, r, entry.count);
      commitDay(date);
    },

    /** 그날 난이도(easy/normal/hard). 아직 완료하지 않은 종목의 목표가 바뀜 */
    setLevel(level) {
      if (!state.ready || !LEVELS[level]) return;
      const date = state.selected;
      const day = ensureDay(date);
      if ((day.level || 'normal') === level) return;
      if (level === 'normal') delete day.level;
      else day.level = level;
      // 아직 마치지 않은 종목은 고쳐 둔 개수를 지우고 새 목표를 따라가게 함
      for (const e of Object.values(day.rounds?.length ? day.activeEntries : day.entries)) if (!e.done) delete e.count;
      commitDay(date);
    },

    /** 운동 스톱워치를 끝냈을 때: 그날 총 운동시간(초)에 더하고, 시작·종료 시각(ms)이 있으면 운동 구간으로 남김 */
    addWorkSec(date, sec, span = null) {
      if (!state.ready || !isDateStr(date) || !Number.isFinite(sec) || sec <= 0) return;
      const day = ensureDay(date);
      day.workSec = Math.min(86400, (day.workSec || 0) + Math.round(sec));
      if (span && Number.isFinite(span.s) && Number.isFinite(span.e) && span.e >= span.s) {
        day.sessions = [...(day.sessions || []), { s: span.s, e: span.e, sec: Math.round(sec) }].slice(-MAX_SESSIONS);
      }
      commitDay(date);
    },

    /** 운동을 마친 뒤 남기는 소감(feel)과 감사한 일(thanks). 입력하는 대로 저장(잠깐 모아서) */
    setNote(date, { feel = '', thanks = '' } = {}) {
      if (!state.ready || !isDateStr(date) || date > state.today) return;
      const day = ensureDay(date);
      const cut = (v) => String(v).slice(0, NOTE_MAX);
      if (String(feel).trim() || String(thanks).trim()) day.note = { feel: cut(feel), thanks: cut(thanks) };
      else delete day.note;
      commitDay(date);
    },

    /** 그날 총 운동시간을 직접 정함(초). 실제로 잰 시작·종료 시각(구간)은 그대로 둠(멈춘 시간이 빠지므로 원래도 합계와 꼭 같지 않음). 0 이하면 지움 */
    setWorkSec(date, sec) {
      if (!state.ready || !isDateStr(date) || date > state.today || !Number.isFinite(sec)) return;
      if (sec <= 0) return this.clearWorkSec(date);
      const day = ensureDay(date);
      day.workSec = Math.min(86400, Math.round(sec));
      commitDay(date);
    },

    /** 그날 기록된 총 운동시간을 지움 */
    clearWorkSec(date) {
      const day = state.days[date];
      if (!state.ready || !day || !day.workSec) return;
      delete day.workSec;
      delete day.sessions;
      commitDay(date);
    },

    /** 그날 한 세트 수를 직접 고침 */
    setSets(id, n) {
      if (!state.ready) return;
      const ex = findExercise(id);
      if (!ex || !Number.isFinite(n)) return emit();
      const date = state.selected;
      const v = view(date, ex);
      const k = Math.max(LIMITS.sets[0], Math.min(LIMITS.sets[1], Math.round(n)));
      markSets(ensureEntry(date, id), v, k);
      logSets(date, id);
      commitDay(date);
    },

    select(date) {
      if (!isDateStr(date) || date > state.today) return;
      state.selected = date;
      emit();
    },

    goToday() {
      state.selected = state.today;
      emit();
    },

    /** 자정이 지났거나 오래 열어 둔 경우 날짜 갱신 */
    refreshToday() {
      const t = todayStr();
      if (t === state.today) return;
      const wasToday = state.selected === state.today;
      state.today = t;
      state.daysRev++;
      if (wasToday) {
        state.selected = t;
      }
      emit();
    },

    async saveConfig(cfg) {
      const revision = ++configRevision;
      state.config = normalizeConfig(cfg, state.config.startDate);
      state.configSaved = false;
      configDirty = true;
      state.configRev++;
      clearTimeout(statusTimer);
      state.status = { text: '', error: false };
      emit();
      const pending = adapter.synced ? setTimeout(() => {
        if (!state.status.error && revision === configRevision) {
          state.status = { text: '서버 동기화를 기다리고 있습니다. 연결되면 자동으로 저장됩니다.', error: false };
          emit();
        }
      }, 4000) : null;
      try {
        await persistConfig(true);
        if (revision === configRevision) setStatus('');
      } catch (e) {
        saveFailed(e);
        throw e;
      } finally {
        clearTimeout(pending);
      }
    },

    flushAll,
  };

  return {
    state,
    actions,
    view,
    allDone,
    isSessionClosed,
    hasProgress,
    resolver,
    activeExercises,
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },
  };
}
