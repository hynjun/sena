/* 소품: 층 설정의 props 목록으로 만들어지는 물건들. 지금은 '방금 누가 있다 간 듯한' 오두막 */
(function (T) {
  T.props = T.props || {};

  T.props.hut = function (def, world) {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b43, roughness: 0.9, flatShading: true });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x6e4a2d, roughness: 0.95, flatShading: true });
    const plank = new THREE.MeshStandardMaterial({ color: 0xb7875a, roughness: 0.9, flatShading: true });
    const thatch = new THREE.MeshStandardMaterial({ color: 0xc9a865, roughness: 1, flatShading: true });
    const glow = new THREE.MeshStandardMaterial({ color: 0x2a1708, emissive: 0xffb45a, emissiveIntensity: 1.1 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x4fb3c8, roughness: 0.9, side: THREE.DoubleSide });
    const mugMat = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.6 });
    const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; group.add(b); return b; };

    const W = 5.0, D = 4.0, H = 2.3, FLOOR = 0.55;
    /* 기둥과 바닥 */
    [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 1.85], [1, 1.85]].forEach(([sx, sz]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.6, 6), woodDark);
      post.position.set(sx * (W / 2 - 0.15), FLOOR - 0.75, sz * (D / 2 - 0.15)); post.castShadow = true; group.add(post);
    });
    box(W, 0.14, D + 1.6, plank, 0, FLOOR, 0.8);
    /* 벽: 앞벽은 문 자리를 비워 둔다 */
    const wy = FLOOR + H / 2 + 0.07;
    box(W, H, 0.12, wood, 0, wy, -D / 2);
    box(0.12, H, D, wood, -W / 2, wy, 0);
    box(0.12, H, D, wood, W / 2, wy, 0);
    box(1.9, H, 0.12, wood, -1.55, wy, D / 2);
    box(1.9, H, 0.12, wood, 1.55, wy, D / 2);
    box(1.2, 0.5, 0.12, wood, 0, FLOOR + H - 0.18, D / 2);
    /* 창문: 안쪽 등불이 비친다 */
    const win1 = box(0.9, 0.65, 0.05, glow, W / 2 + 0.04, FLOOR + 1.35, -0.4); win1.rotation.y = Math.PI / 2;
    const win2 = box(0.9, 0.65, 0.05, glow, -W / 2 - 0.04, FLOOR + 1.35, 0.5); win2.rotation.y = Math.PI / 2;
    const doorGlow = box(1.16, 1.75, 0.04, glow, 0, FLOOR + 0.95, D / 2 - 0.35);
    doorGlow.material = glow;
    /* 살짝 열린 문 */
    const doorPivot = new THREE.Group(); doorPivot.position.set(-0.6, FLOOR + 0.98, D / 2 + 0.02); group.add(doorPivot);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.8, 0.07), woodDark); door.position.set(0.575, 0, 0); door.castShadow = true; doorPivot.add(door);
    /* 초가지붕 */
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.3, 2.1, 4), thatch);
    roof.rotation.y = Math.PI / 4; roof.scale.set(1.25, 1, 1.05);
    roof.position.set(0, FLOOR + H + 1.0, 0.2); roof.castShadow = true; group.add(roof);
    /* 실내 등불 */
    const light = new THREE.PointLight(0xffb45a, 0.9, 9, 2);
    light.position.set(0, FLOOR + 1.7, 0); group.add(light);

    /* 현관: 탁자와 김 나는 머그잔, 아직 흔들리는 흔들의자 */
    const tableY = FLOOR + 0.6;
    box(0.8, 0.06, 0.6, plank, 1.5, tableY, D / 2 + 0.85);
    [[-0.33, -0.23], [0.33, -0.23], [-0.33, 0.23], [0.33, 0.23]].forEach(([dx, dz]) => box(0.05, 0.6, 0.05, woodDark, 1.5 + dx, FLOOR + 0.3, D / 2 + 0.85 + dz));
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.12, 12), mugMat);
    mug.position.set(1.62, tableY + 0.09, D / 2 + 0.8); group.add(mug);
    const book = box(0.22, 0.04, 0.3, new THREE.MeshStandardMaterial({ color: 0x8c3b2e, roughness: 0.8 }), 1.35, tableY + 0.05, D / 2 + 0.9);
    book.rotation.y = 0.4;

    const chair = new THREE.Group(); chair.position.set(-1.3, FLOOR + 0.07, D / 2 + 0.9); chair.rotation.y = 0.5; group.add(chair);
    const rocker = new THREE.Group(); chair.add(rocker);
    [-0.25, 0.25].forEach(sx => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 4, 12, 1.4), woodDark);
      r.rotation.set(0, Math.PI / 2, Math.PI + 0.85); r.position.set(sx, 0.55, 0); rocker.add(r);
    });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.5), plank); seat.position.set(0, 0.45, 0); rocker.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.05), plank); back.position.set(0, 0.75, -0.25); back.rotation.x = -0.2; rocker.add(back);
    rocker.traverse(o => { if (o.isMesh) o.castShadow = true; });

    /* 빨랫줄과 수건 */
    const lineY = FLOOR + 1.9;
    box(0.08, 1.9, 0.08, woodDark, W / 2 + 1.6, FLOOR + 0.95 - 0.5, D / 2 + 0.2);
    const towelPivot = new THREE.Group(); towelPivot.position.set(W / 2 + 0.8, lineY - 0.5, D / 2 + 0.2); group.add(towelPivot);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.7, 4), woodDark); rope.rotation.z = Math.PI / 2; rope.position.set(0, 0, 0); towelPivot.add(rope);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8, 1, 4), cloth); towel.position.set(0.1, -0.4, 0); towelPivot.add(towel);

    /* 문 앞 샌들 한 켤레 */
    const sandal = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.9 });
    box(0.11, 0.02, 0.26, sandal, -0.15, FLOOR + 0.08, D / 2 + 0.45).rotation.y = 0.2;
    box(0.11, 0.02, 0.26, sandal, 0.08, FLOOR + 0.08, D / 2 + 0.5).rotation.y = -0.15;

    /* 머그잔의 김 */
    const STEAM = 18;
    const sGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(STEAM * 3), sCol = new Float32Array(STEAM * 3);
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    const steam = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 0.16, map: T.softDot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    steam.frustumCulled = false;
    group.add(steam);
    const seeds = Array.from({ length: STEAM }, () => ({ life: Math.random(), a: Math.random() * 6.28 }));

    const gy = world.heightAt(def.x, def.z);
    group.position.set(def.x, gy, def.z);
    group.rotation.y = def.rot || 0;

    const c = Math.cos(def.rot || 0), s = Math.sin(def.rot || 0);
    const toWorld = (lx, lz) => ({ x: def.x + lx * c + lz * s, z: def.z - lx * s + lz * c });
    const colliders = [
      Object.assign(toWorld(-1.25, 0), { r: 2.2 }),
      Object.assign(toWorld(1.25, 0), { r: 2.2 }),
      Object.assign(toWorld(-1.6, D / 2 + 0.8), { r: 0.9 }),
      Object.assign(toWorld(0, D / 2 + 0.8), { r: 0.9 }),
      Object.assign(toWorld(1.6, D / 2 + 0.8), { r: 0.9 }),
      Object.assign(toWorld(W / 2 + 1.6, D / 2 + 0.2), { r: 0.25 })
    ];

    function update(t, dt) {
      rocker.rotation.x = Math.sin(t * 1.35) * 0.13;
      doorPivot.rotation.y = -0.55 + Math.sin(t * 0.7) * 0.05;
      towel.rotation.x = Math.sin(t * 1.7) * 0.18 + 0.1;
      towelPivot.rotation.y = Math.sin(t * 0.9) * 0.05;
      light.intensity = 0.85 + Math.sin(t * 7.1) * 0.04 + Math.sin(t * 13.7) * 0.03;
      for (let i = 0; i < STEAM; i++) {
        const q = seeds[i];
        q.life += dt * 0.45;
        if (q.life > 1) { q.life -= 1; q.a = Math.random() * 6.28; }
        const L = q.life;
        sPos[i * 3] = 1.62 + Math.sin(q.a + t * 2) * 0.04 * L + L * 0.05;
        sPos[i * 3 + 1] = tableY + 0.16 + L * 0.45;
        sPos[i * 3 + 2] = D / 2 + 0.8 + Math.cos(q.a + t * 1.7) * 0.04 * L;
        const b = Math.sin(L * Math.PI) * 0.35;
        sCol[i * 3] = sCol[i * 3 + 1] = sCol[i * 3 + 2] = b;
      }
      sGeo.attributes.position.needsUpdate = true;
      sGeo.attributes.color.needsUpdate = true;
    }

    return { group, colliders, update };
  };
})(window.Tower);
