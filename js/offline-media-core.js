(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.OfflineMediaCore = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  function parseRangeHeader(header, size) {
    if (!header || !Number.isFinite(size) || size <= 0) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!match) return null;

    const [, rawStart, rawEnd] = match;
    if (!rawStart && !rawEnd) return null;

    if (!rawStart) {
      const suffixLength = Number(rawEnd);
      if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
      return { start: Math.max(0, size - suffixLength), end: size - 1 };
    }

    const start = Number(rawStart);
    const end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) return null;
    return { start, end };
  }

  return { parseRangeHeader };
});
