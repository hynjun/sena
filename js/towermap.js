/* 타워 지도: 흰 배경 위 3D 타워, 층을 누르면 원판이 빠져나와 그 층의 지도를 보여 준다 */
(function (T) {
  const $ = id => document.getElementById(id);
  const UP = new THREE.Vector3(0, 1, 0);
  const SLAB_H = 0.82;
  const SHOW_R = 9;

  T.createTowerMap = function (opts) {
    const overlay = $('towerMap');
    const host = $('tmCanvas');
    let ready = false, open = false, fromElevator = false;
    let renderer, scene, camera, floors = [], slabMeshes = [], raycaster, pointer;
    let sel = -1;
    const cam = { yaw: 0.75, pitch: 0.32, dist: 92, focusY: 24 };
    const camTarget = new THREE.Vector3(0, 24, 0);
    let last = 0;

    function faceTexture(i) {
      const f = T.floorInfo(i);
      const size = 256;
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const ctx = cv.getContext('2d');
      ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.closePath();
      if (f.ready) {
        ctx.save(); ctx.clip();
        ctx.drawImage(T.renderFloorMap(f, size), 0, 0);
        ctx.restore();
        if (i === opts.getCurrent()) {
          const pl = opts.getPlayer();
          const k = (size / 2) / f.map.radius;
          const px = size / 2 + pl.x * k, py = size / 2 + pl.z * k;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e0683a';
          ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.fillStyle = '#0c0c0e'; ctx.fill();
        ctx.fillStyle = '#f2efe6';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '500 30px "IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif';
        ctx.fillText('준비 중', size / 2, size / 2 + 6);
        ctx.fillStyle = '#e0683a';
        ctx.font = '16px "IBM Plex Mono", monospace';
        ctx.fillText(T.floorLabel(i), size / 2, size / 2 - 28);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.anisotropy = 4;
      return tex;
    }

    function init() {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      host.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf7f6f2);
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 0.85));
      const d = new THREE.DirectionalLight(0xffffff, 0.55);
      d.position.set(30, 60, 40);
      scene.add(d);

      const shadow = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshBasicMaterial({ color: 0xe8e5de }));
      shadow.rotation.x = -Math.PI / 2;
      scene.add(shadow);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, T.FLOOR_COUNT, 40), new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 1 }));
      core.position.y = T.FLOOR_COUNT / 2;
      scene.add(core);

      const matNormal = new THREE.MeshStandardMaterial({ color: 0x45433e, roughness: 0.85 });
      const matReady = new THREE.MeshStandardMaterial({ color: 0x6a675f, roughness: 0.85 });
      const matMaint = new THREE.MeshStandardMaterial({ color: 0x3a2317, emissive: 0xe0683a, emissiveIntensity: 0.7, roughness: 0.7 });
      const matCurrent = new THREE.MeshStandardMaterial({ color: 0xe0683a, emissive: 0xe0683a, emissiveIntensity: 0.25, roughness: 0.6 });

      for (let i = 0; i < T.FLOOR_COUNT; i++) {
        const s = T.towerShape[i];
        const base = new THREE.Vector3(s.dx, i + SLAB_H / 2, s.dz);
        const disc = new THREE.Group();
        disc.position.copy(base);
        const slab = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, s.maint ? SLAB_H * 0.6 : SLAB_H, 64), matNormal);
        slab.userData.floor = i;
        disc.add(slab);
        const face = new THREE.Mesh(new THREE.CircleGeometry(s.r * 0.95, 64), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        face.rotation.x = -Math.PI / 2;
        face.position.y = (s.maint ? SLAB_H * 0.3 : SLAB_H / 2) + 0.01;
        face.visible = false;
        disc.add(face);
        scene.add(disc);
        floors.push({ i, s, base, disc, slab, face, t: 0, tex: null, mats: { matNormal, matReady, matMaint, matCurrent } });
        slabMeshes.push(slab);
      }

      raycaster = new THREE.Raycaster();
      pointer = new THREE.Vector2();
      bindPointer();
      window.addEventListener('resize', () => { if (open) resize(); });
      ready = true;
    }

    function paintSlabs() {
      const cur = opts.getCurrent();
      floors.forEach(f => {
        const m = f.mats;
        f.slab.material = f.i === cur ? m.matCurrent : f.s.maint ? m.matMaint : T.isOpenFloor(f.i) ? m.matReady : m.matNormal;
      });
    }

    function refreshFace(f) {
      if (f.tex) f.tex.dispose();
      f.tex = faceTexture(f.i);
      f.face.material.map = f.tex;
      f.face.material.needsUpdate = true;
    }

    function select(i) {
      sel = i;
      if (i >= 0) {
        const f = floors[i];
        if (!f.tex || i === opts.getCurrent()) refreshFace(f);
      }
      updateInfo();
    }

    function updateInfo() {
      const info = $('tmInfo');
      if (sel < 0) { info.hidden = true; return; }
      info.hidden = false;
      const f = T.floorInfo(sel), cur = opts.getCurrent();
      $('tmLabel').textContent = T.floorLabel(sel) + (f.tag ? ' · ' + f.tag : '');
      $('tmName').textContent = T.floorTitle(sel);
      let status;
      if (sel === cur) status = '지금 있는 층이에요';
      else if (f.ready && !T.isUnlocked(sel)) status = '아직 열리지 않은 층이에요 · ' + (T.unlockHint ? T.unlockHint(sel) : '');
      else if (f.ready) status = fromElevator ? '이 층으로 갈 수 있어요' : '엘리베이터에서 이 층으로 갈 수 있어요';
      else if (f.kind === 'maintenance') status = '정비층 · 아직 열리지 않았어요';
      else status = '아직 만들어지지 않은 층이에요';
      $('tmStatus').textContent = status;
      $('tmGo').hidden = !(fromElevator && T.isOpenFloor(sel) && sel !== cur);
    }

    function pick(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(slabMeshes, false)[0];
      return hit ? hit.object.userData.floor : -1;
    }

    function bindPointer() {
      const el = renderer.domElement;
      let down = null, moved = 0, lastX = 0, lastY = 0;
      el.addEventListener('pointerdown', e => { down = e.pointerId; moved = 0; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture(e.pointerId); });
      el.addEventListener('pointermove', e => {
        if (down === null) {
          el.style.cursor = pick(e.clientX, e.clientY) >= 0 ? 'pointer' : 'grab';
          return;
        }
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        cam.yaw -= dx * 0.008;
        cam.pitch = Math.max(-0.1, Math.min(1.0, cam.pitch + dy * 0.005));
      });
      el.addEventListener('pointerup', e => {
        if (down === null) return;
        down = null;
        if (moved < 6) {
          const i = pick(e.clientX, e.clientY);
          select(i === sel ? -1 : i);
        }
      });
      el.addEventListener('pointercancel', () => { down = null; });
      el.addEventListener('wheel', e => {
        e.preventDefault();
        cam.dist = Math.max(45, Math.min(150, cam.dist * (1 + e.deltaY * 0.001)));
      }, { passive: false });
    }

    function resize() {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    const tmpV = new THREE.Vector3(), outPos = new THREE.Vector3(), dirH = new THREE.Vector3(), qT = new THREE.Quaternion(), qI = new THREE.Quaternion();
    function frame(now) {
      if (!open) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;

      dirH.set(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
      let selT = 0;
      const focus = tmpV.set(0, cam.focusY, 0);
      floors.forEach(f => {
        const target = f.i === sel ? 1 : 0;
        f.t += (target - f.t) * Math.min(1, dt * 6);
        if (f.t < 0.001 && target === 0) {
          f.t = 0;
          f.disc.position.copy(f.base);
          f.disc.quaternion.identity();
          f.disc.scale.setScalar(1);
          f.face.visible = false;
          return;
        }
        const e = f.t * f.t * (3 - 2 * f.t);
        outPos.copy(f.base).addScaledVector(dirH, e * (SHOW_R + 12));
        f.disc.position.copy(outPos);
        f.disc.scale.setScalar(1 + (SHOW_R / f.s.r - 1) * e);
        qT.setFromUnitVectors(UP, camera.position.clone().sub(outPos).normalize());
        f.disc.quaternion.copy(qI).slerp(qT, e * 0.92);
        f.face.visible = f.t > 0.02;
        if (f.i === sel) { selT = e; focus.lerp(outPos, e); }
      });

      camTarget.lerp(focus, Math.min(1, dt * 5));
      const dist = cam.dist + (48 - cam.dist) * selT;
      camera.position.set(
        camTarget.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist,
        camTarget.y + Math.sin(cam.pitch) * dist,
        camTarget.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist
      );
      camera.lookAt(camTarget);
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    function show(elevatorMode) {
      if (!ready) init();
      fromElevator = !!elevatorMode;
      open = true;
      overlay.hidden = false;
      $('tmHint').textContent = fromElevator ? '갈 층을 골라 주세요' : '층을 누르면 그 층의 지도가 보여요';
      paintSlabs();
      const cur = opts.getCurrent();
      refreshFace(floors[cur]);
      sel = -1;
      updateInfo();
      cam.focusY = Math.min(40, Math.max(12, cur + 6));
      camTarget.set(0, cam.focusY, 0);
      resize();
      last = performance.now();
      requestAnimationFrame(frame);
      setTimeout(() => { if (open && sel < 0) select(cur); }, 350);
    }

    function hide() {
      open = false;
      overlay.hidden = true;
      sel = -1;
      if (floors.length) floors.forEach(f => { f.t = 0; f.disc.position.copy(f.base); f.disc.quaternion.identity(); f.disc.scale.setScalar(1); f.face.visible = false; });
      opts.onClose && opts.onClose();
    }

    $('tmClose').addEventListener('click', hide);
    $('tmGo').addEventListener('click', () => { const i = sel; hide(); opts.onTravel(i); });

    return { show, hide, isOpen: () => open };
  };
})(window.Tower);
