/* 화면 표시: 층 카드, 상태, 알림, 행동 버튼, 타워 미니맵 */
(function (T) {
  const $ = id => document.getElementById(id);
  let toastTimer = 0, capTimer = 0;

  T.hud = {
    toast(msg, ms) {
      const el = $('toast');
      el.textContent = msg;
      el.classList.remove('off');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.add('off'), ms || 2600);
    },
    caption(label, main, sub, ms) {
      const el = $('caption');
      el.innerHTML = '';
      const add = (cls, txt) => { if (!txt) return; const d = document.createElement('div'); d.className = cls; d.textContent = txt; el.appendChild(d); };
      add('cap-label', label); add('cap-main', main); add('cap-sub', sub);
      el.classList.add('on');
      clearTimeout(capTimer);
      capTimer = setTimeout(() => el.classList.remove('on'), ms || 3600);
    },
    crosshair(on) { $('cross').classList.toggle('on', on); },
    setMode(text) { const el = $('mode'); if (el.textContent !== text) el.textContent = text; },
    setAction(text) { const el = $('action'); if (el.textContent !== text) el.textContent = text; },
    setFloor(i) {
      const f = T.floorInfo(i);
      $('floorTag').textContent = T.floorLabel(i) + (f.tag ? ' · ' + f.tag : '');
      $('floorName').textContent = T.floorTitle(i);
      $('miniHere').innerHTML = '현재 <b>' + T.floorLabel(i) + '</b> ' + T.floorTitle(i);
      T.hud.drawMinimap(i);
    },
    drawMinimap(current) {
      const svg = $('mini');
      const N = T.FLOOR_COUNT, rowH = 4.2, W = 136, H = N * rowH + 4, cx = 82;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      let out = '';
      for (let i = 0; i < N; i++) {
        const s = T.towerShape[i];
        const half = s.r * 5.6, dx = s.dx * 5.6;
        const y = H - 2 - (i + 1) * rowH;
        const cur = i === current;
        const fill = cur ? '#e0683a' : s.maint ? 'rgba(224,104,58,0.5)' : T.isOpenFloor(i) ? 'rgba(242,239,230,0.55)' : 'rgba(242,239,230,0.22)';
        out += '<rect' + (cur ? ' class="cur"' : '') + ' x="' + (cx - half + dx).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (half * 2).toFixed(1) + '" height="' + (rowH - 1.2) + '" rx="1" fill="' + fill + '"/>';
      }
      const cy = H - 2 - (current + 1) * rowH + (rowH - 1.2) / 2;
      out += '<path d="M2 ' + (cy - 4) + ' L9 ' + cy + ' L2 ' + (cy + 4) + ' Z" fill="#e0683a"/>';
      out += '<text x="12" y="' + (cy + 3.5) + '" fill="#f2efe6" font-size="10" font-family="IBM Plex Mono, monospace">' + T.floorLabel(current) + '</text>';
      svg.innerHTML = out;
    },
    fade(on, text) {
      const el = $('fade');
      if (text) $('fadeText').textContent = text;
      el.classList.toggle('on', on);
    }
  };
})(window.Tower);
