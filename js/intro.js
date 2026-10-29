/* 인트로: "시작하시겠습니까?" → 검은 수면에 물방울 동심원 → 물 아래서 떠오르는 제목 → 딩동, 엘리베이터 문이 열리며 게임 시작.
   처음 한 번은 건너뛸 수 없고, 그다음부터는 언제든 건너뛸 수 있다 */
(function (T) {
  const $ = id => document.getElementById(id);
  const KEY = 'escape-from-intro-seen';
  const LEN = 30;
  const DOOR_AT = 26.8;
  const DROPS = [[0.6, -0.42, 0.12], [2.8, 0.38, -0.16], [4.6, -0.12, -0.28], [6.0, 0.56, 0.22], [8.4, -0.6, -0.08],
    [10.5, 0.18, 0.3], [13.0, -0.3, 0.26], [15.5, 0.46, -0.3], [18.5, -0.5, -0.24], [22.0, 0.0, 0.0], [24.4, 0.3, 0.12]];

  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(KEY, '1'); } catch (e) { } }

  function titleTexture() {
    const cv = document.createElement('canvas');
    cv.width = 2048; cv.height = 512;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff';
    g.textBaseline = 'middle';
    g.font = '300 132px "Jost", "Helvetica Neue", Arial, sans-serif';
    const words = ['ESCAPE', 'FROM'];
    const track = 46, gapW = 150;
    const widthOf = w => [...w].reduce((s, ch) => s + g.measureText(ch).width + track, -track);
    const total = widthOf(words[0]) + gapW + widthOf(words[1]);
    let x = (cv.width - total) / 2;
    words.forEach((w, wi) => {
      [...w].forEach(ch => { g.fillText(ch, x, cv.height / 2); x += g.measureText(ch).width + track; });
      x += gapW - track;
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    return { tex, aspect: cv.width / cv.height };
  }

  function play(opts) {
    const root = $('intro'), prompt = $('introPrompt'), skipBtn = $('introSkip');
    const MUSIC = 'assets/escape-from-intro.mp3';
    let music = null;
    if (T.audio && T.audio.preload) T.audio.preload(MUSIC).catch(() => {});
    const canSkip = seen();
    try { if (document.fonts) document.fonts.load('300 132px "Jost"'); } catch (e) { }
    root.hidden = false;
    let renderer, scene, cam, mat, started = false, t0 = 0, raf = 0, doorsOpened = false, finished = false;
    const dropVec = Array.from({ length: 8 }, () => new THREE.Vector3(0, 0, -100));
    let nextDrop = 0;

    function setup() {
      renderer = new THREE.WebGLRenderer({ canvas: $('introCanvas'), antialias: false, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      scene = new THREE.Scene();
      cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const title = titleTexture();
      mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uDrops: { value: dropVec },
          uTitle: { value: title.tex }, uTitleAspect: { value: title.aspect },
          uRise: { value: 0 }, uFade: { value: 1 }
        },
        vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: [
          'uniform float uTime; uniform vec2 uRes; uniform vec3 uDrops[8];',
          'uniform sampler2D uTitle; uniform float uTitleAspect; uniform float uRise; uniform float uFade;',
          'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
          'void main(){',
          '  vec2 uv = gl_FragCoord.xy / uRes;',
          '  float asp = uRes.x / uRes.y;',
          '  vec2 p = (uv - 0.5) * vec2(asp, 1.0);',
          '  vec2 g = vec2(0.0); float h = 0.0;',
          '  for (int i = 0; i < 8; i++) {',
          '    vec3 d = uDrops[i]; float age = uTime - d.z;',
          '    if (age < 0.0 || age > 9.0) continue;',
          '    vec2 q = p - d.xy; float r = length(q);',
          '    for (int k = 0; k < 3; k++) {',
          '      float front = age * 0.2 - float(k) * 0.045;',
          '      if (front < 0.0) continue;',
          '      float x = r - front;',
          '      float env = exp(-x * x * 900.0) * exp(-age * 0.42) * (1.0 - float(k) * 0.3) * smoothstep(0.0, 0.12, age);',
          '      h += sin(x * 140.0) * env;',
          '      g += (q / (r + 1e-4)) * cos(x * 140.0) * 140.0 * env;',
          '    }',
          '  }',
          '  vec3 n = normalize(vec3(-g * 0.0045, 1.0));',
          '  vec3 L = normalize(vec3(-0.8, 0.55, 0.25));',
          '  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));',
          '  float spec = pow(max(dot(n, H), 0.0), 38.0);',
          '  float sheen = pow(max(dot(n, normalize(vec3(0.5, -0.3, 0.8))), 0.0), 60.0) * 0.25;',
          '  vec3 col = vec3(0.0) + vec3(0.62, 0.66, 0.72) * spec * 0.9 + vec3(0.5) * sheen;',
          '  vec2 tuv = vec2(uv.x - 0.5, (uv.y - 0.5) * (uRes.y / uRes.x) * uTitleAspect) / 0.78 + 0.5;',
          '  float dist = mix(1.0, 0.08, uRise);',
          '  tuv += g * 0.00022 * dist + vec2(sin(uv.y * 40.0 + uTime * 1.3), cos(uv.x * 30.0 + uTime * 1.1)) * 0.004 * dist;',
          '  float blur = mix(0.012, 0.0, uRise);',
          '  float a = 0.0;',
          '  a += texture2D(uTitle, tuv).a * 0.36;',
          '  a += texture2D(uTitle, tuv + vec2(blur, 0.0)).a * 0.16;',
          '  a += texture2D(uTitle, tuv - vec2(blur, 0.0)).a * 0.16;',
          '  a += texture2D(uTitle, tuv + vec2(0.0, blur * 2.0)).a * 0.16;',
          '  a += texture2D(uTitle, tuv - vec2(0.0, blur * 2.0)).a * 0.16;',
          '  if (tuv.x < 0.0 || tuv.x > 1.0 || tuv.y < 0.0 || tuv.y > 1.0) a = 0.0;',
          '  col = mix(col, vec3(0.94, 0.95, 0.96), a * smoothstep(0.0, 0.6, uRise) * (0.75 + 0.25 * uRise));',
          '  float vig = smoothstep(1.15, 0.25, length(p));',
          '  col *= vig;',
          '  col += (hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.018;',
          '  gl_FragColor = vec4(col * uFade, 1.0);',
          '}'
        ].join('\n')
      });
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
      resize();
      window.addEventListener('resize', resize);
    }
    function resize() {
      if (!renderer) return;
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      mat.uniforms.uRes.value.copy(s);
    }

    function openDoors() {
      if (doorsOpened) return;
      doorsOpened = true;
      $('introDoors').classList.add('show');
      setTimeout(() => { if (T.audio) T.audio.chime(); }, 350);
      setTimeout(() => { $('introDoors').classList.add('open'); $('introCanvas').style.opacity = '0'; }, 900);
      fadeMusic(3200);
      setTimeout(finish, 3300);
    }
    function fadeMusic(ms) { if (music) music.fade(ms); }
    function finish() {
      if (finished) return;
      finished = true;
      markSeen();
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey, true);
      root.classList.add('gone');
      setTimeout(() => { root.hidden = true; if (renderer) renderer.dispose(); }, 600);
      opts.onDone && opts.onDone();
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const t = (now - t0) / 1000;
      while (nextDrop < DROPS.length && t >= DROPS[nextDrop][0]) {
        const d = DROPS[nextDrop];
        dropVec[nextDrop % 8].set(d[1] * (window.innerWidth / window.innerHeight) * 0.8, d[2], d[0]);
        nextDrop++;
      }
      const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
      mat.uniforms.uTime.value = t;
      mat.uniforms.uRise.value = sm(8, 21, t);
      mat.uniforms.uFade.value = 1 - sm(DOOR_AT - 0.8, DOOR_AT + 0.4, t);
      renderer.render(scene, cam);
      if (t >= DOOR_AT) openDoors();
    }

    function begin() {
      if (started) return;
      started = true;
      prompt.classList.add('gone');
      if (T.audio) { T.audio.start(); music = T.audio.playTrack(MUSIC, 0.9); }
      setup();
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
      if (canSkip) skipBtn.hidden = false;
    }
    function skip() {
      if (!canSkip || !started || doorsOpened) return;
      t0 = performance.now() - DOOR_AT * 1000;
    }
    function onKey(e) {
      if (!started) { e.preventDefault(); begin(); return; }
      if (canSkip && (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); skip(); }
      e.stopPropagation();
    }
    prompt.addEventListener('click', begin);
    root.addEventListener('pointerdown', e => { if (!started && e.target !== skipBtn) begin(); });
    skipBtn.addEventListener('click', e => { e.stopPropagation(); skip(); });
    window.addEventListener('keydown', onKey, true);
  }

  T.intro = { play, seen };
})(window.Tower);
