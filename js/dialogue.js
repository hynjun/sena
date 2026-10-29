/* 대화창: 화면 아래 검은 상자에 대사가 한 글자씩 나온다. NPC가 말할 때는 글자마다 목소리 비프가 나고, 주인공 혼잣말은 조용하다.
   한 번에 최대 두 문장씩 보여 주고, 다 나오면 그대로 멈춰 있다가 '다음' 버튼(또는 E·Space·Enter)을 눌러야 넘어간다.
   사용법: Tower.dialogue.say('이름', ['대사', ...], { voice: { pitch: 220, wave: 'square', speed: 30 } }) */
(function (T) {
  const $ = id => document.getElementById(id);
  const VOICES = {
    self: { silent: true, speed: 30 },
    default: { pitch: 240, wave: 'square', speed: 32 }
  };
  const MAX_PAGE_CHARS = 72;

  /* 문장 단위로 나눠 두 문장씩 한 장으로 묶는다. 너무 긴 문장은 길이로 자른다 */
  function paginate(lines) {
    const pages = [];
    lines.forEach(line => {
      const sentences = (line.match(/[^.!?…]+[.!?…]+["'”’)]*\s*|[^.!?…]+$/g) || [line]).map(s => s.trim()).filter(Boolean);
      let cur = [];
      sentences.forEach(s => {
        while (s.length > MAX_PAGE_CHARS) {
          const cut = s.lastIndexOf(' ', MAX_PAGE_CHARS) > 20 ? s.lastIndexOf(' ', MAX_PAGE_CHARS) : MAX_PAGE_CHARS;
          if (cur.length) { pages.push(cur.join(' ')); cur = []; }
          pages.push(s.slice(0, cut).trim());
          s = s.slice(cut).trim();
        }
        const joined = cur.concat(s).join(' ');
        if (cur.length >= 2 || joined.length > MAX_PAGE_CHARS) { pages.push(cur.join(' ')); cur = []; }
        cur.push(s);
      });
      if (cur.length) pages.push(cur.join(' '));
    });
    return pages;
  }

  const D = {
    active: false,
    pages: [], page: 0, shown: 0, timer: 0, wait: 0, voice: VOICES.default, onEnd: null, onPageDone: null, beepTick: 0, hold: 0, doneFired: -1,
    say(speaker, lines, opts) {
      opts = opts || {};
      D.pages = paginate(Array.isArray(lines) ? lines : [lines]);
      D.page = 0;
      D.voice = Object.assign({}, VOICES.default, VOICES[opts.voice] || opts.voice || {});
      D.onEnd = opts.onEnd || null;
      D.onPageDone = opts.onPageDone || null;
      D.active = true;
      /* 마우스로 '다음' 버튼을 누를 수 있게 화면 고정을 푼다 */
      if (T.releasePointer) T.releasePointer();
      $('dlgName').textContent = speaker || '';
      $('dlgName').hidden = !speaker;
      $('dialogue').classList.add('on');
      startPage();
    },
    /* 넘기기: 글자가 나오는 중이면 끝까지 바로 보여 주고, 다 나왔으면 다음 장으로 */
    advance() {
      if (!D.active) return;
      const text = D.pages[D.page] || '';
      if (isPause(text) && D.shown < text.length) return;
      if (D.shown < text.length) { D.shown = text.length; render(); return; }
      D.page++;
      if (D.page >= D.pages.length) { D.close(); return; }
      startPage();
    },
    close() {
      D.active = false;
      $('dialogue').classList.remove('on');
      const fn = D.onEnd; D.onEnd = null;
      if (fn) fn();
    },
    update(dt) {
      if (!D.active) return;
      const text = D.pages[D.page] || '';
      if (D.shown >= text.length) {
        if (D.doneFired !== D.page) { D.doneFired = D.page; if (D.onPageDone) D.onPageDone(D.page, text); }
        return;
      }
      D.wait -= dt;
      while (D.wait <= 0 && D.shown < text.length) {
        const ch = text[D.shown];
        D.shown++;
        let gap = isPause(text) ? 0.42 : 1 / D.voice.speed;
        if (',·'.includes(ch)) gap += 0.09;
        if (!isPause(text) && '.!?…'.includes(ch)) gap += 0.2;
        D.wait += gap;
        if (!/[\s.,!?…·"'”’()]/.test(ch)) {
          D.beepTick++;
          if (!D.voice.silent && D.beepTick % 2 === 1 && T.audio && T.audio.beep) T.audio.beep(D.voice);
        }
      }
      render();
    }
  };

  const isPause = t => /^[.…\s]+$/.test(t);
  function startPage() {
    D.shown = 0; D.wait = isPause(D.pages[D.page] || '') ? 0.35 : 0.05; D.hold = 0;
    render();
  }
  function render() {
    const text = D.pages[D.page] || '';
    $('dlgText').textContent = text.slice(0, D.shown);
    $('dlgNext').classList.toggle('on', D.shown >= text.length);
  }

  T.dialogue = D;
})(window.Tower);
