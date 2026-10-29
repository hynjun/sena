/* 게임 본체: 세계, 플레이어, 탈것(차·보트), 물고기, 소리, 시점, 화면 표시, 타워 지도, 설정, 저장을 하나로 묶어 돌린다 */
(function (T) {
  const host = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 6000);
  const world = T.createWorld(scene);
  const player = T.createPlayer(scene);
  const vehicles = { car: T.createCar(scene), boat: T.createBoat(scene) };
  const NAMES = { car: '차', boat: '보트' };
  const fish = T.createFish(scene, world);
  const hud = T.hud;
  const input = T.input;
  const audio = T.audio;
  const veil = document.getElementById('underwater');
  const elevator = T.createElevator(scene, world);
  world.elevBlock = (x, z, r, k) => elevator.block(x, z, r, k);
  world.onElevBase = y => elevator.setBase(y);
  const npcs = [T.createNPC(scene, world, T.npcDefs.attendant)];
  const raycaster = new THREE.Raycaster();
  const LINES_MID = ['약간의 흔들림은 정상입니다.', '창밖은 신경 쓰지 않으셔도 됩니다.', '모든 층이 당신을 기다리고 있습니다.', '오늘도 충분히 좋은 하루였습니다.', '불편하신 점은 없으실 겁니다.', '곧 도착합니다.'];
  const LINES_END = ['편안한 시간 되십시오.', '필요한 것은 모두 준비되어 있습니다.', '천천히 머물다 가십시오.'];
  const pick = a => a[Math.floor(Math.random() * a.length)];

  /* yaw: 화면이 보는 방향, pitch: 위아래(3인칭에서는 카메라 높이각, 1인칭에서는 내려다보는 각) */
  const G = { unlocked: new Set([0]), floorTime: {}, ride: null, aim: -1, doorIdle: 0, floor: 0, mode: 'walk', yaw: 0, pitch: 0.3, dist: 5.5, view: T.settings.get().view, busy: false, welcomed: false, veh: vehicles.car, under: false };
  const PITCH = { third: [-0.25, 1.25], first: [-1.35, 1.35] };
  const clampPitch = () => { const r = PITCH[G.view]; G.pitch = Math.max(r[0], Math.min(r[1], G.pitch)); };
  const vname = () => NAMES[G.veh.kind];

  /* 설정 */
  const qBtn = document.getElementById('qBtn'), sBtn = document.getElementById('sBtn'), vBtn = document.getElementById('vBtn');
  let appliedQuality = null;
  function applySettings() {
    const st = T.settings.get(), q = T.settings.quality();
    if (appliedQuality !== st.quality) {
      appliedQuality = st.quality;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
      world.setQuality(q);
      resize();
    }
    G.view = st.view;
    clampPitch();
    qBtn.textContent = '그래픽 · ' + q.label;
    sBtn.textContent = st.sound ? '소리 · 켜짐' : '소리 · 꺼짐';
    sBtn.setAttribute('aria-pressed', st.sound ? 'true' : 'false');
    vBtn.textContent = '시점 · ' + (G.view === 'first' ? '1인칭' : '3인칭');
    audio.setEnabled(st.sound);
  }
  function setView(v) {
    if (v === 'third' && G.dist < 3) G.dist = 3.5;
    if (v === 'first') G.pitch = Math.min(G.pitch, 0.4);
    T.settings.setView(v);
    hud.toast(v === 'first' ? '1인칭 시점' : '3인칭 시점', 1400);
  }
  qBtn.addEventListener('click', () => { T.settings.cycleQuality(); hud.toast('그래픽 품질: ' + T.settings.quality().label); });
  sBtn.addEventListener('click', () => { T.settings.toggleSound(); if (T.settings.get().sound) audio.start(); });
  vBtn.addEventListener('click', () => setView(G.view === 'first' ? 'third' : 'first'));
  T.settings.onChange(applySettings);
  const kick = () => { if (T.settings.get().sound) audio.start(); };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);

  /* 층 불러오기 */
  function enterFloor(i, pose, vehState) {
    const f = T.floorInfo(i);
    G.floor = i;
    const sp = pose || f.spawn;
    Object.values(vehicles).forEach(v => v.hide());
    G.veh = vehicles[f.vehicle || 'car'];
    world.load(f, sp.x, sp.z);
    player.setPose(sp.x, sp.z, sp.h);
    G.yaw = sp.h;
    G.mode = 'walk';
    if (vehState && vehState.out && vehState.type === G.veh.kind) G.veh.spawn(vehState.x, vehState.z, vehState.h, false);
    fish.reload();
    audio.setAmbience(f.ambience);
    hud.setFloor(i);
    litButtons();
    npcs.forEach(n => n.placeOn(f));
    setUnder(false);
    camTarget.set(sp.x, world.heightAt(sp.x, sp.z) + 1.45, sp.z);
  }

  function travel(i) {
    if (inCab()) { pressButton(i); return; }
    const f = T.floorInfo(i);
    if (!f.ready) { hud.toast(T.floorLabel(i) + '은(는) 아직 준비 중이에요.'); return; }
    if (!G.unlocked.has(i)) { hud.toast(T.floorLabel(i) + '은(는) 아직 열리지 않았어요. ' + T.unlockHint(i) + '.'); return; }
    if (i === G.floor) return;
    G.busy = true;
    T.setInputEnabled(false);
    hud.fade(true, T.floorLabel(G.floor) + ' → ' + T.floorLabel(i) + ' · 엘리베이터 이동 중');
    setTimeout(() => {
      enterFloor(i);
      persist();
      setTimeout(() => {
        hud.fade(false);
        G.busy = false;
        T.setInputEnabled(true);
        hud.toast(T.floorLabel(i) + ' ' + f.name + '에 도착했어요.');
      }, 500);
    }, 1400);
  }

  /* 대화창: Space·Enter·대화창 클릭으로도 넘긴다 */
  window.addEventListener('keydown', e => {
    if (!T.dialogue.active || e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); T.dialogue.advance(); }
  }, true);
  document.getElementById('dlgNext').addEventListener('click', e => { e.stopPropagation(); T.dialogue.advance(); });
  const paintPos = new THREE.Vector3();
  const nearPainting = () => {
    if (G.mode !== 'walk' || player.p.swim || inCab()) return false;
    elevator.paintingWorld(paintPos);
    if (Math.hypot(paintPos.x - player.p.x, paintPos.z - player.p.z) > 2.6) return false;
    return Math.abs(T.angDiff(Math.atan2(paintPos.x - player.p.x, paintPos.z - player.p.z), G.yaw)) < 1.0;
  };
  const nearNPC = () => {
    if (G.mode !== 'walk' || player.p.swim || G.ride) return null;
    return npcs.find(n => n.distTo(player.p.x, player.p.z) < 2.6 && Math.abs(T.angDiff(Math.atan2(n.x - player.p.x, n.z - player.p.z), G.yaw)) < 1.0) || null;
  };
  function talkTo(n) {
    n.talking = true;
    const ctx = { chooseFloor: () => { if (inCab() && !G.ride) openMap(true); } };
    T.dialogue.say(n.def.name, n.lines(world.floor), {
      voice: n.def.voice,
      onEnd: () => { n.talking = false; persist(); if (n.def.afterTalk) setTimeout(() => n.def.afterTalk(ctx), 250); }
    });
  }
  function lookPainting() {
    T.dialogue.say('나', [
      '해 질 녘 들판에 서 있는 탑을 그린 그림이다. 층마다 조금씩 어긋나 있다.',
      '이 건물을 밖에서 본 적이 있었던가? 아무리 생각해도 기억이 나지 않는다.',
      '그림 아래 작은 글씨가 있다. "모두가 행복한 곳."'
    ], { voice: 'self' });
  }

  /* 층 열림: 지금 층에서 3분 이상 머물면 그다음 층이 열린다 */
  const STAY = 180;
  T.isUnlocked = i => G.unlocked.has(i);
  const nextLocked = () => { for (let i = G.floor + 1; i < T.FLOOR_COUNT; i++) { const f = T.floorInfo(i); if (f.ready) return G.unlocked.has(i) ? -1 : i; } return -1; };
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  T.unlockHint = i => {
    const prev = (() => { for (let k = i - 1; k >= 0; k--) if (T.floorInfo(k).ready) return k; return 0; })();
    const left = STAY - (G.floorTime[prev] || 0);
    return T.floorLabel(prev) + '에서 ' + (left > 0 ? fmt(left) + ' 더 머물러 주세요' : '조금만 더 머물러 주세요');
  };
  function tickStay(dt) {
    G.floorTime[G.floor] = (G.floorTime[G.floor] || 0) + dt;
    const nx = nextLocked();
    const note = document.getElementById('miniNext');
    if (nx < 0) { note.hidden = true; return; }
    const left = STAY - G.floorTime[G.floor];
    note.hidden = false;
    note.textContent = T.floorLabel(nx) + ' 열림까지 ' + fmt(left);
    if (left <= 0) {
      G.unlocked.add(nx);
      note.hidden = true;
      litButtons(); hud.drawMinimap(G.floor);
      audio.chime();
      hud.caption('안내', T.floorLabel(nx) + ' · ' + T.floorInfo(nx).name, '이제 이용하실 수 있습니다.', 4200);
      persist();
    }
  }

  /* 엘리베이터 안: 버튼, 이동, 도착 */
  const inCab = () => G.mode === 'walk' && elevator.inside(player.p.x, player.p.z);
  const firstNow = () => G.view === 'first' || inCab() || !!G.ride;
  function litButtons() {
    elevator.setLit(i => i === G.floor ? 'current' : !T.floorInfo(i).ready ? 'none' : G.unlocked.has(i) ? 'ready' : 'locked');
    elevator.setSign(G.floor);
  }
  function pressButton(i) {
    if (G.ride || i < 0) return;
    const f = T.floorInfo(i);
    if (i === G.floor) { elevator.flash(i, 0xffffff); hud.caption('안내', T.floorLabel(i) + ' · ' + f.name, '지금 계신 층입니다.', 2400); return; }
    if (!f.ready) { elevator.flash(i, 0xff4a3a); hud.caption('안내', T.floorLabel(i), '아직 준비 중인 층입니다.', 2600); return; }
    if (!G.unlocked.has(i)) { elevator.flash(i, 0xff4a3a); hud.caption('안내', T.floorLabel(i) + ' · ' + f.name, '아직 열리지 않은 층입니다. ' + T.unlockHint(i) + '.', 3600); return; }
    elevator.flash(i, 0xffffff);
    const dist = Math.abs(i - G.floor);
    G.ride = { from: G.floor, to: i, dur: Math.max(3, Math.min(15, 2.5 + dist * 0.45)), t: 0, phase: 'closing', wait: 0, swapped: false, lastInt: G.floor, said: false };
    elevator.close();
    audio.music(true);
    hud.caption(i > G.floor ? '올라갑니다' : '내려갑니다', T.floorLabel(i) + ' · ' + f.name, '문이 닫힙니다.', 3400);
  }
  function swapFloor(i) {
    const f = T.floorInfo(i);
    G.floor = i;
    Object.values(vehicles).forEach(v => v.hide());
    G.veh = vehicles[f.vehicle || 'car'];
    world.load(f, player.p.x, player.p.z);
    player.p.snap = true;
    fish.reload();
    audio.setAmbience(f.ambience);
    hud.setFloor(i);
    npcs.forEach(n => n.placeOn(f));
    setUnder(false);
  }
  function updateRide(dt) {
    const R = G.ride;
    if (!R) { elevator.update(dt, performance.now() / 1000, G.floor, false); return 0; }
    const t = performance.now() / 1000;
    let pos = R.from;
    if (R.phase === 'closing') {
      R.wait += dt;
      if (elevator.isClosed() && R.wait > 1.1) { R.phase = 'moving'; audio.moving(true); }
    } else if (R.phase === 'moving') {
      R.t += dt;
      const k = Math.min(1, R.t / R.dur), e = k * k * (3 - 2 * k);
      pos = R.from + (R.to - R.from) * e;
      const fi = Math.round(pos);
      if (fi !== R.lastInt) {
        R.lastInt = fi;
        const info = T.floorInfo(fi);
        const amb = info.ambience || {};
        audio.bleed(info.kind === 'maintenance' ? 'machine' : !info.ready ? 'hum' : amb.surf ? 'surf' : 'birds');
      }
      if (!R.swapped && k >= 0.5) { R.swapped = true; swapFloor(R.to); }
      if (!R.said && k > 0.35 && R.dur > 5) { R.said = true; hud.caption('안내', pick(LINES_MID), '', 3200); }
      if (k >= 1) {
        R.phase = 'arriving'; R.wait = 0;
        audio.moving(false); audio.chime();
        const f = T.floorInfo(R.to);
        hud.caption('도착했습니다', T.floorLabel(R.to) + ' · ' + f.name, pick(LINES_END), 4400);
        litButtons();
        elevator.open();
      }
    } else {
      pos = R.to;
      R.wait += dt;
      if (R.wait > 1.6) { audio.music(false); G.ride = null; persist(); }
    }
    if (R.phase !== 'moving') pos = R.phase === 'closing' ? R.from : R.to;
    elevator.update(dt, t, pos, R.phase === 'moving');
    return R.phase === 'moving' ? 1 : 0;
  }
  function aimButton(ndcX, ndcY) {
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    raycaster.far = 2.5;
    const hit = raycaster.intersectObjects(elevator.buttons, false)[0];
    return hit ? hit.object.userData.floor : -1;
  }

  const towerMap = T.createTowerMap({
    getCurrent: () => G.floor,
    getPlayer: () => ({ x: player.p.x, z: player.p.z }),
    onTravel: travel,
    onClose: () => { if (!G.busy) T.setInputEnabled(true); }
  });
  function openMap(fromElevator) {
    if (G.busy) return;
    if (towerMap.isOpen()) { towerMap.hide(); return; }
    T.setInputEnabled(false);
    towerMap.show(fromElevator);
  }

  /* 행동 버튼(E): 엘리베이터 > 타기/내리기 > 꺼내기 */
  const nearElevator = () => G.mode === 'walk' && !player.p.swim && !inCab() && Math.hypot(player.p.x, player.p.z) < T.ELEV_R + 3.2;
  const vehDist = () => Math.hypot(G.veh.c.x - player.p.x, G.veh.c.z - player.p.z);
  function ringSpots(cx, cz, dists, n) {
    const out = [];
    dists.forEach(d => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; out.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d]); } });
    return out;
  }

  function action() {
    if (T.dialogue.active) { T.dialogue.advance(); return; }
    if (G.busy || G.ride) return;
    const p = player.p, v = G.veh, c = v.c;
    const npc = nearNPC();
    if (inCab()) { if (G.aim >= 0) pressButton(G.aim); else if (npc) talkTo(npc); else openMap(true); return; }
    if (npc) { talkTo(npc); return; }
    if (nearPainting()) { lookPainting(); return; }
    if (G.mode === 'drive') {
      if (Math.abs(c.v) > 3) { hud.toast('조금 멈춘 뒤에 내릴 수 있어요.'); return; }
      let spot = null;
      if (v.kind === 'boat') {
        spot = ringSpots(c.x, c.z, [2.6, 3.6, 4.8], 14).find(([x, z]) => world.depthAt(x, z) < 0.5 && !world.blocked(x, z, 0.4));
        if (!spot) spot = ringSpots(c.x, c.z, [2.2], 8).find(([x, z]) => !world.blocked(x, z, 0.4));
      } else {
        const rx = Math.cos(c.h), rz = -Math.sin(c.h), fx = Math.sin(c.h), fz = Math.cos(c.h);
        spot = [[rx * 2.2, rz * 2.2], [-rx * 2.2, -rz * 2.2], [fx * 3.2, fz * 3.2], [-fx * 3.2, -fz * 3.2]].map(([dx, dz]) => [c.x + dx, c.z + dz]).find(([x, z]) => !world.blocked(x, z, 0.4));
      }
      if (!spot) { hud.toast('내릴 자리가 없어요. 조금 더 트인 곳으로 가 보세요.'); return; }
      player.setPose(spot[0], spot[1], c.h);
      c.v = 0; G.mode = 'walk';
      hud.toast(world.depthAt(spot[0], spot[1]) > 1.2 ? '보트에서 물로 뛰어들었어요. Space로 떠오르고 C로 잠수해요.' : vname() + '에서 내렸어요.');
      return;
    }
    if (nearElevator()) {
      if (!elevator.isOpen()) { elevator.open(); audio.chime(); hud.toast('문이 열렸어요. 안으로 걸어 들어가서 버튼을 눌러 보세요.'); }
      return;
    }
    if (c.out && vehDist() < 4.5) {
      G.mode = 'drive';
      hud.toast(v.kind === 'boat' ? '출발! W로 가속, S로 감속, A·D로 방향, Shift로 더 빠르게.' : '출발! W로 가속, S로 브레이크, A·D로 핸들, Shift로 더 빠르게.');
      return;
    }
    let spot;
    if (v.kind === 'boat') spot = ringSpots(p.x, p.z, [4, 6, 8, 11, 15], 16).find(([x, z]) => !world.blocked(x, z, 1.8, 'boat'));
    else {
      const rx = Math.cos(p.h), rz = -Math.sin(p.h), fx = Math.sin(p.h), fz = Math.cos(p.h);
      spot = [[rx * 3, rz * 3], [-rx * 3, -rz * 3], [fx * 4, fz * 4], [-fx * 4, -fz * 4]].map(([dx, dz]) => [p.x + dx, p.z + dz]).find(([x, z]) => !world.blocked(x, z, 1.4, 'car'));
    }
    if (!spot) { hud.toast(v.kind === 'boat' ? '보트를 띄울 물가가 없어요. 바닷가로 가 보세요.' : '차를 꺼낼 자리가 없어요. 트인 곳에서 다시 해 보세요.'); return; }
    const first = !c.out;
    const h = v.kind === 'boat' ? Math.atan2(spot[0] - p.x, spot[1] - p.z) : p.h;
    v.spawn(spot[0], spot[1], h, true);
    hud.toast(first ? vname() + '를 꺼냈어요. 가까이 가서 E를 누르면 타요.' : vname() + '를 옆으로 불렀어요.');
  }

  T.onInput('action', action);
  T.onInput('map', () => openMap(false));
  T.onInput('escape', () => { if (towerMap.isOpen()) towerMap.hide(); });
  T.onInput('look', (dx, dy) => {
    G.yaw -= dx * 0.0032;
    G.pitch += dy * 0.0026;
    clampPitch();
  });
  T.onInput('zoom', dy => {
    if (G.view === 'first') { if (dy > 0) setView('third'); return; }
    G.dist = Math.max(2.2, Math.min(14, G.dist * (1 + dy * 0.0012)));
    if (G.dist <= 2.2 && dy < 0) setView('first');
  });
  T.onInput('view', () => setView(G.view === 'first' ? 'third' : 'first'));
  T.onInput('tap', (cx, cy, locked) => {
    if (T.dialogue.active) return;
    if (!inCab() || G.ride) return;
    const r = renderer.domElement.getBoundingClientRect();
    const i = locked ? aimButton(0, 0) : aimButton(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    if (i >= 0) pressButton(i);
  });
  T.bindInput(renderer.domElement);
  document.getElementById('action').addEventListener('click', action);
  document.getElementById('miniBtn').addEventListener('click', () => openMap(false));

  world.onWave = w => {
    const d = Math.abs(world.depthAt(player.p.x, player.p.z));
    if (d < 5) audio.crash(Math.min(1, w.amp));
  };

  /* 저장 */
  function persist() {
    const c = G.veh.c;
    T.save.write({ unlocked: [...G.unlocked], floorTime: G.floorTime, npcMet: npcs[0].state.met || false, floor: G.floor, x: player.p.x, z: player.p.z, h: player.p.h, car: { type: G.veh.kind, out: c.out, x: c.x, z: c.z, h: c.h } });
  }
  setInterval(() => { if (!G.busy) persist(); }, 3000);
  window.addEventListener('pagehide', persist);

  /* 이동 중 문이 닫혀 있으면 바깥 세상을 그리지 않는다(틈으로 바깥이 비치지 않게) */
  let sealed = false;
  const sealedBg = new THREE.Color(0x0b0907);
  const INSIDE = 1;
  [elevator.root, player.root].concat(npcs.map(n => n.root)).forEach(o => o.traverse(c => c.layers.enable(INSIDE)));
  scene.children.forEach(o => { if (o.isLight) o.layers.enable(INSIDE); });
  function setSealed(on) {
    if (on) scene.background.copy(sealedBg);
    if (sealed === on) return;
    sealed = on;
    /* 닫힌 엘리베이터 안에서는 카메라가 엘리베이터·사람·빛만 그린다 */
    camera.layers.set(on ? INSIDE : 0);
    if (!on) world.reapplyAir();
  }

  /* 물속 화면 */
  function setUnder(on) {
    if (G.under === on) return;
    G.under = on;
    world.setUnderwater(on);
    veil.classList.toggle('on', on);
  }

  /* 카메라 */
  const camTarget = new THREE.Vector3(), want = new THREE.Vector3(), seat = new THREE.Vector3(), dir = new THREE.Vector3();
  function updateCamera(dt, driving) {
    const p = player.p;
    if (firstNow()) {
      const lp = -G.pitch;
      dir.set(Math.sin(G.yaw) * Math.cos(lp), Math.sin(lp), Math.cos(G.yaw) * Math.cos(lp));
      if (driving) {
        G.veh.group.localToWorld(seat.set(G.veh.kind === 'boat' ? 0.35 : 0.38, G.veh.kind === 'boat' ? 1.55 : 1.28, G.veh.kind === 'boat' ? -0.3 : -0.15));
        camera.position.copy(seat);
      } else {
        const hp = player.head();
        camera.position.set(hp.x + Math.sin(G.yaw) * 0.1, hp.y + 0.04, hp.z + Math.cos(G.yaw) * 0.1);
      }
      camTarget.copy(camera.position);
      camera.lookAt(want.copy(camera.position).add(dir));
      return;
    }
    if (driving) want.set(p.x, G.veh.group.position.y + 1.3, p.z);
    else want.set(p.x, p.hipY + 0.5, p.z);
    camTarget.lerp(want, 1 - Math.exp(-dt * 14));
    const dist = driving ? G.dist * 1.4 + 4 : G.dist;
    const horiz = Math.cos(G.pitch) * dist;
    camera.position.set(camTarget.x - Math.sin(G.yaw) * horiz, camTarget.y + Math.sin(G.pitch) * dist, camTarget.z - Math.cos(G.yaw) * horiz);
    const g = world.heightAt(camera.position.x, camera.position.z) + 0.5;
    if (camera.position.y < g) camera.position.y = g;
    camera.lookAt(camTarget);
  }

  /* 루프 */
  const NOINPUT = { fwd: false, back: false, left: false, right: false, run: false, up: false, down: false };
  let last = performance.now();
  let lastAtElev = false;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    const t = now / 1000;
    last = now;
    if (towerMap.isOpen()) return;

    const driving = G.mode === 'drive';
    const v = G.veh;
    T.dialogue.update(dt);
    if (input.enabled && !G.ride && !G.busy) tickStay(dt);
    npcs.forEach(n => n.update(dt, t, player.p.x, player.p.z));
    if (!driving) player.updateWalk(dt, G.ride || T.dialogue.active ? NOINPUT : input, world, G.yaw, firstNow(), t);
    else {
      v.update(dt, input, world);
      player.p.x = v.c.x; player.p.z = v.c.z;
      if (now - input.lastLook > 1200) G.yaw += T.angDiff(v.c.h, G.yaw) * Math.min(1, dt * 2.2);
    }
    player.root.visible = !driving && !firstNow();
    player.animate(t, !driving);
    player.place();
    Object.values(vehicles).forEach(veh => veh.place(dt, world, t));
    const shaking = updateRide(dt);
    updateCamera(dt, driving);
    if (shaking) { camera.position.y += Math.sin(t * 23) * 0.004 + Math.sin(t * 7.1) * 0.003; camera.position.x += Math.sin(t * 17.3) * 0.002; }
    const cab = inCab();
    G.aim = cab && !G.ride ? aimButton(0, 0) : -1;
    elevator.highlight(G.aim);
    hud.crosshair(cab);
    if (elevator.isOpen() && !G.ride && !cab && Math.hypot(player.p.x, player.p.z) > 6) { G.doorIdle += dt; if (G.doorIdle > 2.5) elevator.close(); } else G.doorIdle = 0;

    const p = player.p;
    world.update(p.x, p.z, now, camera);
    const cs = world.surfaceAt(camera.position.x, camera.position.z, t);
    setUnder(camera.position.y < cs - 0.05 && world.heightAt(camera.position.x, camera.position.z) < cs);
    fish.update(dt, t, p.x, p.hipY, p.z, G.under || p.sd > 0.6);

    const depthHere = world.depthAt(p.x, p.z);
    audio.update({
      speed: driving ? Math.abs(v.c.v) : 0,
      driving,
      vehicle: v.kind,
      underwater: G.under,
      shore: 1 - T.smooth(0.5, 9, Math.abs(depthHere)),
      fallDist: world.nearestWaterfall(p.x, p.z),
      fallAngle: -T.angDiff(world.waterfallDirection(p.x, p.z), G.yaw),
      trees: world.floor.trees.density(p.x, p.z)
    });

    if (driving) {
      hud.setMode((v.kind === 'boat' ? '보트 타는 중 · ' : '운전 중 · ') + Math.round(Math.abs(v.c.v) * 3.6) + ' km/h');
      hud.setAction('내리기 · E');
    } else {
      const st = p.state;
      hud.setMode(st === 'dive' ? '잠수 중 · ' + Math.round(p.sd + 0.5) + 'm' : st === 'swim' ? '수영 중' : st === 'run' ? '달리는 중' : st === 'walk' ? '걷는 중' : '서 있음');
      const n = vname();
      if (T.dialogue.active) hud.setAction('다음 · E');
      else if (G.ride) hud.setAction('이동 중');
      else if (inCab()) hud.setAction(G.aim >= 0 ? T.floorLabel(G.aim) + ' 누르기 · E' : nearNPC() ? nearNPC().def.name + '에게 말 걸기 · E' : '층 고르기 · E');
      else if (nearNPC()) hud.setAction(nearNPC().def.name + '에게 말 걸기 · E');
      else if (nearPainting()) hud.setAction('그림 보기 · E');
      else if (nearElevator()) hud.setAction(elevator.isOpen() ? '안으로 들어가기' : '엘리베이터 문 열기 · E');
      else hud.setAction(v.c.out && vehDist() < 4.5 ? n + ' 타기 · E' : (v.c.out ? n + ' 부르기 · E' : n + ' 꺼내기 · E'));
    }
    const atElev = nearElevator();
    if (atElev && !lastAtElev && G.welcomed && !elevator.isOpen()) hud.toast('E를 누르면 엘리베이터 문이 열려요.');
    lastAtElev = atElev;

    renderer.render(scene, camera);
  }

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  const q0 = T.settings.quality();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q0.pixelRatio));
  world.setQuality(q0);
  const saved = T.save.read();
  if (saved && saved.npcMet) npcs[0].state.met = true;
  if (saved) {
    if (Array.isArray(saved.unlocked)) saved.unlocked.forEach(i => G.unlocked.add(i));
    else if (isFinite(saved.floor)) G.unlocked.add(saved.floor);
    if (saved.floorTime) G.floorTime = saved.floorTime;
  }
  let resumed = false;
  if (saved && T.isOpenFloor(saved.floor) && isFinite(saved.x) && isFinite(saved.z)) {
    const sv = saved.car ? Object.assign({ type: 'car' }, saved.car) : null;
    enterFloor(saved.floor, { x: saved.x, z: saved.z, h: saved.h || 0 }, sv);
    if (world.blocked(saved.x, saved.z, 0.35)) enterFloor(saved.floor); else resumed = true;
  } else {
    enterFloor(0);
  }
  applySettings();
  function welcome() {
    hud.toast(resumed ? '지난번에 있던 곳에서 이어서 시작해요.' : '엘리베이터에서 내렸어요. 화면을 누르고 마우스를 움직이면 주변을 둘러볼 수 있어요.', 4200);
    setTimeout(() => { G.welcomed = true; }, 4000);
  }
  /* 인트로가 끝날 때까지는 조작을 막아 둔다 */
  T.setInputEnabled(false);
  audio.quiet = true;
  T.intro.play({ onDone: () => { audio.quiet = false; T.setInputEnabled(true); welcome(); } });
  requestAnimationFrame(frame);
})(window.Tower);
