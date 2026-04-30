/**
 * Tiny reactive store with subscribe/get/set/persist.
 */
(function() {
  'use strict';

  const STORAGE_KEY = 'police-academy-state';
  const subs = [];
  let state = loadFromStorage() || {
    auth: null,           // { id, name, role, units, token }
    currentApp: null,
    notifications: [],
    audit: [],
  };

  function loadFromStorage() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function persist() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore quota errors */ }
  }

  function get(key) {
    return key ? state[key] : state;
  }

  function set(patch) {
    state = { ...state, ...patch };
    persist();
    subs.forEach(fn => fn(state));
  }

  function subscribe(fn) {
    subs.push(fn);
    return () => {
      const i = subs.indexOf(fn);
      if (i >= 0) subs.splice(i, 1);
    };
  }

  function clear() {
    sessionStorage.removeItem(STORAGE_KEY);
    state = { auth: null, currentApp: null, notifications: [], audit: [] };
    subs.forEach(fn => fn(state));
  }

  window.Store = { get, set, subscribe, clear };
})();
