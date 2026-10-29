/* 1F 로비 초원: 새 층은 이 파일을 본떠 floors/ 아래에 하나씩 추가한다 */
(function (T) {
  const { noise, fbm, smooth } = T;
  const WATER = -1.2;

  /* 북쪽의 거대한 절벽(높이 약 125m)과 큰 폭포 */
  const FALL_X = 80;
  const cliffZ = x => -205 + 18 * Math.sin(x * 0.006) + 7 * Math.sin(x * 0.021 + 1.1);
  const cliffMask = (x, z) => {
    const zc = cliffZ(x);
    const zj = z + (noise(x * 0.12, z * 0.12) - 0.5) * 7;
    return smooth(zc + 10, zc - 10, zj) * smooth(700, 430, Math.abs(x));
  };
  const plateauY = (x, z) => 125 + (fbm(x * 0.006 + 3, z * 0.006) - 0.5) * 14;
  const creekDepth = (x, z) => {
    const zc = cliffZ(x);
    return 3.5 * (1 - smooth(14, 22, Math.abs(x - FALL_X))) * smooth(zc + 8, zc - 4, z) * smooth(zc - 300, zc - 240, z);
  };
  const ridge = (x, z) => { const n = fbm(x * 0.0016 + 11, z * 0.0016 - 7); return Math.pow(1 - Math.abs(2 * n - 1), 2); };
  const LAKE = { x: FALL_X, z: cliffZ(FALL_X) + 50 };

  function height(x, z) {
    let y = (fbm(x * 0.006, z * 0.006) - 0.42) * 32;
    y += (noise(x * 0.06, z * 0.06) - 0.5) * 1.4;
    y -= 9 * smooth(0.36, 0.2, noise(x * 0.0035 + 37, z * 0.0035 - 11));
    const d = Math.hypot(x, z);
    y *= smooth(12, 80, d);
    const m = smooth(650, 1300, d);
    if (m > 0) y += m * (50 + 170 * ridge(x, z) + (noise(x * 0.02, z * 0.02) - 0.5) * 12 * m);
    const c = cliffMask(x, z);
    if (c > 0) {
      y = y * (1 - c) + (plateauY(x, z) - creekDepth(x, z)) * c;
      y += c * (1 - c) * (noise(x * 0.15, z * 0.15) - 0.5) * 20;
    }
    y -= 15 * (1 - smooth(35, 78, Math.hypot(x - LAKE.x, z - LAKE.z))) * (1 - c);
    return y;
  }

  const zLip = cliffZ(FALL_X) - 9;
  const topY = plateauY(FALL_X, zLip) - 1.5;

  T.registerFloor(0, {
    id: 'lobby',
    name: '로비 초원',
    tag: 'LOBBY',
    kind: 'world',
    worldRadius: 1500,
    water: WATER,
    swim: true,
    vehicle: 'car',
    spawn: { x: 0, z: 9, h: Math.PI },
    height,

    sky: {
      zenith: 0x3f85d0,
      horizon: 0xc4dceb,
      sunDir: [0.45, 0.42, 0.79],
      sunColor: 0xfff0d6,
      sunIntensity: 1.15,
      hemiSky: 0xcfe3f0,
      hemiGround: 0x4f5e34,
      hemiIntensity: 0.6,
      fogNear: 220,
      fogFar: 2600,
      clouds: true
    },

    waterColor: 0x2f6f8f,
    sea: { shallow: 0x58a9bd, deep: 0x2a6787, swell: 0, waves: false, foam: 0.3 },
    underwater: { color: 0x2a6a7a, far: 30 },

    palette: {
      grassA: 0x5f8f3a,
      grassB: 0x7aa846,
      high: 0x8a9a55,
      sand: 0xd9cc9c,
      rock: 0x8b8375,
      snow: 0xf2f4f5,
      forestFloor: 0x56793a
    },

    trees: {
      cell: 8,
      radius: 225,
      clearAroundElevator: 24,
      density(x, z) { return smooth(0.55, 0.8, noise(x * 0.012 + 5, z * 0.012 - 3)) * 0.4 + 0.004; },
      pineChance(y) { return 0.4 + 0.4 * smooth(6, 40, y); },
      leafColors: [0x4c7a37, 0x5d8f41, 0x3c6634, 0x6a9a45],
      trunkColor: 0x6b4f37
    },


    flowers: {
      cell: 3,
      radius: 80,
      chance(x, z) { return 0.25 * smooth(0.55, 0.75, noise(x * 0.03 - 4, z * 0.03 + 6)); },
      colors: [0xffffff, 0xf3d65b, 0xe9a3b9, 0xc9b6f0]
    },

    waterfalls: [
      { x: FALL_X, zTop: zLip, topY, bottomY: WATER, reach: 32, width: 38, creekLength: 240, creekY: z => plateauY(FALL_X, z) - 1.5 }
    ],

    ambience: { wind: 0.12, birds: true },

    map: { radius: 700 }
  });
})(window.Tower);
