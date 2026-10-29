/* 물고기: 잠수하면 가끔 주변에 물고기 떼가 나타나 헤엄치다 사라진다 */
(function (T) {
  function fishGeometry() {
    const body = new THREE.SphereGeometry(1, 10, 8);
    body.scale(0.09, 0.12, 0.3);
    const tail = new THREE.ConeGeometry(0.13, 0.22, 4);
    tail.rotateX(Math.PI / 2);
    tail.scale(0.25, 1, 1);
    tail.translate(0, 0, -0.36);
    tail.rotateZ(0);
    return T.mergeGeometries([body, tail]);
  }

  T.createFish = function (scene, world) {
    const SCHOOLS = 4, PER = 14;
    const mesh = new THREE.InstancedMesh(fishGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.15 }), SCHOOLS * PER);
    mesh.count = SCHOOLS * PER;
    mesh.frustumCulled = false;
    scene.add(mesh);
    const dummy = new THREE.Object3D();
    const schools = [];
    for (let s = 0; s < SCHOOLS; s++) {
      const fish = [];
      for (let i = 0; i < PER; i++) fish.push({ ox: (Math.random() - 0.5) * 3, oy: (Math.random() - 0.5) * 1.4, oz: (Math.random() - 0.5) * 3, ph: Math.random() * 6.28, sp: 0.8 + Math.random() * 0.5 });
      schools.push({ active: false, wait: 2 + s * 4 + Math.random() * 6, life: 0, dur: 0, x: 0, y: 0, z: 0, h: 0, turn: 0, scale: 0, color: new THREE.Color(), fish });
    }
    let colors = [];

    function tryStart(sc, px, pz, py) {
      const f = world.floor;
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * 6.283, d = 8 + Math.random() * 16;
        const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
        const depth = f.water - f.height(x, z);
        if (depth < (f.fish.minDepth || 3)) continue;
        const ground = f.height(x, z);
        sc.x = x; sc.z = z;
        sc.y = Math.min(f.water - 1.2, Math.max(ground + 1.2, py + (Math.random() - 0.5) * 3));
        sc.h = Math.random() * 6.283; sc.turn = (Math.random() - 0.5) * 0.4;
        sc.active = true; sc.life = 0; sc.dur = 22 + Math.random() * 20;
        sc.color.set(colors[Math.floor(Math.random() * colors.length)]);
        for (let i = 0; i < PER; i++) mesh.setColorAt(schools.indexOf(sc) * PER + i, sc.color.clone().multiplyScalar(0.85 + Math.random() * 0.3));
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        return;
      }
      sc.wait = 3;
    }

    return {
      reload() {
        const f = world.floor;
        colors = f.fish ? f.fish.colors : [];
        schools.forEach((sc, s) => { sc.active = false; sc.wait = 2 + s * 4 + Math.random() * 6; sc.scale = 0; });
        mesh.visible = !!f.fish;
        for (let i = 0; i < SCHOOLS * PER; i++) mesh.setColorAt(i, new THREE.Color(0xffffff));
      },
      update(dt, t, px, py, pz, underwater) {
        const f = world.floor;
        if (!f.fish) return;
        schools.forEach((sc, s) => {
          if (!sc.active) {
            if (underwater) { sc.wait -= dt; if (sc.wait <= 0) tryStart(sc, px, pz, py); }
          } else {
            sc.life += dt;
            sc.h += sc.turn * dt + Math.sin(t * 0.3 + s) * 0.15 * dt;
            const nx = sc.x + Math.sin(sc.h) * 1.6 * dt, nz = sc.z + Math.cos(sc.h) * 1.6 * dt;
            const depth = f.water - f.height(nx, nz);
            if (depth < 2.2) sc.h += Math.PI * 0.6 * dt * 4; else { sc.x = nx; sc.z = nz; }
            const ground = f.height(sc.x, sc.z);
            sc.y = Math.min(f.water - 1.0, Math.max(ground + 1.0, sc.y + Math.sin(t * 0.5 + s) * 0.2 * dt));
            if (sc.life > sc.dur || Math.hypot(sc.x - px, sc.z - pz) > 60) { sc.active = false; sc.wait = 6 + Math.random() * 12; }
          }
          sc.scale += ((sc.active ? 1 : 0) - sc.scale) * Math.min(1, dt * 1.5);
          for (let i = 0; i < PER; i++) {
            const q = sc.fish[i];
            const wob = Math.sin(t * 1.3 * q.sp + q.ph);
            const lx = q.ox + Math.cos(t * 0.7 + q.ph) * 0.4, lz = q.oz + wob * 0.5;
            const ch = Math.cos(sc.h), sh = Math.sin(sc.h);
            dummy.position.set(sc.x + lx * ch + lz * sh, sc.y + q.oy + Math.sin(t * 0.9 + q.ph) * 0.15, sc.z - lx * sh + lz * ch);
            dummy.rotation.set(0, sc.h + Math.sin(t * 9 * q.sp + q.ph) * 0.22, 0);
            dummy.scale.setScalar(Math.max(0.001, sc.scale) * (0.8 + q.sp * 0.3));
            dummy.updateMatrix();
            mesh.setMatrixAt(s * PER + i, dummy.matrix);
          }
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    };
  };
})(window.Tower);
