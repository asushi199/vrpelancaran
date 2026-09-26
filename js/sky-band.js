/* Shared Milky Way band geometry, used by tools/make-sky.js (baked sky texture)
   and by galaxy-stars in js/launch.js (star density), so both line up.

   The band passes behind the launch orb (straight ahead, ~20° below the horizon)
   and rises to the right at ~55°, as in the first frame of Pelancaran.mp4.
   Directions are in the ceremony anchor's frame: -Z forward, +X right, +Y up. */
(function (root) {
  const DEG = Math.PI / 180;
  const AZIMUTH = 0 * DEG;
  const ELEVATION = -20 * DEG;
  const TILT = 55 * DEG;

  const F = [
    Math.sin(AZIMUTH) * Math.cos(ELEVATION),
    Math.sin(ELEVATION),
    -Math.cos(AZIMUTH) * Math.cos(ELEVATION),
  ];
  const R = [Math.cos(AZIMUTH), 0, Math.sin(AZIMUTH)];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const U = norm(cross(R, F));
  const T = norm([
    Math.cos(TILT) * R[0] + Math.sin(TILT) * U[0],
    Math.cos(TILT) * R[1] + Math.sin(TILT) * U[1],
    Math.cos(TILT) * R[2] + Math.sin(TILT) * U[2],
  ]);
  const N = norm(cross(F, T));

  /* across: signed angular distance (radians) from the band's centre line.
     along: angle (radians) along the band, 0 directly behind the orb. */
  function coords(x, y, z) {
    const n = x * N[0] + y * N[1] + z * N[2];
    const across = Math.asin(Math.max(-1, Math.min(1, n)));
    const along = Math.atan2(x * T[0] + y * T[1] + z * T[2], x * F[0] + y * F[1] + z * F[2]);
    return { across, along };
  }

  const api = { coords, normal: N, forward: F, tangent: T };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SkyBand = api;
})(typeof self !== "undefined" ? self : this);
