/* 조작: 키보드, 터치 버튼, 마우스 시점(화면 고정 포인터 또는 드래그), 휠 */
(function (T) {
  const input = { fwd: false, back: false, left: false, right: false, run: false, up: false, down: false, enabled: true, lastLook: 0 };
  const handlers = { action: () => {}, map: () => {}, escape: () => {}, look: () => {}, zoom: () => {}, view: () => {}, tap: () => {} };
  const keyMap = { KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', Space: 'up', KeyC: 'down' };

  function clear() { ['fwd', 'back', 'left', 'right', 'run', 'up', 'down'].forEach(k => { input[k] = false; }); }

  T.input = input;
  T.onInput = function (name, fn) { handlers[name] = fn; };
  T.setInputEnabled = function (on) {
    input.enabled = on;
    if (!on) { clear(); T.releasePointer(); }
  };
  T.releasePointer = function () {
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { }
  };

  T.bindInput = function (canvas) {
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') { handlers.escape(); return; }
      if (e.code === 'KeyM' && !e.repeat) { handlers.map(); return; }
      if (!input.enabled) return;
      if (keyMap[e.code]) { input[keyMap[e.code]] = true; e.preventDefault(); }
      if (e.code === 'KeyE' && !e.repeat) handlers.action();
      if (e.code === 'KeyV' && !e.repeat) handlers.view();
    });
    window.addEventListener('keyup', e => { if (keyMap[e.code]) input[keyMap[e.code]] = false; });
    window.addEventListener('blur', clear);

    document.querySelectorAll('.pad button').forEach(b => {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', e => { e.preventDefault(); if (input.enabled) input[k] = true; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { input[k] = false; }));
    });

    /* 마우스: 화면을 누르면 포인터가 고정되어 마우스만 움직여도 시점이 돈다. 안 되는 환경에서는 드래그로 돈다 */
    const locked = () => document.pointerLockElement === canvas;
    let dragging = null, lx = 0, ly = 0, movedSum = 0;
    canvas.addEventListener('pointerdown', e => {
      if (!input.enabled) return;
      if (e.pointerType === 'mouse' && !locked() && canvas.requestPointerLock) {
        try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { }
      }
      dragging = e.pointerId; lx = e.clientX; ly = e.clientY; movedSum = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
    });
    canvas.addEventListener('pointermove', e => {
      if (!input.enabled) return;
      if (locked() || dragging === null) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      movedSum += Math.abs(dx) + Math.abs(dy);
      handlers.look(dx, dy);
      input.lastLook = performance.now();
    });
    canvas.addEventListener('pointerup', e => {
      if (dragging !== null && movedSum < 8 && input.enabled) handlers.tap(e.clientX, e.clientY, locked());
      dragging = null;
    });
    canvas.addEventListener('pointercancel', () => { dragging = null; });
    document.addEventListener('mousemove', e => {
      if (!locked() || !input.enabled) return;
      if (e.movementX || e.movementY) { movedSum += Math.abs(e.movementX) + Math.abs(e.movementY); handlers.look(e.movementX, e.movementY); input.lastLook = performance.now(); }
    });
    document.addEventListener('pointerlockchange', () => {
      document.body.classList.toggle('locked', locked());
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (input.enabled) handlers.zoom(e.deltaY);
    }, { passive: false });
  };
})(window.Tower);
