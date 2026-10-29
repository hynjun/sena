/* 작은 모터보트: 꺼내기, 운전, 파도 타기, 뒤로 남는 물거품 */
(function (T) {
  function makeBoat() {
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.5, flatShading: true });
    const stripe = new THREE.MeshStandardMaterial({ color: 0x2fb2ac, roughness: 0.5 });
    const deck = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd6e8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.45 });

    const hullGeo = new THREE.BoxGeometry(1.9, 0.75, 4.4, 2, 2, 6);
    const p = hullGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const bow = Math.max(0, (z - 0.9) / 1.3);
      x *= 1 - Math.min(0.92, bow * bow * 0.95);
      if (y < 0) { x *= 0.55; y += bow * 0.3; }
      if (y > 0) y += bow * 0.12;
      p.setXYZ(i, x, y, z);
    }
    hullGeo.computeVertexNormals();
    const hull = new THREE.Mesh(hullGeo, hullMat); hull.position.y = 0.3; g.add(hull);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.12, 3.0), stripe); band.position.set(0, 0.48, -0.6); g.add(band);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 2.9), deck); floor.position.set(0, 0.62, -0.55); g.add(floor);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.5), hullMat); seat.position.set(0, 0.8, -1.1); g.add(seat);
    const console = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.5), hullMat); console.position.set(0.35, 0.92, 0.25); g.add(console);
    const wind = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.04), glass); wind.position.set(0, 1.15, 0.6); wind.rotation.x = -0.35; g.add(wind);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 14), dark); wheel.position.set(0.35, 1.25, 0.05); wheel.rotation.x = -0.6; g.add(wheel);
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.75, 0.35), dark); motor.position.set(0, 0.55, -2.35); g.add(motor);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.25, 0.45), new THREE.MeshStandardMaterial({ color: 0xe0683a, roughness: 0.5 })); cap.position.set(0, 1.0, -2.35); g.add(cap);
    g.traverse(o => { if (o.isMesh && o.material !== glass) o.castShadow = true; });
    return g;
  }

  T.createBoat = function (scene) {
    const group = makeBoat();
    group.visible = false;
    scene.add(group);
    const c = { x: 0, z: 0, h: 0, v: 0, out: false, pop: 1, roll: 0 };

    /* 물거품 자국 */
    const N = 140;
    const wGeo = new THREE.BufferGeometry();
    const wPos = new Float32Array(N * 3), wCol = new Float32Array(N * 3);
    wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    wGeo.setAttribute('color', new THREE.BufferAttribute(wCol, 3));
    const wake = new THREE.Points(wGeo, new THREE.PointsMaterial({ size: 1.1, map: T.softDot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    wake.frustumCulled = false;
    scene.add(wake);
    const puffs = Array.from({ length: N }, () => ({ life: 1, x: 0, y: -999, z: 0, vx: 0, vz: 0 }));
    let emit = 0, head = 0;

    function spawn(x, z, h, animate) {
      c.x = x; c.z = z; c.h = h; c.v = 0; c.out = true; c.pop = animate ? 0 : 1;
      group.visible = true;
    }
    function hide() { c.out = false; c.v = 0; group.visible = false; }

    function update(dt, input, world) {
      const thr = input.fwd ? 1 : 0, brk = input.back ? 1 : 0;
      if (thr) c.v += (input.run ? 11 : 7.5) * dt;
      if (brk) c.v -= (c.v > 0 ? 9 : 4) * dt;
      c.v -= c.v * 0.45 * dt;
      if (!thr && !brk) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 1.2 * dt);
      c.v = Math.max(-4, Math.min(input.run ? 24 : 16, c.v));
      const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      const turn = steer * dt * 1.1 * Math.min(1, Math.abs(c.v) / 4 + 0.15) * Math.sign(c.v || 1);
      c.h += turn;
      c.roll += (-steer * Math.min(1, Math.abs(c.v) / 10) * 0.12 - c.roll) * Math.min(1, dt * 3);
      const nx = c.x + Math.sin(c.h) * c.v * dt, nz = c.z + Math.cos(c.h) * c.v * dt;
      if (!world.blocked(nx, nz, 1.4, 'boat')) { c.x = nx; c.z = nz; } else { c.v *= -0.3; }
    }

    function place(dt, world, t) {
      if (!c.out) return;
      const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = Math.cos(c.h), rz = -Math.sin(c.h);
      const yF = world.surfaceAt(c.x + fx * 1.8, c.z + fz * 1.8, t), yB = world.surfaceAt(c.x - fx * 1.8, c.z - fz * 1.8, t);
      const yR = world.surfaceAt(c.x + rx * 0.9, c.z + rz * 0.9, t), yL = world.surfaceAt(c.x - rx * 0.9, c.z - rz * 0.9, t);
      const bob = Math.sin(t * 1.7) * 0.04;
      group.position.set(c.x, (yF + yB + yR + yL) / 4 - 0.28 + bob, c.z);
      group.rotation.order = 'YXZ';
      group.rotation.y = c.h;
      group.rotation.x = -Math.atan2(yF - yB, 3.6) - Math.min(0.12, Math.max(0, c.v) * 0.006);
      group.rotation.z = Math.atan2(yR - yL, 1.8) + c.roll + Math.sin(t * 1.3) * 0.015;
      c.pop = Math.min(1, c.pop + dt * 3);
      const s = c.pop < 1 ? 1 - Math.pow(1 - c.pop, 3) * (1 + 0.6 * Math.sin(c.pop * 9)) : 1;
      group.scale.setScalar(Math.max(0.01, s));

      emit += dt * Math.min(40, Math.abs(c.v) * 3);
      while (emit > 1) {
        emit -= 1;
        const q = puffs[head]; head = (head + 1) % N;
        const side = Math.random() - 0.5;
        q.life = 0; q.x = c.x - fx * 2.4 + rx * side * 1.2; q.z = c.z - fz * 2.4 + rz * side * 1.2;
        q.vx = rx * side * 2.5; q.vz = rz * side * 2.5;
        q.y = world.surfaceAt(q.x, q.z, t) + 0.1;
      }
      for (let i = 0; i < N; i++) {
        const q = puffs[i];
        q.life = Math.min(1, q.life + dt * 0.4);
        q.x += q.vx * dt; q.z += q.vz * dt;
        wPos[i * 3] = q.x; wPos[i * 3 + 1] = q.y; wPos[i * 3 + 2] = q.z;
        const b = q.life >= 1 ? 0 : (1 - q.life) * 0.5;
        wCol[i * 3] = wCol[i * 3 + 1] = wCol[i * 3 + 2] = b;
      }
      wGeo.attributes.position.needsUpdate = true;
      wGeo.attributes.color.needsUpdate = true;
    }

    return { group, c, spawn, hide, update, place, kind: 'boat' };
  };
})(window.Tower);
