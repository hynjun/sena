/* 플레이어: 흰 반팔과 청바지 차림의 사람 모델(얼굴은 이목구비 없이 매끈하게), 걷기·달리기·회전·수영 */
(function (T) {
  const HIP_Y = 0.95;

  /* 사람 모델. style로 옷 색을 바꾸면 NPC도 같은 몸으로 만든다 */
  function makePerson(style) {
    const st = Object.assign({ skin: 0xe3bf9f, top: 0xf5f5f2, bottom: 0x3f5f88, shoe: 0xeeeeea, sole: 0x9a9890, hair: 0x2b2118, hands: null, longSleeve: false }, style || {});
    const skin = new THREE.MeshStandardMaterial({ color: st.skin, roughness: 0.75 });
    const tee = new THREE.MeshStandardMaterial({ color: st.top, roughness: 0.85 });
    const denim = new THREE.MeshStandardMaterial({ color: st.bottom, roughness: 0.9 });
    const shoe = new THREE.MeshStandardMaterial({ color: st.shoe, roughness: 0.7 });
    const sole = new THREE.MeshStandardMaterial({ color: st.sole, roughness: 0.9 });
    const hairM = new THREE.MeshStandardMaterial({ color: st.hair, roughness: 0.9 });
    const handM = st.hands != null ? new THREE.MeshStandardMaterial({ color: st.hands, roughness: 0.8 }) : skin;
    const armM = st.longSleeve ? tee : skin;
    const cyl = (rt, rb, h, m, seg = 14) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, -h / 2, 0); return new THREE.Mesh(g, m); };
    const ball = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);

    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);

    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.2, 14), denim);
    pelvis.scale.set(1.1, 1, 0.75); pelvis.position.y = 0.98; body.add(pelvis);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.17, 0.52, 16), tee);
    torso.scale.set(1.12, 1, 0.7); torso.position.y = 1.31; body.add(torso);
    const chest = ball(0.2, tee); chest.scale.set(1.15, 0.5, 0.72); chest.position.y = 1.55; body.add(chest);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 10), skin); neck.position.y = 1.63; body.add(neck);
    const headG = new THREE.Group(); headG.position.y = 1.76; body.add(headG);
    const head = ball(0.11, skin); head.scale.set(0.9, 1.12, 1); headG.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.117, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
    hair.scale.set(0.95, 1.1, 1.05); hair.position.set(0, 0.015, -0.012); headG.add(hair);

    function arm(side) {
      const sh = new THREE.Group(); sh.position.set(0.245 * side, 1.52, 0);
      const cap = ball(0.075, tee); cap.scale.set(1, 0.9, 0.9); sh.add(cap);
      sh.add(cyl(0.068, 0.062, 0.17, tee));
      sh.add(cyl(0.05, 0.045, 0.29, armM));
      const elbow = new THREE.Group(); elbow.position.y = -0.29; sh.add(elbow);
      elbow.add(ball(0.045, armM));
      elbow.add(cyl(0.044, 0.036, 0.25, armM));
      const hand = ball(0.045, handM); hand.scale.set(0.8, 1.2, 0.6); hand.position.y = -0.29; elbow.add(hand);
      body.add(sh);
      sh.rotation.z = 0.08 * side;
      return { sh, elbow };
    }
    function leg(side) {
      const hip = new THREE.Group(); hip.position.set(0.095 * side, 0.94, 0);
      hip.add(cyl(0.085, 0.068, 0.46, denim));
      const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
      knee.add(ball(0.066, denim));
      knee.add(cyl(0.066, 0.056, 0.41, denim));
      const foot = new THREE.Group(); foot.position.y = -0.41; knee.add(foot);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.27), shoe); s.position.set(0, -0.025, 0.045); foot.add(s);
      const so = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.02, 0.28), sole); so.position.set(0, -0.06, 0.045); foot.add(so);
      root.add(hip);
      return { hip, knee };
    }
    const L = { arm: arm(1), leg: leg(1) }, R = { arm: arm(-1), leg: leg(-1) };
    body.children.forEach(ch => { ch.position.y -= HIP_Y; });
    body.position.y = HIP_Y;
    root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    root.userData = { body, L, R, headG };
    return root;
  }
  T.makePerson = makePerson;
  T.HIP_Y = HIP_Y;

  T.createPlayer = function (scene) {
    const root = makePerson();
    root.rotation.order = 'YXZ';
    scene.add(root);
    const p = { x: 0, z: 0, h: 0, vy: 0, av: 0, ph: 0, amp: 0, swim: false, sd: 0, hipY: HIP_Y, swimBlend: 0, horiz: 0, sph: 0, surf: 0, ground: 0, depth: 0 };

    function setPose(x, z, h) {
      p.x = x; p.z = z; p.h = p.vy = h; p.av = 0; p.amp = 0; p.sd = 0; p.swim = false; p.swimBlend = 0; p.horiz = 0; p.snap = true;
    }

    /* 이동은 화면이 보는 방향 기준. 3인칭에서는 몸이 이동 방향으로 돌아서고, 1인칭에서는 늘 화면 방향을 본다.
       물이 가슴보다 깊으면 수영: Space로 떠오르고 C로 잠수 */
    function updateWalk(dt, input, world, viewYaw, firstPerson, t) {
      const f = (input.fwd ? 1 : 0) - (input.back ? 1 : 0);
      const s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const fx = Math.sin(viewYaw), fz = Math.cos(viewYaw);
      const rx = -Math.cos(viewYaw), rz = Math.sin(viewYaw);
      let mx = fx * f + rx * s, mz = fz * f + rz * s;
      const len = Math.hypot(mx, mz);
      const running = input.run && len > 0;
      let moved = false;
      const prevH = p.h;
      if (firstPerson) p.h = viewYaw;
      if (len > 0) {
        mx /= len; mz /= len;
        if (!firstPerson) p.h += T.angDiff(Math.atan2(mx, mz), p.h) * Math.min(1, dt * (p.swim ? 4 : 10));
        let speed = p.swim ? (running ? 4.2 : 2.6) : (running ? 9 : 4.5);
        if (!p.swim && p.depth > 0.4) speed *= 0.6;
        if (firstPerson && f < 0 && s === 0) speed *= 0.6;
        const nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt;
        if (!world.blocked(nx, nz, 0.35)) { p.x = nx; p.z = nz; moved = true; }
        else if (!world.blocked(nx, p.z, 0.35)) { p.x = nx; moved = true; }
        else if (!world.blocked(p.x, nz, 0.35)) { p.z = nz; moved = true; }
      }
      p.ground = world.heightAt(p.x, p.z);
      p.surf = world.surfaceAt(p.x, p.z, t);
      p.depth = p.surf - p.ground;
      const wasSwim = p.swim;
      p.swim = p.depth > (p.swim ? 1.1 : 1.3);
      if (p.swim) {
        if (input.down) p.sd += 2.2 * dt;
        else if (input.up) p.sd -= 2.8 * dt;
        else p.sd -= 0.6 * dt;
        p.sd = Math.max(0, Math.min(Math.max(0, p.depth - 1.8), p.sd));
      } else p.sd = 0;
      const target = p.swim ? p.surf - (moved || p.sd > 0.2 ? 0.28 : 0.55) - p.sd : p.ground + HIP_Y;
      if (p.snap || (!p.swim && !wasSwim && p.swimBlend < 0.02)) p.hipY = target;
      else p.hipY += (target - p.hipY) * Math.min(1, dt * 5);
      p.snap = false;
      p.swimBlend += ((p.swim ? 1 : 0) - p.swimBlend) * Math.min(1, dt * 4);
      p.horiz += ((p.swim && (moved || p.sd > 0.2) ? 1 : 0) - p.horiz) * Math.min(1, dt * 3);
      p.sph += dt * (moved ? (running ? 6 : 4.5) : 2.4);

      const rate = T.angDiff(p.h, prevH) / Math.max(dt, 1e-4);
      p.av += (Math.max(-3, Math.min(3, rate)) - p.av) * Math.min(1, dt * 8);
      const targetAmp = moved && !p.swim ? (running ? 1.35 : 0.85) : 0;
      p.amp += (targetAmp - p.amp) * Math.min(1, dt * 8);
      p.ph += dt * (running ? 10.5 : 7) * (moved ? 1 : 0.2);
      p.vy += T.angDiff(p.h, p.vy) * Math.min(1, dt * (p.swim ? 5 : 12));
      p.state = p.swim ? (p.sd > 0.3 ? 'dive' : 'swim') : p.amp > 1.1 ? 'run' : p.amp > 0.3 && moved ? 'walk' : 'idle';
    }

    function animate(t, walking) {
      const { body, L, R, headG } = root.userData;
      const av = walking ? p.av : 0, amp = p.amp, ph = p.ph;
      root.rotation.z = -av * 0.022 * Math.min(1, amp);
      body.rotation.y = av * 0.05;
      headG.rotation.y = av * 0.1;
      if (p.swimBlend > 0.5) {
        const k = p.horiz, q = p.sph;
        L.arm.sh.rotation.x = k * -(q % (Math.PI * 2)) + (1 - k) * (-0.6 + Math.sin(q) * 0.25);
        R.arm.sh.rotation.x = k * -((q + Math.PI) % (Math.PI * 2)) + (1 - k) * (-0.6 - Math.sin(q) * 0.25);
        L.arm.sh.rotation.z = (1 - k) * (0.55 + Math.sin(q) * 0.3) + 0.08;
        R.arm.sh.rotation.z = -(1 - k) * (0.55 + Math.sin(q) * 0.3) - 0.08;
        L.arm.elbow.rotation.x = -0.3 - (1 - k) * 0.4;
        R.arm.elbow.rotation.x = -0.3 - (1 - k) * 0.4;
        L.leg.hip.rotation.x = Math.sin(q * (k > 0.5 ? 2.2 : 1)) * (k > 0.5 ? 0.3 : 0.45);
        R.leg.hip.rotation.x = -Math.sin(q * (k > 0.5 ? 2.2 : 1)) * (k > 0.5 ? 0.3 : 0.45);
        L.leg.knee.rotation.x = 0.25 + (1 - k) * (0.4 + Math.sin(q) * 0.3);
        R.leg.knee.rotation.x = 0.25 + (1 - k) * (0.4 - Math.sin(q) * 0.3);
        body.position.y = HIP_Y;
        body.rotation.x = 0;
        headG.rotation.x = -0.75 * k;
        return;
      }
      const s = Math.sin(ph);
      L.leg.hip.rotation.x = s * 0.55 * amp;
      R.leg.hip.rotation.x = -s * 0.55 * amp;
      L.leg.knee.rotation.x = (0.5 + 0.5 * Math.sin(ph - 1.4)) * 0.9 * amp;
      R.leg.knee.rotation.x = (0.5 + 0.5 * Math.sin(ph + Math.PI - 1.4)) * 0.9 * amp;
      L.arm.sh.rotation.x = -s * 0.5 * amp;
      R.arm.sh.rotation.x = s * 0.5 * amp;
      L.arm.sh.rotation.z = 0.08;
      R.arm.sh.rotation.z = -0.08;
      L.arm.elbow.rotation.x = -0.15 - 0.45 * amp;
      R.arm.elbow.rotation.x = -0.15 - 0.45 * amp;
      const breathe = Math.sin(t * 1.8) * 0.006 * (1 - Math.min(1, amp));
      body.position.y = HIP_Y + Math.abs(Math.cos(ph)) * 0.03 * amp + breathe;
      body.rotation.x = 0.05 * Math.min(1.4, amp) * Math.min(1.4, amp);
      headG.rotation.x = -0.04 * amp;
    }

    /* 골반 높이를 기준으로 몸을 세우거나(걷기) 눕힌다(수영) */
    function place() {
      const pitch = p.swimBlend * (0.12 + 1.25 * p.horiz);
      const sp = Math.sin(pitch), cp = Math.cos(pitch);
      root.rotation.y = p.vy;
      root.rotation.x = pitch;
      root.position.set(p.x - Math.sin(p.vy) * HIP_Y * sp, p.hipY - HIP_Y * cp, p.z - Math.cos(p.vy) * HIP_Y * sp);
    }

    const headPos = new THREE.Vector3();
    function head() {
      root.updateMatrixWorld(true);
      return root.userData.headG.getWorldPosition(headPos);
    }

    return { root, p, setPose, updateWalk, animate, place, head };
  };
})(window.Tower);
