// 앱 상태와 동작. 화면은 subscribe로 상태를 받아 그리기만 합니다.

import { LEVELS, LIMITS, UNITS } from './config.js';
import { isDateStr, todayStr } from './dates.js';
import { NOTE_MAX, normalizeConfig, normalizeDay, serializeConfig, serializeDay } from './model.js';
import { createTargetResolver } from './progression.js';

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
    else setStatus('저장하지 못했습니다. 이 페이지에 기록할 권한이 있는지 확인해 주세요.', true);
  }

  /* ---------- 저장소에서 들어오는 값 ---------- */

  adapter.subscribe({
    onConfig(raw) {
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
      for (const date of timers.keys()) if (state.days[date]) next[date] = state.days[date];
      state.days = next;
      state.daysRev++;
      state.loaded.days = true;
      if (state.loaded.config && state.status.text === '불러오는 중…') state.status = { text: '', error: false };
      emit();
    },
    onError() {
      setStatus('기록을 불러오지 못했습니다. 새로고침해 주세요.', true);
    },
  });

  /* ---------- 저장 ---------- */

  function persistConfig() {
    state.configSaved = true;
    return adapter.saveConfig(serializeConfig(state.config));
  }

  function flushDay(date) {
    timers.delete(date);
    const doc = serializeDay(date, state.days[date] || { entries: {} });
    Promise.resolve()
      .then(() => (state.configSaved ? null : persistConfig()))
      .then(() => adapter.saveDay(date, doc))
      .then(() => {
        if (!timers.size) setStatus('저장했습니다');
      })
      .catch(saveFailed);
  }

  function scheduleSave(date) {
    clearTimeout(timers.get(date));
    timers.set(date, setTimeout(() => flushDay(date), SAVE_DELAY));
    state.status = { text: '저장 중…', error: false };
  }

  // 페이지를 닫기 직전 대기 중인 저장을 바로 보냄
  function flushAll() {
    for (const [date, t] of timers) {
      clearTimeout(t);
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
  function view(date, ex, res = resolver()) {
    const e = state.days[date] && state.days[date].entries[ex.id];
    const done = !!(e && e.done);
    // 그날 난이도(쉬움 0.8 / 보통 1 / 어려움 1.2)를 곱함. 단위(개 1, 초 5)에 맞춰 반올림, 최소 한 단위
    const level = (state.days[date] && state.days[date].level) || 'normal';
    const factor = (LEVELS[level] || LEVELS.normal).factor;
    const inc = (UNITS[ex.unit] || UNITS.reps).inc;
    const base = res.targetForDate(ex, date);
    const planned = factor === 1 ? base : Math.max(inc, Math.round((base * factor) / inc) * inc);
    const target = done && Number.isFinite(e.target) ? e.target : planned;
    const count = e && Number.isFinite(e.count) ? e.count : target;
    // 직접 고친 세트 수가 있으면 그 값, 완료했는데 기록에 없으면 1(예전 기록), 아직이면 지금 설정
    const hasSets = !!(e && Number.isFinite(e.sets));
    const sets = hasSets ? e.sets : done ? 1 : ex.sets;
    // 세트별 체크: 완료한 종목은 전부, 아니면 체크한 세트 수(세트 수보다 많을 수 없음)
    const setsDone = done ? sets : Math.min(sets, (e && e.setsDone) || 0);
    return { done, target, count, sets, setsDone, setsKnown: hasSets || !done, level };
  }

  function ensureEntry(date, id) {
    if (!state.days[date]) state.days[date] = { entries: {} };
    const day = state.days[date];
    if (!day.entries[id]) day.entries[id] = { done: false };
    return day.entries[id];
  }

  /* ---------- 동작 ---------- */

  const actions = {
    toggle(id) {
      if (!state.ready) return;
      const ex = state.config.exercises.find((e) => e.id === id);
      if (!ex) return;
      const date = state.selected;
      const v = view(date, ex);
      const entry = ensureEntry(date, id);
      delete entry.setsDone;
      if (v.done) {
        entry.done = false;
        if (entry.count === entry.target) delete entry.count; // 목표 그대로 했던 개수는 다시 목표(난이도)를 따라가게
        delete entry.target;
        delete entry.sets;
      } else {
        entry.done = true;
        entry.count = v.count;
        entry.target = v.target;
        entry.sets = v.sets;
      }
      scheduleSave(date);
      state.daysRev++;
      emit();
    },

    /** 세트를 n개까지 마쳤다고 체크(0~세트 수). 모두 마치면 종목 완료, 아니면 진행 중 */
    setProgress(id, n) {
      if (!state.ready || !Number.isFinite(n)) return;
      const ex = state.config.exercises.find((e) => e.id === id);
      if (!ex) return;
      const date = state.selected;
      const v = view(date, ex);
      const k = Math.max(0, Math.min(v.sets, Math.round(n)));
      const entry = ensureEntry(date, id);
      if (k >= v.sets) {
        entry.done = true;
        entry.count = v.count;
        entry.target = v.target;
        entry.sets = v.sets;
        delete entry.setsDone;
      } else {
        if (entry.done) {
          entry.done = false;
          delete entry.target;
          delete entry.sets;
        }
        if (k > 0) entry.setsDone = k;
        else delete entry.setsDone;
      }
      scheduleSave(date);
      state.daysRev++;
      emit();
    },

    setCount(id, n) {
      if (!state.ready) return;
      const ex = state.config.exercises.find((e) => e.id === id);
      if (!ex || !Number.isFinite(n)) return emit();
      const entry = ensureEntry(state.selected, id);
      entry.count = Math.max(LIMITS.count[0], Math.min(LIMITS.count[1], Math.round(n)));
      scheduleSave(state.selected);
      state.daysRev++;
      emit();
    },

    /** 그날 난이도(easy/normal/hard). 아직 완료하지 않은 종목의 목표가 바뀜 */
    setLevel(level) {
      if (!state.ready || !LEVELS[level]) return;
      const date = state.selected;
      if (!state.days[date]) state.days[date] = { entries: {} };
      const day = state.days[date];
      if ((day.level || 'normal') === level) return;
      if (level === 'normal') delete day.level;
      else day.level = level;
      // 아직 마치지 않은 종목은 고쳐 둔 개수를 지우고 새 목표를 따라가게 함
      for (const e of Object.values(day.entries)) if (!e.done) delete e.count;
      scheduleSave(date);
      state.daysRev++;
      emit();
    },

    /** 운동 스톱워치를 끝냈을 때: 그날 총 운동시간(초)에 더함 */
    addWorkSec(date, sec) {
      if (!state.ready || !isDateStr(date) || !Number.isFinite(sec) || sec <= 0) return;
      if (!state.days[date]) state.days[date] = { entries: {} };
      const day = state.days[date];
      day.workSec = Math.min(86400, (day.workSec || 0) + Math.round(sec));
      scheduleSave(date);
      state.daysRev++;
      emit();
    },

    /** 운동을 마친 뒤 남기는 소감(feel)과 감사한 일(thanks). 입력하는 대로 저장(잠깐 모아서) */
    setNote(date, { feel = '', thanks = '' } = {}) {
      if (!state.ready || !isDateStr(date) || date > state.today) return;
      if (!state.days[date]) state.days[date] = { entries: {} };
      const day = state.days[date];
      const cut = (v) => String(v).slice(0, NOTE_MAX);
      if (String(feel).trim() || String(thanks).trim()) day.note = { feel: cut(feel), thanks: cut(thanks) };
      else delete day.note;
      scheduleSave(date);
      state.daysRev++;
      emit();
    },

    /** 그날 기록된 총 운동시간을 지움 */
    clearWorkSec(date) {
      const day = state.days[date];
      if (!state.ready || !day || !day.workSec) return;
      delete day.workSec;
      scheduleSave(date);
      state.daysRev++;
      emit();
    },

    /** 그날 한 세트 수를 직접 고침 */
    setSets(id, n) {
      if (!state.ready) return;
      const ex = state.config.exercises.find((e) => e.id === id);
      if (!ex || !Number.isFinite(n)) return emit();
      const entry = ensureEntry(state.selected, id);
      entry.sets = Math.max(LIMITS.sets[0], Math.min(LIMITS.sets[1], Math.round(n)));
      scheduleSave(state.selected);
      state.daysRev++;
      emit();
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
      if (wasToday) state.selected = t;
      emit();
    },

    async saveConfig(cfg) {
      state.config = normalizeConfig(cfg, state.config.startDate);
      state.configRev++;
      emit();
      try {
        await persistConfig();
        setStatus('설정을 저장했습니다');
      } catch (e) {
        saveFailed(e);
        throw e;
      }
    },

    flushAll,
  };

  return {
    state,
    actions,
    view,
    resolver,
    activeExercises,
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },
  };
}
