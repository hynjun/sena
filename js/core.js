/* 공통 도구: 난수, 노이즈, 각도 계산, 층 등록부, 타워 형태 */
window.Tower = window.Tower || {};
(function (T) {
  T.FLOOR_COUNT = 50;

  T.rng = function (seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  T.hash = function (ix, iz, k) {
    let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(k | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  T.noise = function (x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = T.hash(ix, iz, 0), b = T.hash(ix + 1, iz, 0), c = T.hash(ix, iz + 1, 0), d = T.hash(ix + 1, iz + 1, 0);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  T.fbm = function (x, z) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let o = 0; o < 4; o++) { s += a * T.noise(x * f + o * 17.3, z * f - o * 9.1); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  };

  T.smooth = function (a, b, x) {
    let t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  T.angDiff = function (a, b) {
    return ((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  };

  /* 층 등록부: 각 층 파일이 Tower.registerFloor(번호, 설정)으로 자기 자신을 등록한다 */
  T.floors = new Array(T.FLOOR_COUNT).fill(null);
  T.isMaintenance = i => i % 10 === 9 && i < T.FLOOR_COUNT - 1;
  T.registerFloor = function (i, def) {
    T.floors[i] = Object.assign({ index: i, ready: true }, def);
  };
  T.floorInfo = function (i) {
    if (T.floors[i]) return T.floors[i];
    return { index: i, ready: false, name: null, kind: T.isMaintenance(i) ? 'maintenance' : 'world' };
  };
  T.floorLabel = i => (i + 1) + 'F';
  /* 층이 열렸는지: 만들어져 있고(ready) 플레이로 해금되었는지. 게임이 실제 판정으로 바꿔 끼운다 */
  T.isUnlocked = i => !!(T.floors[i] && T.floors[i].ready);
  T.isOpenFloor = i => T.floorInfo(i).ready && T.isUnlocked(i);
  T.floorTitle = i => {
    const f = T.floorInfo(i);
    return f.ready ? f.name : '준비 중';
  };

  /* 타워 형태: 미니맵과 타워 지도가 같은 모양을 쓰도록 한 곳에서 정한다 */
  T.radiusAt = function (i) {
    const waist = 28;
    if (i < waist) return 4 + 4.4 * Math.pow((waist - i) / waist, 2);
    return 4 + 2.4 * Math.pow((i - waist) / (T.FLOOR_COUNT - 1 - waist), 2);
  };
  T.towerShape = (function () {
    const r = T.rng(20261029);
    const out = [];
    for (let i = 0; i < T.FLOOR_COUNT; i++) {
      const base = T.radiusAt(i);
      const maint = T.isMaintenance(i);
      const a = r() * Math.PI * 2, s = r() * 0.3;
      let radius = base, dx = Math.cos(a) * s, dz = Math.sin(a) * s, protrude = false;
      if (!maint && r() < 0.2) {
        const ext = 0.7 + r() * 1.3, a2 = r() * Math.PI * 2;
        radius += ext * 0.5; dx += Math.cos(a2) * ext * 0.6; dz += Math.sin(a2) * ext * 0.6;
        protrude = true;
      }
      out.push({ r: maint ? base - 0.35 : radius, dx: maint ? 0 : dx, dz: maint ? 0 : dz, maint, protrude });
    }
    return out;
  })();
})(window.Tower);
