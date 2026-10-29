/* 설정: 그래픽 품질과 소리. 이 브라우저에 기억한다 */
(function (T) {
  const KEY = 'healing-tower-settings-v1';
  T.QUALITY = {
    low: { label: '낮음', pixelRatio: 1, shadows: 0, treeRadius: 150 },
    medium: { label: '보통', pixelRatio: 1.25, shadows: 1024, treeRadius: 200 },
    high: { label: '높음', pixelRatio: 2, shadows: 2048, treeRadius: 225 }
  };
  const order = ['low', 'medium', 'high'];

  let state = { quality: 'medium', sound: true, view: 'third' };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && T.QUALITY[s.quality]) state = Object.assign(state, s); } catch (e) { }
  const listeners = [];
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } }

  T.settings = {
    get: () => state,
    quality: () => T.QUALITY[state.quality],
    onChange(fn) { listeners.push(fn); },
    cycleQuality() {
      state.quality = order[(order.indexOf(state.quality) + 1) % order.length];
      persist(); listeners.forEach(fn => fn(state));
    },
    setView(v) {
      if (state.view === v) return;
      state.view = v;
      persist(); listeners.forEach(fn => fn(state));
    },
    toggleSound() {
      state.sound = !state.sound;
      persist(); listeners.forEach(fn => fn(state));
    }
  };
})(window.Tower);
