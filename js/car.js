/* 차: 꺼내기, 운전, 지형 따라 기울기 */
(function (T) {
  function makeCar() {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: 0x9fd2c0, roughness: 0.45, metalness: 0.15 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x2b3a40, roughness: 0.15, metalness: 0.4 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 3.8), paint); body.position.y = 0.62;
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 0.18), trim); bumperF.position.set(0, 0.42, 1.95);
    const bumperB = bumperF.clone(); bumperB.position.z = -1.95;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.9), glass); cabin.position.set(0, 1.2, -0.2);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.1, 2.0), trim); roof.position.set(0, 1.52, -0.2);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff1c4, emissiveIntensity: 0.8 });
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12), lightMat); hl.rotation.x = Math.PI / 2; hl.position.set(0.55, 0.7, 1.92);
    const hr = hl.clone(); hr.position.x = -0.55;
    g.add(body, bumperF, bumperB, cabin, roof, hl, hr);
    g.userData.wheels = [];
    [[0.88, 1.25], [-0.88, 1.25], [0.88, -1.25], [-0.88, -1.25]].forEach(([x, z]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 16), tire);
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z);
      const pivot = new THREE.Group(); pivot.add(w);
      g.add(pivot); g.userData.wheels.push(w);
    });
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  T.createCar = function (scene) {
    const group = makeCar();
    group.visible = false;
    scene.add(group);
    const c = { x: 0, z: 0, h: 0, v: 0, out: false, pop: 1 };

    function spawn(x, z, h, animate) {
      c.x = x; c.z = z; c.h = h; c.v = 0; c.out = true; c.pop = animate ? 0 : 1;
      group.visible = true;
    }
    function hide() { c.out = false; c.v = 0; group.visible = false; }

    function update(dt, input, world) {
      const thr = input.fwd ? 1 : 0, brk = input.back ? 1 : 0;
      if (thr) c.v += (input.run ? 20 : 14) * dt;
      if (brk) c.v -= (c.v > 0 ? 26 : 10) * dt;
      c.v -= c.v * 0.35 * dt;
      if (!thr && !brk) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 3 * dt);
      c.v = Math.max(-8, Math.min(input.run ? 45 : 30, c.v));
      const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      c.h += steer * dt * 1.6 * Math.min(1, Math.abs(c.v) / 6) * Math.sign(c.v || 1);
      const nx = c.x + Math.sin(c.h) * c.v * dt, nz = c.z + Math.cos(c.h) * c.v * dt;
      if (!world.blocked(nx, nz, 1.3, 'car')) { c.x = nx; c.z = nz; } else { c.v *= -0.25; }
    }

    function place(dt, world) {
      if (!c.out) return;
      const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = Math.cos(c.h), rz = -Math.sin(c.h);
      const hf = world.heightAt(c.x + fx * 1.5, c.z + fz * 1.5), hb = world.heightAt(c.x - fx * 1.5, c.z - fz * 1.5);
      const hr = world.heightAt(c.x + rx * 0.9, c.z + rz * 0.9), hl = world.heightAt(c.x - rx * 0.9, c.z - rz * 0.9);
      group.position.set(c.x, (hf + hb + hr + hl) / 4, c.z);
      group.rotation.order = 'YXZ';
      group.rotation.y = c.h;
      group.rotation.x = -Math.atan2(hf - hb, 3);
      group.rotation.z = Math.atan2(hr - hl, 1.8);
      c.pop = Math.min(1, c.pop + dt * 3);
      const s = c.pop < 1 ? 1 - Math.pow(1 - c.pop, 3) * (1 + 0.6 * Math.sin(c.pop * 9)) : 1;
      group.scale.setScalar(Math.max(0.01, s));
      group.userData.wheels.forEach(w => { w.rotation.x += c.v * dt / 0.36; });
    }

    return { group, c, spawn, hide, update, place, kind: 'car' };
  };
})(window.Tower);
