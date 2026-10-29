/* 층 세계 렌더러: 층 설정을 받아 하늘, 지형, 먼 산, 바다와 파도, 폭포, 나무, 바위, 꽃, 소품, 엘리베이터를 만들고 플레이어 주변으로 이어 붙인다 */
(function (T) {
  const { hash, noise, smooth } = T;
  const ELEV_R = 3;
  T.ELEV_R = ELEV_R;
  const tmpC = new THREE.Color();

  /* 땅 색: 풀, 높은 곳, 숲 바닥, 모래, 물속 바닥, 바위(가파른 곳), 눈 */
  T.groundColor = function (floor, x, y, z, slope, forest, out) {
    const p = floor.palette;
    const n = noise(x * 0.08, z * 0.08);
    out.set(p.grassA).lerp(tmpC.set(p.grassB), n * 0.8);
    out.lerp(tmpC.set(p.high), smooth(8, 40, y) * 0.6);
    if (forest > 0) out.lerp(tmpC.set(p.forestFloor), smooth(0.3, 0.75, forest) * 0.6);
    const sandTop = floor.sandLevel != null ? floor.sandLevel : floor.water + 0.7;
    if (y < sandTop) out.lerp(tmpC.set(p.sand), smooth(sandTop, sandTop - 0.9, y));
    if (p.seabed && y < floor.water - 0.5) out.lerp(tmpC.set(p.seabed), smooth(floor.water - 0.5, floor.water - 10, y));
    out.lerp(tmpC.set(p.rock), smooth(0.55, 1.1, slope));
    if (p.snow && y > 120) out.lerp(tmpC.set(p.snow), smooth(130, 175, y + n * 12) * smooth(1.4, 0.7, slope));
    return out;
  };

  /* 위에서 내려다본 층 지도 (타워 지도 원판에 쓰임) */
  const mapCache = {};
  T.renderFloorMap = function (floor, size) {
    size = size || 256;
    const key = floor.index + ':' + size;
    if (mapCache[key]) return mapCache[key];
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size);
    const R = floor.map.radius;
    const sea = floor.sea || {};
    const c = new THREE.Color(), w = new THREE.Color(sea.shallow || 0x6aaed0), deep = new THREE.Color(sea.deep || floor.waterColor);
    const k = (2 * R) / size;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const i = (py * size + px) * 4;
        const dx = px - size / 2 + 0.5, dy = py - size / 2 + 0.5;
        if (dx * dx + dy * dy > (size / 2) * (size / 2)) { img.data[i + 3] = 0; continue; }
        const x = dx * k, z = dy * k;
        const y = floor.height(x, z);
        if (y < floor.water) {
          c.copy(w).lerp(deep, smooth(0, 12, floor.water - y));
        } else {
          const hx = floor.height(x + k, z), hz = floor.height(x, z + k);
          const slope = Math.hypot(hx - y, hz - y) / k;
          const forest = floor.trees.density(x, z);
          T.groundColor(floor, x, y, z, slope, forest, c);
          c.lerp(tmpC.set(floor.trees.leafColors[2]), smooth(0.35, 0.75, forest) * 0.5);
          const shade = ((hx - y) + (hz - y)) / k;
          c.multiplyScalar(1 - Math.max(-0.2, Math.min(0.3, shade * 0.35)));
        }
        img.data[i] = Math.min(255, c.r * 255);
        img.data[i + 1] = Math.min(255, c.g * 255);
        img.data[i + 2] = Math.min(255, c.b * 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    (floor.waterfalls || []).forEach(f => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(size / 2 + f.x / k, size / 2 + (f.zTop + f.reach * 0.5) / k, Math.max(2, size * 0.01), 0, Math.PI * 2); ctx.fill();
    });
    (floor.props || []).forEach(pr => {
      ctx.fillStyle = '#8a5a34';
      ctx.fillRect(size / 2 + pr.x / k - 2, size / 2 + pr.z / k - 2, 4, 4);
    });
    ctx.fillStyle = '#2c2d31';
    ctx.beginPath(); ctx.arc(size / 2, size / 2, Math.max(3, size * 0.014), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e0683a'; ctx.lineWidth = Math.max(1.5, size * 0.006); ctx.stroke();
    mapCache[key] = cv;
    return cv;
  };

  /* 물 셰이더: 깊이에 따라 얕은 색과 깊은 색, 너울과 큰 파도, 해안 거품, 아래에서 보면 수면 */
  function waterMaterial(sunDir) {
    return new THREE.ShaderMaterial({
      transparent: true, fog: true, side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, shallow: { value: new THREE.Color() }, deep: { value: new THREE.Color() }, sky: { value: new THREE.Color() },
        sunDir: { value: sunDir.clone() }, uSwell: { value: 0 }, uW0: { value: new THREE.Vector2(1e5, 0) }, uW1: { value: new THREE.Vector2(1e5, 0) }, uFoam: { value: 1 }
      }]),
      vertexShader: [
        '#include <fog_pars_vertex>',
        'attribute float depth;',
        'uniform float uTime; uniform float uSwell; uniform vec2 uW0; uniform vec2 uW1;',
        'varying vec3 vWorld; varying float vDepth; varying float vWave;',
        'float shoal(float d){ return (0.6 + 1.0 * smoothstep(8.0, 2.0, d)) * smoothstep(-1.4, 0.4, d); }',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  float sw = uSwell * (sin(dot(wp.xz, vec2(0.021, 0.034)) - uTime * 0.9) + 0.6 * sin(dot(wp.xz, vec2(-0.031, 0.017)) - uTime * 1.3));',
        '  float sh = shoal(depth);',
        '  float w0 = uW0.y * exp(-pow(wp.z - uW0.x, 2.0) / 200.0) * sh;',
        '  float w1 = uW1.y * exp(-pow(wp.z - uW1.x, 2.0) / 200.0) * sh;',
        '  wp.y += sw * smoothstep(-0.5, 3.0, depth) + w0 + w1;',
        '  vWave = w0 + w1; vDepth = depth; vWorld = wp.xyz;',
        '  vec4 mvPosition = viewMatrix * wp;',
        '  gl_Position = projectionMatrix * mvPosition;',
        '#include <fog_vertex>',
        '}'
      ].join('\n'),
      fragmentShader: [
        '#include <fog_pars_fragment>',
        'uniform float uTime; uniform vec3 shallow; uniform vec3 deep; uniform vec3 sky; uniform vec3 sunDir; uniform float uFoam;',
        'varying vec3 vWorld; varying float vDepth; varying float vWave;',
        'float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }',
        'void main(){',
        '  vec2 p = vWorld.xz; float t = uTime;',
        '  vec3 n = normalize(vec3(0.16*sin(p.x*0.35+t*1.3)+0.1*sin(p.x*0.9+p.y*0.6+t*2.1)+0.05*sin(p.y*1.7-t*2.7), 1.0,',
        '                          0.16*cos(p.y*0.31+t*1.1)+0.1*cos(p.y*0.8-p.x*0.5+t*1.9)+0.05*cos(p.x*1.9+t*2.3)));',
        '  vec3 v = normalize(cameraPosition - vWorld);',
        '  if (!gl_FrontFacing) {',
        '    float glint = pow(max(dot(-v, vec3(0.0, 1.0, 0.0)), 0.0), 6.0);',
        '    gl_FragColor = vec4(mix(shallow * 0.9, vec3(0.75, 0.95, 0.98), glint * 0.6), 0.88);',
        '  } else {',
        '    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);',
        '    vec3 base = mix(shallow, deep, smoothstep(0.5, 14.0, vDepth));',
        '    vec3 col = mix(base, sky, 0.06 + 0.7 * fres);',
        '    vec3 r = reflect(-v, n);',
        '    col += vec3(1.0, 0.95, 0.85) * pow(max(dot(r, sunDir), 0.0), 160.0) * 1.6;',
        '    float fn = vn(p * 0.6 + t * 0.3) * 0.6 + vn(p * 1.7 - t * 0.5) * 0.4;',
        '    float shore = smoothstep(0.9, 0.0, vDepth - vWave * 0.8) * uFoam;',
        '    float crest = smoothstep(0.55, 1.3, vWave) * uFoam;',
        '    float foam = clamp(max(shore, crest) * smoothstep(0.35, 0.7, fn + shore * 0.3), 0.0, 1.0);',
        '    col = mix(col, vec3(0.97, 0.99, 1.0), foam);',
        '    float alpha = mix(0.5, 0.94, smoothstep(0.0, 5.0, vDepth));',
        '    gl_FragColor = vec4(col, max(alpha, foam));',
        '  }',
        '#include <fog_fragment>',
        '}'
      ].join('\n')
    });
  }
  function fallMaterial(streaks, flowFreq, offset) {
    return new THREE.ShaderMaterial({
      transparent: true, fog: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uStreaks: { value: streaks }, uFlow: { value: flowFreq }, uOff: { value: offset }, uAlpha: { value: 1 } }]),
      vertexShader: [
        '#include <fog_pars_vertex>',
        'varying vec2 vUv;',
        'void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;',
        '#include <fog_vertex>',
        '}'
      ].join('\n'),
      fragmentShader: [
        '#include <fog_pars_fragment>',
        'uniform float uTime; uniform float uStreaks; uniform float uFlow; uniform float uOff; uniform float uAlpha; varying vec2 vUv;',
        'void main(){',
        '  float streak = 0.5 + 0.5 * sin(vUv.x * uStreaks + sin(vUv.x * uStreaks * 0.23 + uOff) * 3.0);',
        '  float flow = fract(vUv.y * uFlow + uTime * 1.5 + streak * 0.45 + uOff);',
        '  float n = smoothstep(0.15, 0.95, flow) * (0.55 + 0.45 * streak);',
        '  vec3 col = mix(vec3(0.66, 0.8, 0.88), vec3(1.0), n * 0.7 + (1.0 - vUv.y) * 0.3);',
        '  float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);',
        '  gl_FragColor = vec4(col, uAlpha * edge * (0.62 + 0.33 * n));',
        '#include <fog_fragment>',
        '}'
      ].join('\n')
    });
  }

  function softDot() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }
  T.softDot = softDot;

  /* 여러 도형을 하나로 합치기 (인덱스 없는 형태로) */
  T.mergeGeometries = function (list) {
    const pos = [], nor = [];
    list.forEach(g => {
      const ng = g.index ? g.toNonIndexed() : g;
      ng.computeVertexNormals();
      pos.push(...ng.attributes.position.array);
      nor.push(...ng.attributes.normal.array);
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return out;
  };

  /* 야자수: 휘어진 줄기, 늘어진 잎 여덟 장 */
  function palmTrunkGeometry() {
    const g = new THREE.CylinderGeometry(0.17, 0.3, 7, 7, 10);
    g.translate(0, 3.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.035 * y * y); }
    g.computeVertexNormals();
    return g;
  }
  function palmCrownGeometry() {
    const pos = [];
    const top = new THREE.Vector3(0.035 * 49, 7, 0);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + (k % 2) * 0.2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const L = 3.2 + (k % 3) * 0.3, SEG = 5;
      const pts = [];
      for (let j = 0; j <= SEG; j++) {
        const l = j / SEG * L;
        const w = Math.sin(Math.PI * Math.min(1, j / SEG * 1.05)) * 0.45 + 0.02;
        const y = 0.35 * l - 0.16 * l * l;
        pts.push([l, y, w]);
      }
      for (let j = 0; j < SEG; j++) {
        const [l0, y0, w0] = pts[j], [l1, y1, w1] = pts[j + 1];
        const P = (l, y, s) => [top.x + ca * l - sa * s, top.y + y, top.z + sa * l + ca * s];
        const a0 = P(l0, y0, -w0), b0 = P(l0, y0, w0), a1 = P(l1, y1, -w1), b1 = P(l1, y1, w1);
        const mid0 = P(l0, y0 + 0.08, 0), mid1 = P(l1, y1 + 0.08, 0);
        pos.push(...a0, ...mid0, ...a1, ...mid0, ...mid1, ...a1, ...mid0, ...b0, ...mid1, ...b0, ...b1, ...mid1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  T.createWorld = function (scene) {
    const world = { floor: null, trees: [], colliders: [], dynamicColliders: [], quality: null, waterfalls: [], props: [], waves: [], underwater: false };

    /* 빛과 하늘 */
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
    sun.shadow.bias = -0.0006;
    scene.add(hemi, sun, sun.target);
    const sunDir = new THREE.Vector3(0, 1, 0);

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sunDir: { value: sunDir }, zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform vec3 sunDir; uniform vec3 zenith; uniform vec3 horizon; varying vec3 vDir;',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  float h = max(d.y, 0.0);',
        '  vec3 col = mix(horizon, zenith, pow(h, 0.6));',
        '  float s = max(dot(d, sunDir), 0.0);',
        '  col += vec3(1.0, 0.86, 0.62) * pow(s, 8.0) * 0.18;',
        '  col += vec3(1.0, 0.92, 0.75) * pow(s, 120.0) * 0.5;',
        '  col = mix(col, vec3(1.0, 0.98, 0.92), smoothstep(0.99935, 0.99965, s));',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(4500, 48, 24), skyMat);
    sky.renderOrder = -1;
    scene.add(sky);
    scene.fog = new THREE.Fog(0xffffff, 200, 2600);
    scene.background = new THREE.Color(0xffffff);

    /* 구름 */
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xc9d6e0, emissiveIntensity: 0.3, roughness: 1, flatShading: true, fog: false });
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
    const crand = T.rng(77);
    const clouds = [];
    const cloudGroup = new THREE.Group();
    scene.add(cloudGroup);
    for (let i = 0; i < 46; i++) {
      const g = new THREE.Group();
      const n = 5 + Math.floor(crand() * 5), len = 24 + crand() * 40;
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(puffGeo, cloudMat);
        const t = j / (n - 1) - 0.5;
        const r = (10 + crand() * 9) * (1 - Math.abs(t) * 0.9);
        m.scale.set(r, r * 0.6, r * 0.85);
        m.position.set(t * len * 1.6, (crand() - 0.3) * r * 0.4, (crand() - 0.5) * 12);
        g.add(m);
      }
      g.rotation.y = crand() * Math.PI;
      clouds.push({ g, bx: (crand() - 0.5) * 2400, bz: (crand() - 0.5) * 2400, y: 170 + crand() * 90 });
      cloudGroup.add(g);
    }
    const wrap = v => ((v + 1200) % 2400 + 2400) % 2400 - 1200;

    /* 지형 판: 가까운 고해상도 판과 먼 저해상도 판 */
    function makeTerrainPatch(size, seg, mat) {
      const geo = new THREE.PlaneGeometry(size, size, seg, seg);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      const base = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) { base[i * 2] = pos.getX(i); base[i * 2 + 1] = pos.getZ(i); }
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      return { geo, pos, base, mesh, size, seg, step: size / seg, h: new Float32Array(pos.count), cx: 1e9, cz: 1e9 };
    }
    const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    const near = makeTerrainPatch(600, 220, terrainMat);
    const farMat = terrainMat.clone();
    farMat.polygonOffset = true; farMat.polygonOffsetFactor = 2; farMat.polygonOffsetUnits = 8;
    const far = makeTerrainPatch(3400, 136, farMat);
    terrainMat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
        .replace('#include <color_fragment>', [
          '#include <color_fragment>',
          'float gd = length(vWorldP - cameraPosition);',
          'float gn1 = fract(sin(dot(floor(vWorldP.xz * 6.0), vec2(12.9898, 78.233))) * 43758.5453);',
          'float gn2 = fract(sin(dot(floor(vWorldP.xz * 1.4), vec2(39.31, 11.73))) * 24634.63);',
          'diffuseColor.rgb *= mix(0.84 + 0.2 * gn1 + 0.08 * gn2, 1.0, smoothstep(20.0, 140.0, gd));'
        ].join('\n'));
    };
    const cc = new THREE.Color();

    function fillPatch(P, px, pz, dropInside) {
      const f = world.floor;
      P.cx = Math.round(px / P.step) * P.step;
      P.cz = Math.round(pz / P.step) * P.step;
      const N = P.seg + 1, col = P.geo.attributes.color.array;
      for (let i = 0; i < P.pos.count; i++) P.h[i] = f.height(P.base[i * 2] + P.cx, P.base[i * 2 + 1] + P.cz);
      for (let iz = 0; iz < N; iz++) {
        for (let ix = 0; ix < N; ix++) {
          const i = iz * N + ix;
          const x = P.base[i * 2] + P.cx, z = P.base[i * 2 + 1] + P.cz;
          const hL = P.h[iz * N + Math.max(0, ix - 1)], hR = P.h[iz * N + Math.min(N - 1, ix + 1)];
          const hU = P.h[Math.max(0, iz - 1) * N + ix], hD = P.h[Math.min(N - 1, iz + 1) * N + ix];
          const slope = Math.hypot(hR - hL, hD - hU) / (2 * P.step);
          let y = P.h[i];
          T.groundColor(f, x, y, z, slope, f.trees.density(x, z), cc);
          col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
          if (dropInside) y -= 1.5;
          P.pos.setXYZ(i, x, y, z);
        }
      }
      P.pos.needsUpdate = true;
      P.geo.attributes.color.needsUpdate = true;
      P.geo.computeVertexNormals();
      P.geo.computeBoundingSphere();
    }

    world.sampleHeight = function (x, z) {
      const P = near, half = P.size / 2;
      const fx = (x - P.cx + half) / P.step, fz = (z - P.cz + half) / P.step;
      const ix = Math.floor(fx), iz = Math.floor(fz);
      if (ix < 0 || iz < 0 || ix >= P.seg || iz >= P.seg) return world.floor.height(x, z);
      const N = P.seg + 1, u = fx - ix, v = fz - iz;
      const a = P.h[iz * N + ix], b = P.h[iz * N + ix + 1], c = P.h[(iz + 1) * N + ix], d = P.h[(iz + 1) * N + ix + 1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };

    /* 물: 가까운 판(깊이 정보 포함)과 그 바깥을 두르는 큰 테두리 판 */
    const waterMat = waterMaterial(sunDir);
    const WN = { size: 600, seg: 150 };
    const wGeo = new THREE.PlaneGeometry(WN.size, WN.size, WN.seg, WN.seg);
    wGeo.rotateX(-Math.PI / 2);
    const wBase = new Float32Array(wGeo.attributes.position.count * 2);
    for (let i = 0; i < wGeo.attributes.position.count; i++) { wBase[i * 2] = wGeo.attributes.position.getX(i); wBase[i * 2 + 1] = wGeo.attributes.position.getZ(i); }
    wGeo.setAttribute('depth', new THREE.BufferAttribute(new Float32Array(wGeo.attributes.position.count), 1));
    const waterNear = new THREE.Mesh(wGeo, waterMat);
    waterNear.frustumCulled = false;
    scene.add(waterNear);
    const ringGeo = (function () {
      const O = 1700, I = WN.size / 2;
      const v = [[-O, -O], [O, -O], [O, O], [-O, O], [-I, -I], [I, -I], [I, I], [-I, I]];
      const pos = [], idx = [0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4];
      v.forEach(([x, z]) => pos.push(x, 0, z));
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('depth', new THREE.Float32BufferAttribute(new Array(8).fill(60), 1));
      g.setIndex(idx);
      return g;
    })();
    const waterFar = new THREE.Mesh(ringGeo, waterMat);
    waterFar.frustumCulled = false;
    scene.add(waterFar);

    function fillWater() {
      const f = world.floor;
      const p = wGeo.attributes.position, d = wGeo.attributes.depth;
      for (let i = 0; i < p.count; i++) {
        const x = wBase[i * 2] + near.cx, z = wBase[i * 2 + 1] + near.cz;
        p.setXYZ(i, x, f.water, z);
        d.setX(i, f.water - world.sampleHeight(x, z));
      }
      p.needsUpdate = true; d.needsUpdate = true;
      wGeo.computeBoundingSphere();
      waterFar.position.set(near.cx, f.water, near.cz);
    }

    /* 파도: 셰이더와 같은 계산을 여기서도 해서 보트와 수영이 물결을 탄다 */
    const shoal = d => (0.6 + 1.0 * smooth(8, 2, d)) * smooth(-1.4, 0.4, d);
    world.surfaceAt = function (x, z, t) {
      const f = world.floor, sea = f.sea || {};
      const depth = f.water - f.height(x, z);
      let y = f.water;
      if (sea.swell) y += sea.swell * (Math.sin(x * 0.021 + z * 0.034 - t * 0.9) + 0.6 * Math.sin(-x * 0.031 + z * 0.017 - t * 1.3)) * smooth(-0.5, 3, depth);
      const sh = shoal(depth);
      world.waves.forEach(w => { y += w.amp * Math.exp(-Math.pow(z - w.s, 2) / 200) * sh; });
      return y;
    };
    let nextWave = 6;
    function updateWaves(dt, t, pz) {
      const sea = world.floor.sea || {};
      if (sea.waves) {
        nextWave -= dt;
        if (nextWave <= 0 && world.waves.length < 2) {
          world.waves.push({ s: 700, amp: 0, peak: sea.waveAmp * (0.75 + Math.random() * 0.5), crashed: false });
          nextWave = sea.waveEvery[0] + Math.random() * (sea.waveEvery[1] - sea.waveEvery[0]);
        }
      }
      world.waves.forEach(w => {
        w.s -= 13 * dt;
        w.amp = w.peak * smooth(700, 640, w.s) * smooth(-420, -300, w.s);
        if (!w.crashed && Math.abs(w.s - pz) < 6) { w.crashed = true; if (world.onWave) world.onWave(w); }
      });
      world.waves = world.waves.filter(w => w.s > -430);
      const u = waterMat.uniforms;
      u.uW0.value.set(world.waves[0] ? world.waves[0].s : 1e5, world.waves[0] ? world.waves[0].amp : 0);
      u.uW1.value.set(world.waves[1] ? world.waves[1].s : 1e5, world.waves[1] ? world.waves[1].amp : 0);
    }

    /* 나무와 바위 */
    const TREE_CAP = 2600, FLOWER_CAP = 2000, ROCK_CAP = 1200;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f37, roughness: 1, flatShading: true });
    const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    const palmLeafMat = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
    const g = (geo, x, y, z) => { geo.translate(x, y, z); return geo; };
    const parts = {
      trunk: new THREE.InstancedMesh(g(new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6), 0, 1.3, 0), trunkMat, TREE_CAP),
      pine1: new THREE.InstancedMesh(g(new THREE.ConeGeometry(1.8, 2.8, 8), 0, 2.6, 0), leafMat, TREE_CAP),
      pine2: new THREE.InstancedMesh(g(new THREE.ConeGeometry(1.35, 2.4, 8), 0, 3.9, 0), leafMat, TREE_CAP),
      pine3: new THREE.InstancedMesh(g(new THREE.ConeGeometry(0.85, 2.0, 7), 0, 5.1, 0), leafMat, TREE_CAP),
      blob1: new THREE.InstancedMesh(g(new THREE.IcosahedronGeometry(1.75, 0), 0, 3.4, 0), leafMat, TREE_CAP),
      blob2: new THREE.InstancedMesh(g(new THREE.IcosahedronGeometry(1.25, 0), 1.0, 2.9, 0.35), leafMat, TREE_CAP),
      blob3: new THREE.InstancedMesh(g(new THREE.IcosahedronGeometry(1.15, 0), -0.85, 3.2, -0.55), leafMat, TREE_CAP),
      palmT: new THREE.InstancedMesh(palmTrunkGeometry(), new THREE.MeshStandardMaterial({ color: 0x9c7a55, roughness: 1, flatShading: true }), 400),
      palmC: new THREE.InstancedMesh(palmCrownGeometry(), palmLeafMat, 400),
      rock: new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), ROCK_CAP)
    };
    Object.values(parts).forEach(m => { m.castShadow = true; m.receiveShadow = true; m.count = 0; scene.add(m); });
    const flowerMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), FLOWER_CAP);
    flowerMesh.count = 0;
    scene.add(flowerMesh);
    const dummy = new THREE.Object3D();

    function placeTree(species, x, y, z, s, rot, col, n) {
      world.trees.push({ x, z, s: species === 'palm' ? s * 0.9 : s });
      dummy.position.set(x, y - 0.1, z); dummy.rotation.set(0, rot, 0);
      dummy.scale.set(s, s * (0.9 + (Math.abs(rot * 7.3) % 1) * 0.35), s); dummy.updateMatrix();
      if (species === 'palm') {
        if (n.palm >= 400) return;
        const i = n.palm++;
        parts.palmT.setMatrixAt(i, dummy.matrix);
        parts.palmC.setMatrixAt(i, dummy.matrix); parts.palmC.setColorAt(i, col);
        return;
      }
      parts.trunk.setMatrixAt(n.trunk++, dummy.matrix);
      if (species === 'pine') {
        const i = n.pine++;
        ['pine1', 'pine2', 'pine3'].forEach((k, j) => { parts[k].setMatrixAt(i, dummy.matrix); parts[k].setColorAt(i, cc.copy(col).multiplyScalar(0.78 + j * 0.07)); });
      } else {
        const i = n.round++;
        ['blob1', 'blob2', 'blob3'].forEach((k, j) => { parts[k].setMatrixAt(i, dummy.matrix); parts[k].setColorAt(i, cc.copy(col).multiplyScalar(1 - j * 0.06)); });
      }
    }

    function fillTrees() {
      const f = world.floor, tr = f.trees, leaf = tr.leafColors.map(c => new THREE.Color(c));
      const cx = near.cx, cz = near.cz;
      world.trees = [];
      const CELL = tr.cell, R = Math.min(tr.radius, world.quality ? world.quality.treeRadius : tr.radius);
      const n = { trunk: 0, pine: 0, round: 0, palm: 0 };
      (tr.fixed || []).forEach((ft, k) => {
        if ((ft.x - cx) ** 2 + (ft.z - cz) ** 2 > R * R) return;
        placeTree(ft.species, ft.x, f.height(ft.x, ft.z), ft.z, ft.s, ft.rot, leaf[k % leaf.length], n);
      });
      for (let ix = Math.floor((cx - R) / CELL); ix <= Math.floor((cx + R) / CELL) && n.trunk < TREE_CAP; ix++) {
        for (let iz = Math.floor((cz - R) / CELL); iz <= Math.floor((cz + R) / CELL) && n.trunk < TREE_CAP; iz++) {
          const x = (ix + 0.15 + hash(ix, iz, 1) * 0.7) * CELL;
          const z = (iz + 0.15 + hash(ix, iz, 2) * 0.7) * CELL;
          if ((x - cx) ** 2 + (z - cz) ** 2 > R * R) continue;
          if (hash(ix, iz, 3) > tr.density(x, z)) continue;
          if (Math.hypot(x, z) < tr.clearAroundElevator) continue;
          const y = f.height(x, z);
          if (y < f.water + 0.6) continue;
          const slope = Math.hypot(f.height(x + 1.5, z) - y, f.height(x, z + 1.5) - y) / 1.5;
          if (slope > 0.75) continue;
          const s = 0.75 + hash(ix, iz, 4) * 0.9;
          const species = tr.species ? tr.species(y, hash(ix, iz, 5), x, z) : (hash(ix, iz, 5) < tr.pineChance(y) ? 'pine' : 'round');
          placeTree(species, x, y, z, s, hash(ix, iz, 6) * 6.283, leaf[Math.floor(hash(ix, iz, 7) * leaf.length)], n);
        }
      }
      parts.trunk.count = n.trunk;
      parts.pine1.count = parts.pine2.count = parts.pine3.count = n.pine;
      parts.blob1.count = parts.blob2.count = parts.blob3.count = n.round;
      parts.palmT.count = parts.palmC.count = n.palm;

      /* 바위 */
      let nr = 0;
      const rk = f.rocks;
      if (rk) {
        const rc = rk.colors.map(c => new THREE.Color(c));
        const RR = Math.min(R, 200);
        for (let ix = Math.floor((cx - RR) / rk.cell); ix <= Math.floor((cx + RR) / rk.cell) && nr < ROCK_CAP; ix++) {
          for (let iz = Math.floor((cz - RR) / rk.cell); iz <= Math.floor((cz + RR) / rk.cell) && nr < ROCK_CAP; iz++) {
            const x = (ix + hash(ix, iz, 61)) * rk.cell, z = (iz + hash(ix, iz, 62)) * rk.cell;
            if ((x - cx) ** 2 + (z - cz) ** 2 > RR * RR) continue;
            const y = f.height(x, z);
            if (hash(ix, iz, 63) > rk.chance(x, z, y)) continue;
            if (Math.hypot(x, z) < ELEV_R + 3) continue;
            const s = rk.size[0] + hash(ix, iz, 64) * (rk.size[1] - rk.size[0]);
            dummy.position.set(x, y - s * 0.35, z);
            dummy.rotation.set(hash(ix, iz, 65) * 3, hash(ix, iz, 66) * 6.28, hash(ix, iz, 67) * 3);
            dummy.scale.set(s * (0.8 + hash(ix, iz, 68) * 0.6), s * (0.5 + hash(ix, iz, 69) * 0.5), s * (0.8 + hash(ix, iz, 70) * 0.6));
            dummy.updateMatrix();
            parts.rock.setMatrixAt(nr, dummy.matrix);
            parts.rock.setColorAt(nr++, rc[Math.floor(hash(ix, iz, 71) * rc.length)]);
            if (s > 0.9 && y > f.water - 1.2) world.trees.push({ x, z, s: s * 1.6 });
          }
        }
      }
      parts.rock.count = nr;
      Object.values(parts).forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });

      const fl = f.flowers;
      let nf = 0;
      if (fl) {
        const fCols = fl.colors.map(c => new THREE.Color(c));
        const FC = fl.cell, FR = fl.radius;
        for (let ix = Math.floor((cx - FR) / FC); ix <= Math.floor((cx + FR) / FC) && nf < FLOWER_CAP; ix++) {
          for (let iz = Math.floor((cz - FR) / FC); iz <= Math.floor((cz + FR) / FC) && nf < FLOWER_CAP; iz++) {
            const x = (ix + hash(ix, iz, 12)) * FC, z = (iz + hash(ix, iz, 13)) * FC;
            if (hash(ix, iz, 11) > fl.chance(x, z)) continue;
            if ((x - cx) ** 2 + (z - cz) ** 2 > FR * FR) continue;
            const y = world.sampleHeight(x, z);
            if (y < f.water + 0.5 || Math.hypot(x, z) < 6) continue;
            for (let k = 0; k < 3 && nf < FLOWER_CAP; k++) {
              dummy.position.set(x + (hash(ix, iz, 20 + k) - 0.5) * 1.2, y + 0.18, z + (hash(ix, iz, 30 + k) - 0.5) * 1.2);
              dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
              flowerMesh.setMatrixAt(nf, dummy.matrix);
              flowerMesh.setColorAt(nf++, fCols[Math.floor(hash(ix, iz, 14) * fCols.length)]);
            }
          }
        }
      }
      flowerMesh.count = nf;
      flowerMesh.instanceMatrix.needsUpdate = true;
      if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
    }

    /* 엘리베이터는 elevator.js가 만들고, 여기서는 바닥 높이와 막힘 검사만 이어 준다 */
    world.elevY = 0;
    world.elevBlock = null;

    /* 폭포 */
    const fallGroup = new THREE.Group();
    scene.add(fallGroup);
    const dotTex = softDot();
    function buildWaterfalls() {
      while (fallGroup.children.length) {
        const ch = fallGroup.children.pop();
        if (ch.geometry) ch.geometry.dispose();
      }
      world.waterfalls = [];
      (world.floor.waterfalls || []).forEach(def => {
        const fallH = def.topY - def.bottomY;
        const layers = [];
        [[1, 0, 0, 1], [0.82, 3, 1.7, 0.75], [1.08, -2, 3.1, 0.45]].forEach(([wk, dz, off, alpha]) => {
          const fm = fallMaterial(def.width * 3.6, fallH / 7, off);
          fm.uniforms.uAlpha.value = alpha;
          const geo = new THREE.PlaneGeometry(def.width * wk, 1, 18, 48);
          const p = geo.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const u = p.getX(i), t = 0.5 - p.getY(i);
            const wob = Math.sin(u * 0.4 + off) * 1.2 * t;
            p.setXYZ(i, def.x + u * (1 + 0.35 * t), def.topY - fallH * t, def.zTop + (def.reach + dz) * Math.sqrt(t) + wob);
          }
          geo.computeVertexNormals();
          const ribbon = new THREE.Mesh(geo, fm);
          ribbon.renderOrder = 2;
          fallGroup.add(ribbon);
          layers.push(fm);
        });

        const cgeo = new THREE.PlaneGeometry(def.width * 0.9, def.creekLength, 1, 60);
        cgeo.rotateX(-Math.PI / 2);
        const cp = cgeo.attributes.position;
        for (let i = 0; i < cp.count; i++) {
          const z = def.zTop - def.creekLength / 2 + cp.getZ(i);
          cp.setXYZ(i, def.x + cp.getX(i), def.creekY(z), z);
        }
        cgeo.setAttribute('depth', new THREE.Float32BufferAttribute(new Array(cp.count).fill(2.5), 1));
        fallGroup.add(new THREE.Mesh(cgeo, waterMat));

        const footZ = def.zTop + def.reach;
        const foam = new THREE.Mesh(new THREE.CircleGeometry(def.width * 1.2, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
        foam.rotation.x = -Math.PI / 2;
        foam.position.set(def.x, def.bottomY + 0.08, footZ);
        fallGroup.add(foam);

        const COUNT = Math.min(520, Math.round(def.width * 13));
        const mgeo = new THREE.BufferGeometry();
        const mpos = new Float32Array(COUNT * 3), mcol = new Float32Array(COUNT * 3);
        mgeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
        mgeo.setAttribute('color', new THREE.BufferAttribute(mcol, 3));
        const mist = new THREE.Points(mgeo, new THREE.PointsMaterial({ size: Math.max(3.2, def.width * 0.38), map: dotTex, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
        mist.frustumCulled = false;
        fallGroup.add(mist);
        const seeds = [];
        for (let i = 0; i < COUNT; i++) seeds.push({ life: Math.random(), a: Math.random() * 6.283, sp: 0.5 + Math.random(), r: Math.random() });
        world.waterfalls.push({ def, layers, foam, mist, mpos, mcol, mgeo, seeds, foot: new THREE.Vector3(def.x, def.bottomY, footZ) });
      });
    }
    function animateWaterfalls(dt, t) {
      world.waterfalls.forEach(W => {
        W.layers.forEach(m => { m.uniforms.uTime.value = t; });
        W.foam.scale.setScalar(1 + Math.sin(t * 2.3) * 0.06);
        const s = W.seeds, p = W.mpos, c = W.mcol, w = W.def.width;
        for (let i = 0; i < s.length; i++) {
          const q = s[i];
          q.life += dt * 0.35 * q.sp;
          if (q.life > 1) { q.life -= 1; q.a = Math.random() * 6.283; q.r = Math.random(); }
          const L = q.life, rad = (0.25 + q.r) * w * 0.55 + L * w * 0.7;
          p[i * 3] = W.foot.x + Math.cos(q.a) * rad;
          p[i * 3 + 1] = W.foot.y + 0.5 + L * (w * 0.35 + q.r * w * 0.7);
          p[i * 3 + 2] = W.foot.z + Math.sin(q.a) * rad * 0.8;
          const b = Math.sin(L * Math.PI) * 0.55;
          c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = b;
        }
        W.mgeo.attributes.position.needsUpdate = true;
        W.mgeo.attributes.color.needsUpdate = true;
      });
    }

    /* 소품(오두막 등) */
    function buildProps() {
      world.props.forEach(pr => { scene.remove(pr.group); });
      world.props = []; world.colliders = [];
      (world.floor.props || []).forEach(def => {
        const maker = T.props && T.props[def.type];
        if (!maker) return;
        const pr = maker(def, world);
        scene.add(pr.group);
        world.props.push(pr);
        world.colliders.push(...pr.colliders);
      });
    }

    function regen(px, pz, full) {
      fillPatch(near, px, pz, false);
      if (full || Math.abs(px - far.cx) > 200 || Math.abs(pz - far.cz) > 200) fillPatch(far, px, pz, true);
      fillWater();
      fillTrees();
    }

    world.setQuality = function (q) {
      world.quality = q;
      sun.castShadow = q.shadows > 0;
      if (q.shadows > 0 && sun.shadow.mapSize.x !== q.shadows) {
        sun.shadow.mapSize.set(q.shadows, q.shadows);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
      if (world.floor) fillTrees();
    };

    function applyAir() {
      const s = world.floor.sky;
      scene.fog.color.set(s.horizon);
      scene.fog.near = s.fogNear; scene.fog.far = s.fogFar;
      scene.background.set(s.horizon);
      sky.visible = true;
      cloudGroup.visible = !!s.clouds;
    }
    world.reapplyAir = function () { if (!world.underwater) applyAir(); else { world.underwater = false; world.setUnderwater(true); } };
    world.setUnderwater = function (on) {
      if (world.underwater === on) return;
      world.underwater = on;
      if (!on) { applyAir(); return; }
      const uw = world.floor.underwater || { color: 0x1a6f86, far: 45 };
      scene.fog.color.set(uw.color);
      scene.fog.near = 0.5; scene.fog.far = uw.far;
      scene.background.set(uw.color);
      sky.visible = false;
      cloudGroup.visible = false;
    };

    world.load = function (floor, px, pz) {
      world.floor = floor;
      world.waves = [];
      world.underwater = false;
      const s = floor.sky;
      sunDir.set(s.sunDir[0], s.sunDir[1], s.sunDir[2]).normalize();
      skyMat.uniforms.zenith.value.set(s.zenith);
      skyMat.uniforms.horizon.value.set(s.horizon);
      applyAir();
      sun.color.set(s.sunColor); sun.intensity = s.sunIntensity;
      hemi.color.set(s.hemiSky); hemi.groundColor.set(s.hemiGround); hemi.intensity = s.hemiIntensity;
      const sea = floor.sea || {};
      const u = waterMat.uniforms;
      u.shallow.value.set(sea.shallow || floor.waterColor);
      u.deep.value.set(sea.deep || floor.waterColor);
      u.sky.value.set(s.horizon);
      u.sunDir.value.copy(sunDir);
      u.uSwell.value = sea.swell || 0;
      u.uFoam.value = sea.foam != null ? sea.foam : 1;
      trunkMat.color.set(floor.trees.trunkColor);
      world.elevY = floor.height(0, 3.4);
      if (world.onElevBase) world.onElevBase(world.elevY);
      regen(px, pz, true);
      buildWaterfalls();
      buildProps();
    };

    world.heightAt = (x, z) => (x * x + z * z < 3.3 * 3.3 ? world.elevY : world.floor.height(x, z));
    world.depthAt = (x, z) => world.floor.water - world.floor.height(x, z);

    /* 막힘 검사: 걷기(물은 수영 가능), 차(물 못 들어감), 보트(물에서만) */
    world.blocked = function (x, z, rad, kind) {
      kind = kind || 'walk';
      const f = world.floor;
      if (Math.hypot(x, z) > f.worldRadius) return true;
      if (world.elevBlock) {
        const e = world.elevBlock(x, z, rad, kind);
        if (e === true) return true;
        if (e === false) {
          const dc = world.dynamicColliders;
          for (let i = 0; i < dc.length; i++) { const c = dc[i], dx = c.x - x, dz = c.z - z, rr = c.r + rad; if (dx * dx + dz * dz < rr * rr) return true; }
          return false;
        }
      }
      else if (Math.hypot(x, z) < ELEV_R + rad) return true;
      const y = f.height(x, z), depth = f.water - y;
      if (kind === 'boat') {
        if (depth < 0.8) return true;
      } else {
        if (kind === 'car' && depth > 0.25) return true;
        if (kind === 'walk' && !f.swim && depth > 0.15) return true;
        if (depth < 1.2) {
          const slope = Math.hypot(f.height(x + 0.8, z) - y, f.height(x, z + 0.8) - y) / 0.8;
          if (slope > 1.25) return true;
        }
      }
      const lists = [world.colliders, world.dynamicColliders];
      for (let L = 0; L < 2; L++) {
        const cl = lists[L];
        for (let i = 0; i < cl.length; i++) {
          const c = cl[i], dx = c.x - x, dz = c.z - z, rr = c.r + rad;
          if (dx * dx + dz * dz < rr * rr) return true;
        }
      }
      if (kind === 'boat') return false;
      const tr = world.trees;
      for (let i = 0; i < tr.length; i++) {
        const t = tr[i];
        const dx = t.x - x, dz = t.z - z;
        if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
        const rr = rad + 0.32 * t.s;
        if (dx * dx + dz * dz < rr * rr) return true;
      }
      return false;
    };

    world.nearestWaterfall = function (x, z) {
      let best = Infinity;
      world.waterfalls.forEach(W => { best = Math.min(best, Math.hypot(W.foot.x - x, W.foot.z - z)); });
      return best;
    };
    world.waterfallDirection = function (x, z) {
      const W = world.waterfalls[0];
      return W ? Math.atan2(W.foot.x - x, W.foot.z - z) : 0;
    };

    let lastT = 0;
    world.update = function (tx, tz, now, camera) {
      const t = now / 1000, dt = Math.min(0.05, t - lastT || 0.016);
      lastT = t;
      if (Math.abs(tx - near.cx) > 30 || Math.abs(tz - near.cz) > 30) regen(tx, tz);
      else if (Math.abs(tx - far.cx) > 200 || Math.abs(tz - far.cz) > 200) fillPatch(far, tx, tz, true);
      const ty = Math.max(world.floor.water, world.heightAt(tx, tz));
      sun.position.set(tx + sunDir.x * 120, ty + sunDir.y * 120, tz + sunDir.z * 120);
      sun.target.position.set(tx, ty, tz);
      sky.position.copy(camera.position);
      waterMat.uniforms.uTime.value = t;
      updateWaves(dt, t, tz);
      animateWaterfalls(dt, t);
      world.props.forEach(pr => pr.update && pr.update(t, dt));
      const drift = now * 0.002;
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.g.position.set(tx + wrap(c.bx + drift - tx), c.y, tz + wrap(c.bz + drift * 0.35 - tz));
      }
    };

    return world;
  };
})(window.Tower);
