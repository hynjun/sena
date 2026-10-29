/* 엘리베이터: 바깥 기둥과 미닫이문, 1930년대 아르데코풍 내부, 버튼 50개 패널, 반원 층 표시기, 작은 창 밖 장치 */
(function (T) {
  const R = 3;
  const CAB = { x: 1.6, z0: -2.1, z1: 2.45, h: 2.8, door: 0.6, doorH: 2.2 };
  T.CAB = CAB;

  function canvasTex(w, h, draw) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    return t;
  }

  T.createElevator = function (scene, world) {
    const root = new THREE.Group();
    scene.add(root);

    const shellMat = new THREE.MeshStandardMaterial({ color: 0x2c2d31, roughness: 0.7, metalness: 0.2 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.32, metalness: 0.85 });
    const brassDark = new THREE.MeshStandardMaterial({ color: 0x8a6a2c, roughness: 0.4, metalness: 0.8 });
    const walnutTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#4a2c1a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        g.strokeStyle = `rgba(${30 + Math.random() * 40},${15 + Math.random() * 20},${8 + Math.random() * 10},${0.25 + Math.random() * 0.35})`;
        g.lineWidth = 1 + Math.random() * 3;
        const x = Math.random() * w;
        g.beginPath(); g.moveTo(x, 0);
        g.bezierCurveTo(x + (Math.random() - 0.5) * 30, h * 0.33, x + (Math.random() - 0.5) * 30, h * 0.66, x + (Math.random() - 0.5) * 20, h);
        g.stroke();
      }
      g.strokeStyle = 'rgba(201,162,74,0.55)'; g.lineWidth = 3;
      g.strokeRect(18, 18, w - 36, h - 36);
      g.beginPath(); g.moveTo(w / 2, 18); g.lineTo(18, h / 2); g.lineTo(w / 2, h - 18); g.lineTo(w - 18, h / 2); g.closePath(); g.stroke();
    });
    walnutTex.wrapS = walnutTex.wrapT = THREE.RepeatWrapping;
    const walnut = new THREE.MeshStandardMaterial({ map: walnutTex, roughness: 0.55, metalness: 0.05 });
    const floorTex = canvasTex(256, 256, (g, w, h) => {
      const n = 8, s = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#1c1a18' : '#e9e1cf'; g.fillRect(i * s, j * s, s, s); }
      g.strokeStyle = '#c9a24a'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.25, metalness: 0.1 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.8 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x3a2410, emissive: 0xffd08a, emissiveIntensity: 1.2 });

    const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || root).add(m); return m; };
    const box = (w, h, d, mat, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);

    /* 바깥: 아래쪽은 문 자리가 뚫린 기둥, 위쪽은 하늘 끝까지 이어지는 기둥 */
    const gap = Math.asin(0.64 / R);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 5.4, 48, 1, true, gap, Math.PI * 2 - gap * 2), shellMat);
    lower.position.y = 0.6; lower.castShadow = true; root.add(lower);
    const upper = add(new THREE.CylinderGeometry(R, R, 600, 40), shellMat, 0, 303.3, 0);
    const plinth = add(new THREE.CylinderGeometry(R + 0.9, R + 1.2, 0.35, 40), new THREE.MeshStandardMaterial({ color: 0x8f8c84, roughness: 0.9 }), 0, -0.05, 0);
    plinth.castShadow = false;
    box(0.08, 2.3, 0.12, brass, -0.68, 1.15, 2.98);
    box(0.08, 2.3, 0.12, brass, 0.68, 1.15, 2.98);
    box(1.44, 0.1, 0.12, brass, 0, 2.3, 2.98);

    /* 문 위: 뚫린 자리를 막는 아르데코 간판(층 번호와 이름) */
    const signCv = document.createElement('canvas'); signCv.width = 512; signCv.height = 400;
    const signTex = new THREE.CanvasTexture(signCv); signTex.anisotropy = 4;
    box(1.36, 1.06, 0.1, shellMat, 0, 2.86, 2.93);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45, metalness: 0.45, emissive: 0x2a1c08, emissiveIntensity: 0.35 }));
    sign.position.set(0, 2.86, 2.985); root.add(sign);
    box(1.44, 0.06, 0.12, brass, 0, 3.39, 2.98);
    function drawSign(i) {
      const g = signCv.getContext('2d'), w = 512, h = 400;
      g.fillStyle = '#1e1a16'; g.fillRect(0, 0, w, h);
      g.save(); g.translate(w / 2, h + 40);
      for (let k = 0; k < 19; k++) {
        const a = Math.PI + (k + 0.5) / 19 * Math.PI;
        g.fillStyle = k % 2 ? '#2d2620' : '#3a3025';
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 470, a - 0.06, a + 0.06); g.closePath(); g.fill();
      }
      g.restore();
      g.strokeStyle = '#c9a24a'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
      g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
      g.beginPath(); g.arc(w / 2, 168, 118, Math.PI, 0); g.lineTo(w / 2 + 118, 250); g.lineTo(w / 2 - 118, 250); g.closePath();
      g.fillStyle = '#efe4c8'; g.fill(); g.lineWidth = 5; g.stroke();
      g.fillStyle = '#2a1c0e'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '500 112px "IBM Plex Mono", monospace';
      g.fillText(String(i + 1), w / 2, 178);
      g.font = '500 22px "IBM Plex Mono", monospace';
      g.fillStyle = '#8a6a2c'; g.fillText('F L O O R', w / 2, 92);
      g.fillStyle = '#e8d6a8'; g.font = '500 34px "IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif';
      g.fillText(T.floorTitle(i), w / 2, 300);
      g.fillStyle = '#c9a24a';
      [[w / 2 - 150, 300], [w / 2 + 150, 300]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 8, y); g.lineTo(x, y + 8); g.lineTo(x - 8, y); g.closePath(); g.fill(); });
      g.font = '15px "IBM Plex Mono", monospace'; g.fillStyle = '#7d6a4a';
      g.fillText('THE TOWER · ' + T.FLOOR_COUNT + ' FLOORS', w / 2, 350);
      signTex.needsUpdate = true;
    }

    /* 문 옆에 걸린 그림: 플레이어가 볼 수 없는 탑의 바깥 모습을 그린 유화 */
    const paintCv = document.createElement('canvas'); paintCv.width = 256; paintCv.height = 330;
    (function paint() {
      const g = paintCv.getContext('2d'), w = 256, h = 330;
      const sky = g.createLinearGradient(0, 0, 0, h * 0.75);
      sky.addColorStop(0, '#2c3e66'); sky.addColorStop(0.55, '#c07a5a'); sky.addColorStop(1, '#f0c68a');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,236,200,0.85)'; g.beginPath(); g.arc(70, h * 0.62, 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a5a48'; g.beginPath(); g.moveTo(0, h * 0.78);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.76 + Math.sin(x * 0.05) * 6);
      g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
      g.fillStyle = '#2e3a30'; g.fillRect(0, h * 0.86, w, h * 0.14);
      const base = h * 0.84, rowH = (h * 0.74) / T.FLOOR_COUNT;
      for (let i = 0; i < T.FLOOR_COUNT; i++) {
        const sh = T.towerShape[i];
        const half = sh.r * 7.5, cx = w * 0.6 + sh.dx * 7.5;
        g.fillStyle = sh.maint ? '#b0583a' : sh.protrude ? '#4a4540' : '#3a3632';
        g.fillRect(cx - half, base - (i + 1) * rowH, half * 2, rowH - 0.6);
      }
      for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(${Math.random() * 255 | 0},${Math.random() * 200 | 0},${Math.random() * 160 | 0},0.05)`; g.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
    })();
    const paintTex = new THREE.CanvasTexture(paintCv); paintTex.anisotropy = 4;
    const pic = new THREE.Group();
    const pa = 0.62;
    pic.position.set(Math.sin(pa) * (R + 0.04), 1.65, Math.cos(pa) * (R + 0.04));
    pic.rotation.y = pa;
    root.add(pic);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.6 });
    box(0.82, 1.02, 0.06, frameMat, 0, 0, 0, pic);
    box(0.74, 0.94, 0.065, brass, 0, 0, 0.003, pic);
    const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.88), new THREE.MeshStandardMaterial({ map: paintTex, roughness: 0.85 }));
    canvasMesh.position.z = 0.04; pic.add(canvasMesh);
    const lampArm = box(0.04, 0.04, 0.18, brass, 0, 0.6, 0.09, pic);
    const lampHead = box(0.3, 0.05, 0.06, new THREE.MeshStandardMaterial({ color: 0x3a2a10, emissive: 0xffd08a, emissiveIntensity: 0.9 }), 0, 0.6, 0.19, pic);

    /* 내부 벽, 바닥, 천장 */
    const W = CAB.x * 2, D = CAB.z1 - CAB.z0, zc = (CAB.z0 + CAB.z1) / 2;
    box(W + 0.1, 0.06, D + 0.6, floorMat, 0, -0.03, zc + 0.25);
    box(W, 0.05, D, ceilMat, 0, CAB.h, zc);
    box(W, CAB.h, 0.05, walnut, 0, CAB.h / 2, CAB.z0);
    box(0.05, CAB.h, D, walnut, -CAB.x, CAB.h / 2, zc);
    box(0.05, CAB.h, D, walnut, CAB.x, CAB.h / 2, zc);
    const sideW = CAB.x - CAB.door;
    box(sideW, CAB.h, 0.05, walnut, -(CAB.door + sideW / 2), CAB.h / 2, CAB.z1);
    box(sideW, CAB.h, 0.05, walnut, CAB.door + sideW / 2, CAB.h / 2, CAB.z1);
    box(CAB.door * 2, CAB.h - CAB.doorH, 0.05, walnut, 0, (CAB.h + CAB.doorH) / 2, CAB.z1);
    /* 황동 띠와 손잡이 */
    [0.95, 2.05].forEach(y => {
      box(W - 0.02, 0.03, 0.02, brass, 0, y, CAB.z0 + 0.03);
      box(0.02, 0.03, D, brass, -CAB.x + 0.03, y, zc);
      box(0.02, 0.03, D, brass, CAB.x - 0.03, y, zc);
    });
    const rail = (len, x, z, rotY) => { const m = add(new THREE.CylinderGeometry(0.022, 0.022, len, 10), brass, x, 0.92, z); m.rotation.set(0, rotY, Math.PI / 2); };
    rail(W - 0.3, 0, CAB.z0 + 0.09, 0);
    rail(D - 0.5, -CAB.x + 0.09, zc - 0.1, Math.PI / 2);
    /* 천장 조명과 햇살 무늬 */
    add(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 32), glow, 0, CAB.h - 0.03, zc);
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2;
      const ray = box(0.03, 0.012, 0.45, brass, Math.sin(a) * 0.56, CAB.h - 0.035, zc + Math.cos(a) * 0.56);
      ray.rotation.y = a;
    }
    const light = new THREE.PointLight(0xffcf8a, 1.25, 10, 2);
    light.position.set(0, CAB.h - 0.25, zc); root.add(light);

    /* 미닫이문: 닫히면 가운데서 만나고 열리면 양옆 벽 속으로 */
    const doorTex = canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = '#7a5a26'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e2c278'; g.lineWidth = 3;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(0, 40 + i * 18); g.lineTo(w, 40 + i * 18 - 30); g.stroke(); }
      g.strokeRect(10, 10, w - 20, h - 20);
      g.beginPath(); g.arc(w / 2, h * 0.62, 26, 0, Math.PI * 2); g.stroke();
    });
    const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.35, metalness: 0.75 });
    /* 문은 앞벽 바깥면에 바짝 붙이고, 문틀보다 위·옆으로 조금씩 더 크게 해서 틈을 막는다 */
    const DW = CAB.door + 0.09, DH = CAB.doorH + 0.08, DZ = CAB.z1 + 0.05;
    const doorL = box(DW, DH, 0.04, doorMat, -DW / 2 + 0.03, DH / 2 - 0.01, DZ);
    const doorR = box(DW, DH, 0.04, doorMat, DW / 2 - 0.03, DH / 2 - 0.01, DZ + 0.042);

    /* 반원 층 표시기 */
    const dialTex = canvasTex(256, 140, (g, w, h) => {
      g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(w / 2, h - 6, 122, Math.PI, 0); g.fill();
      g.strokeStyle = '#8a6a2c'; g.lineWidth = 5; g.stroke();
      g.fillStyle = '#3a2a18'; g.font = '500 16px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let f = 0; f < 50; f++) {
        const a = Math.PI + (f / 49) * Math.PI;
        const r0 = f % 10 === 9 || f === 0 ? 92 : 104;
        g.strokeStyle = '#3a2a18'; g.lineWidth = f % 10 === 9 || f === 0 ? 2.5 : 1.2;
        g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * r0, h - 6 + Math.sin(a) * r0); g.lineTo(w / 2 + Math.cos(a) * 116, h - 6 + Math.sin(a) * 116); g.stroke();
        if (f === 0 || f % 10 === 9) g.fillText(String(f + 1), w / 2 + Math.cos(a) * 76, h - 6 + Math.sin(a) * 76);
      }
    });
    const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.306), new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.6, emissive: 0x3a2a10, emissiveIntensity: 0.25 }));
    dial.rotation.y = Math.PI; dial.position.set(0, 2.5, CAB.z1 - 0.03); root.add(dial);
    const needlePivot = new THREE.Group(); needlePivot.position.set(0, 2.5 - 0.14, CAB.z1 - 0.04); root.add(needlePivot);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.22, 0.006), new THREE.MeshStandardMaterial({ color: 0x1a1410 }));
    needle.position.y = 0.11; needlePivot.add(needle);
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), brass, 0, 0, 0, needlePivot).rotation.x = Math.PI / 2;

    /* 버튼판: 오른쪽 벽, 1층부터 50층까지 다섯 줄씩 */
    const PW = 0.42, PH = 1.0, PX = CAB.x - 0.03, PZ = CAB.z1 - 0.6, PY = 1.32;
    const plateTex = canvasTex(256, 610, (g, w, h) => {
      g.fillStyle = '#b48c3e'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e8cf8c'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#2a1c0e'; g.font = '500 13px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 50; i++) {
        const col = i % 5, row = Math.floor(i / 5);
        const u = (col - 2) * 0.072 + PW / 2, v = PH / 2 - (row - 4.5) * 0.086;
        g.fillText(String(i + 1), u / PW * w, (v - 0.04) / PH * h);
      }
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4, metalness: 0.6 }));
    plate.rotation.y = -Math.PI / 2; plate.position.set(PX, PY, PZ); root.add(plate);
    const btnGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.016, 18); btnGeo.rotateZ(Math.PI / 2);
    const buttons = [];
    for (let i = 0; i < 50; i++) {
      const col = i % 5, row = Math.floor(i / 5);
      const mat = new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.4, metalness: 0.6, emissive: 0x000000 });
      const b = new THREE.Mesh(btnGeo, mat);
      b.position.set(PX - 0.008, PY + (row - 4.5) * 0.086, PZ + (col - 2) * 0.072);
      b.userData.floor = i;
      root.add(b);
      buttons.push(b);
    }

    /* 작은 창: 왼쪽 벽 둥근 창 너머로 승강로 장치가 스쳐 지나간다 */
    const WIN = 160;
    const winCv = document.createElement('canvas'); winCv.width = winCv.height = WIN;
    const winG = winCv.getContext('2d');
    const winTex = new THREE.CanvasTexture(winCv);
    const winMesh = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), new THREE.MeshBasicMaterial({ map: winTex }));
    winMesh.rotation.y = Math.PI / 2; winMesh.position.set(-CAB.x + 0.03, 1.5, 1.2); root.add(winMesh);
    const frame = add(new THREE.TorusGeometry(0.18, 0.022, 8, 32), brass, -CAB.x + 0.035, 1.5, 1.2);
    frame.rotation.y = Math.PI / 2;
    const FLOOR_SPAN = 60;
    function drawWindow(pos, t, moving) {
      const g = winG, S = WIN;
      g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, S, S);
      const off = pos * FLOOR_SPAN;
      g.fillStyle = '#1b1c20'; g.fillRect(S * 0.08, 0, S * 0.18, S);
      g.fillStyle = '#7a4a2a'; g.fillRect(S * 0.62, 0, S * 0.1, S);
      g.fillStyle = 'rgba(255,190,140,0.25)'; g.fillRect(S * 0.645, 0, S * 0.02, S);
      g.fillStyle = '#5d3a22'; g.fillRect(S * 0.8, 0, S * 0.06, S);
      g.strokeStyle = '#444'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(S * 0.45, 0); g.lineTo(S * 0.45, S); g.moveTo(S * 0.5, 0); g.lineTo(S * 0.5, S); g.stroke();
      for (let k = -1; k < 6; k++) {
        const y = ((k * 22 + off * 2.2) % (S + 40) + S + 40) % (S + 40) - 20;
        g.fillStyle = '#26272c'; g.fillRect(0, y, S, 6);
      }
      for (let k = -1; k < 3; k++) {
        const y = ((k * 70 + off * 1.3) % (S + 80) + S + 80) % (S + 80) - 40;
        const cx = S * 0.2, r = 18;
        g.save(); g.translate(cx, y); g.rotate(off * 0.15 + k);
        g.fillStyle = '#3a3b40';
        for (let tth = 0; tth < 10; tth++) { g.rotate(Math.PI / 5); g.fillRect(-3, -r - 5, 6, 8); }
        g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      const fl = Math.round(pos), dy = (pos - fl) * FLOOR_SPAN * 2.2;
      if (Math.abs(dy) < S) {
        const info = T.floorInfo(Math.max(0, Math.min(49, fl)));
        const col = info.kind === 'maintenance' ? '224,104,58' : info.ready ? '255,236,200' : '120,120,130';
        const y = S / 2 + dy;
        const grd = g.createLinearGradient(0, y - 24, 0, y + 24);
        grd.addColorStop(0, `rgba(${col},0)`); grd.addColorStop(0.5, `rgba(${col},${moving ? 0.85 : 0.55})`); grd.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = grd; g.fillRect(0, y - 24, S, 48);
      }
      if (!moving) { g.fillStyle = `rgba(255,190,120,${0.04 + Math.sin(t * 3) * 0.02})`; g.fillRect(0, 0, S, S); }
      winTex.needsUpdate = true;
    }

    let doorT = 0, doorTarget = 0, lastWin = -1;
    const api = {
      root, buttons, CAB,
      get doorT() { return doorT; },
      open() { doorTarget = 1; },
      close() { doorTarget = 0; },
      isOpen: () => doorT > 0.85,
      isClosed: () => doorT < 0.02,
      setBase(y) { root.position.y = y; },
      setSign(i) { drawSign(i); },
      paintingWorld(out) { return out.set(Math.sin(pa) * (R + 0.3), root.position.y + 1.65, Math.cos(pa) * (R + 0.3)); },
      inside(x, z) { return Math.abs(x) < CAB.x && z > CAB.z0 && z < CAB.z1; },
      /* 막힘 검사: null = 엘리베이터와 상관없음, false = 지나갈 수 있음, true = 막힘 */
      block(x, z, rad, kind) {
        if (Math.hypot(x, z) > R + rad + 0.01) return null;
        if (kind && kind !== 'walk') return true;
        const open = doorT > 0.85;
        if (Math.abs(x) < CAB.x - rad && z > CAB.z0 + rad && z < (open ? R + 1 : CAB.z1 - rad)) return false;
        if (open && Math.abs(x) < CAB.door - rad * 0.6 && z > CAB.z0 + rad) return false;
        return true;
      },
      setLit(fn) {
        buttons.forEach((b, i) => {
          const st = fn(i);
          b.material.emissive.set(st === 'current' ? 0xff9a3a : st === 'ready' ? 0xffd27a : 0x000000);
          b.material.emissiveIntensity = st === 'current' ? 1.4 : st === 'ready' ? 0.7 : 0;
          b.material.color.set(st === 'none' ? 0x4a3e2a : st === 'locked' ? 0x8a7a5a : 0xe8d7a8);
        });
      },
      flash(i, color) {
        const b = buttons[i]; if (!b) return;
        const prev = b.material.emissive.getHex(), prevI = b.material.emissiveIntensity;
        b.material.emissive.set(color); b.material.emissiveIntensity = 1.5;
        setTimeout(() => { b.material.emissive.set(prev); b.material.emissiveIntensity = prevI; }, 350);
      },
      highlight(i) {
        buttons.forEach((b, k) => b.scale.setScalar(k === i ? 1.25 : 1));
      },
      setIndicator(pos) {
        const a = (pos / 49) * Math.PI;
        needlePivot.rotation.z = -Math.PI / 2 + a;
      },
      update(dt, t, pos, moving) {
        doorT += (doorTarget - doorT) * Math.min(1, dt * 3.2);
        if (Math.abs(doorTarget - doorT) < 0.002) doorT = doorTarget;
        const e = doorT * doorT * (3 - 2 * doorT);
        doorL.position.x = -DW / 2 + 0.03 - e * (CAB.door + 0.05);
        doorR.position.x = DW / 2 - 0.03 + e * (CAB.door + 0.05);
        api.setIndicator(pos);
        light.intensity = 1.05 + Math.sin(t * 9.3) * 0.03;
        if (moving || t - lastWin > 0.2) { drawWindow(pos, t, moving); lastWin = t; }
      }
    };
    api.setIndicator(0);
    drawSign(0);
    return api;
  };
})(window.Tower);
