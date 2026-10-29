/* 2F 에메랄드 만: 세 방향이 절벽으로 둘러싸인 열대 바다, 한가운데 섬에 엘리베이터와 오두막 하나 */
(function (T) {
  const { noise, fbm, smooth } = T;
  const WATER = 0;

  /* 만의 모양: 남쪽(+z)으로 바다가 열려 있고 나머지는 절벽, 북쪽 안쪽에 작은 백사장 */
  const ringR = ang => 262 + 18 * Math.sin(ang * 3 + 0.7) + (noise(ang * 6 + 2, 3) - 0.5) * 14;
  function shape(x, z) {
    const r = Math.hypot(x, z), ang = Math.atan2(x, z), aa = Math.abs(ang);
    return { r, ang, aa, open: smooth(0.95, 0.55, aa), cove: smooth(2.2, 2.75, aa) };
  }

  function height(x, z) {
    const S = shape(x, z), r = S.r;
    const sea = -9 - 6 * smooth(60, 240, r) - 26 * S.open * smooth(260, 650, r) + (noise(x * 0.02, z * 0.02) - 0.5) * 3;
    const beach = sea + (2.4 - sea) * smooth(165, 240, r);
    let y = sea + (beach - sea) * S.cove;
    const R = ringR(S.ang);
    const c = smooth(R - 9, R + 9, r + (noise(x * 0.1, z * 0.1) - 0.5) * 6) * (1 - S.open);
    if (c > 0) {
      const land = 46 + (fbm(x * 0.005 + 7, z * 0.005) - 0.5) * 24 + 40 * smooth(R + 60, R + 700, r);
      y = y * (1 - c) + land * c;
      y += c * (1 - c) * (noise(x * 0.16, z * 0.16) - 0.5) * 22;
    }
    const isl = 1 - smooth(16, 44, r);
    if (isl > 0) {
      const top = 3.0 + (noise(x * 0.1, z * 0.1) - 0.5) * 0.4;
      const e = Math.max(0, r - 14);
      const island = top - e * 0.22 - e * e * 0.006;
      y = y * (1 - isl) + Math.max(island, y) * isl;
    }
    return y;
  }

  /* 섬의 야자수는 바깥쪽으로 기울어지게 직접 놓는다 */
  const islandPalms = [[15, 7], [17, -9], [-4, 18], [8, -17], [-18, 7], [-15, -12]].map(([x, z], i) => ({
    species: 'palm', x, z, s: 0.95 + (i % 3) * 0.12, rot: -Math.atan2(z, x)
  }));

  T.registerFloor(1, {
    id: 'bay',
    name: '에메랄드 만',
    tag: 'BAY',
    kind: 'world',
    worldRadius: 1400,
    water: WATER,
    swim: true,
    vehicle: 'boat',
    spawn: { x: 0, z: 9, h: 0 },
    sandLevel: 2.8,
    height,

    sky: {
      zenith: 0x2f7fe0,
      horizon: 0xbfe2f2,
      sunDir: [0.32, 0.82, 0.48],
      sunColor: 0xfff5e0,
      sunIntensity: 1.25,
      hemiSky: 0xd6eefa,
      hemiGround: 0xd8c79a,
      hemiIntensity: 0.62,
      fogNear: 400,
      fogFar: 3000,
      clouds: true
    },

    waterColor: 0x0a5f86,
    sea: { shallow: 0x3fd4c6, deep: 0x0a5f86, swell: 0.18, waves: true, waveEvery: [12, 26], waveAmp: 0.9, foam: 1 },
    underwater: { color: 0x16809a, far: 42 },

    palette: {
      grassA: 0x6fa043,
      grassB: 0x8fbf4f,
      high: 0x7e9a4a,
      sand: 0xf0e2bc,
      rock: 0xc2ae8f,
      forestFloor: 0x5a8a3a,
      seabed: 0xcfc6a0
    },

    trees: {
      cell: 9,
      radius: 225,
      clearAroundElevator: 30,
      density(x, z) {
        const S = shape(x, z);
        const beach = smooth(222, 232, S.r) * smooth(256, 246, S.r) * S.cove * 0.3;
        const top = smooth(ringR(S.ang) + 20, ringR(S.ang) + 40, S.r) * (1 - S.open) * (0.02 + 0.05 * smooth(0.55, 0.8, noise(x * 0.01, z * 0.01)));
        return beach + top;
      },
      species(y) { return y < 8 ? 'palm' : 'round'; },
      fixed: islandPalms,
      leafColors: [0x4f9a3a, 0x5fae42, 0x3f8a34, 0x6cb84a],
      trunkColor: 0x8a6a48
    },

    rocks: {
      cell: 6,
      size: [0.5, 1.8],
      colors: [0xa89a85, 0x8f8574, 0xc2b49c],
      chance(x, z, y) {
        const r = Math.hypot(x, z);
        if (r > 20 && r < 32) return 0.22;
        const S = shape(x, z), R = ringR(S.ang);
        if (r > R - 14 && r < R && y < 6 && S.open < 0.5) return 0.35;
        return 0;
      }
    },

    props: [{ type: 'hut', x: -8.5, z: -6.5, rot: 0.9 }],

    fish: { colors: [0xffd23f, 0x3fa7ff, 0xff7a59, 0x8ef0d0, 0xf5f5f5, 0xb48cff], minDepth: 3 },

    ambience: { wind: 0.07, birds: 'gulls', surf: 0.14 },

    map: { radius: 520 }
  });
})(window.Tower);
