/* 저장: 마지막 층, 위치, 차 상태를 이 브라우저에 기억 */
(function (T) {
  const KEY = 'healing-tower-save-v1';
  T.save = {
    read() {
      try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
    },
    write(data) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 저장이 막힌 브라우저에서는 조용히 넘어간다 */ }
    },
    clear() {
      try { localStorage.removeItem(KEY); } catch (e) { }
    }
  };
})(window.Tower);
