/* NPC: 사람 모델에 옷과 소품을 입히고, 숨쉬기·고개 돌려 바라보기·말할 때 끄덕이기, 말 걸기 대사를 가진다.
   새 NPC는 T.npcDefs에 설정 하나를 더하면 된다 */
(function (T) {
  T.npcDefs = T.npcDefs || {};

  /* 엘리베이터 안내원: 엘리베이터 안에서 함께 타고 다닌다 */
  T.npcDefs.attendant = {
    name: '안내원',
    voice: { pitch: 262, wave: 'square', speed: 28 },
    style: { skin: 0xd9b08c, top: 0x6e1f2a, bottom: 0x22252c, shoe: 0x141414, sole: 0x2a2a2a, hair: 0x1d1813, hands: 0xf4f2ec, longSleeve: true },
    pose: 'behindBack',
    /* 엘리베이터 안, 버튼판 옆에 선다 (엘리베이터 기준 좌표와 바라보는 방향) */
    place: { x: 1.0, z: 1.15, h: -0.5 },
    dress(root, add) {
      const head = root.userData.headG;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.105, 0.075, 18), new THREE.MeshStandardMaterial({ color: 0x6e1f2a, roughness: 0.6 }));
      cap.position.set(0, 0.115, -0.005); cap.rotation.x = -0.08; head.add(cap);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.106, 0.107, 0.018, 18), new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.85 }));
      band.position.set(0, 0.09, -0.005); band.rotation.x = -0.08; head.add(band);
      const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.85 });
      const body = root.userData.body;
      [1.5, 1.38, 1.26, 1.14].forEach(y => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), brass);
        b.position.set(0, y - T.HIP_Y, 0.152); body.add(b);
      });
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 14), brass);
      collar.rotation.x = Math.PI / 2; collar.position.set(0, 1.6 - T.HIP_Y, 0); body.add(collar);
    },
    /* 늘 같은 말을 한다. 말줄임표 줄은 혼자 천천히 찍히고 잠깐 쉬었다 넘어간다 */
    talk() {
      return ['안녕하세요 대신 벨을 눌러 드립니다', '...', '솔직히 바로 벨을 누를 수 있는데 저는 왜 있는 걸까요', '...'];
    },
    /* 대사가 끝나면 층 고르기로 이어진다 */
    afterTalk(ctx) { if (ctx.chooseFloor) ctx.chooseFloor(); }
  };

  T.createNPC = function (scene, world, def) {
    const root = T.makePerson(def.style);
    root.rotation.order = 'YXZ';
    def.dress && def.dress(root);
    scene.add(root);
    const { body, L, R, headG } = root.userData;
    const n = { def, root, x: 0, z: 0, h: 0, look: 0, talking: false, state: { floorsSeen: new Set() }, collider: { x: 0, z: 0, r: 0.4 } };

    n.placeOn = function (floor) {
      const P = def.place;
      if (P.angle != null) { n.x = Math.sin(P.angle) * P.dist; n.z = Math.cos(P.angle) * P.dist; n.h = P.angle; }
      else { n.x = P.x; n.z = P.z; n.h = P.h || 0; }
      root.position.set(n.x, world.heightAt(n.x, n.z), n.z);
      root.rotation.y = n.h;
      n.collider.x = n.x; n.collider.z = n.z;
      if (!world.dynamicColliders.includes(n.collider)) world.dynamicColliders.push(n.collider);
      n.state.floorsSeen.add(floor.index);
    };

    n.distTo = (x, z) => Math.hypot(x - n.x, z - n.z);

    n.update = function (dt, t, px, pz) {
      const toP = Math.atan2(px - n.x, pz - n.z);
      const near = n.distTo(px, pz) < 7;
      let rel = near ? T.angDiff(toP, n.h) : 0;
      if (Math.abs(rel) > 1.15) { n.h += T.angDiff(toP, n.h) * Math.min(1, dt * 1.2); rel = T.angDiff(toP, n.h); }
      root.rotation.y = n.h;
      n.look += (Math.max(-1.1, Math.min(1.1, rel)) - n.look) * Math.min(1, dt * 4);
      headG.rotation.y = n.look;
      headG.rotation.x = n.talking ? Math.sin(t * 7) * 0.05 - 0.03 : -0.03 + Math.sin(t * 0.6) * 0.01;
      body.position.y = T.HIP_Y + Math.sin(t * 1.7) * 0.006;
      body.rotation.y = n.look * 0.15;
      if (def.pose === 'behindBack') {
        L.arm.sh.rotation.set(0.42, 0, -0.2); R.arm.sh.rotation.set(0.42, 0, 0.2);
        L.arm.elbow.rotation.x = -0.25; R.arm.elbow.rotation.x = -0.25;
      }
      L.leg.hip.rotation.x = R.leg.hip.rotation.x = 0;
      L.leg.knee.rotation.x = R.leg.knee.rotation.x = 0.02;
    };

    n.lines = floor => def.talk(n.state, floor);
    return n;
  };
})(window.Tower);
