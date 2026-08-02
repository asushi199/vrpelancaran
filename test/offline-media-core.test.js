const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const corePath = path.join(__dirname, "..", "js", "offline-media-core.js");
const core = fs.existsSync(corePath) ? require(corePath) : {};

test("exposes a byte-range parser for cached MP4 playback", () => {
  assert.equal(typeof core.parseRangeHeader, "function");
});

test("parses an explicit MP4 byte range", () => {
  assert.deepEqual(core.parseRangeHeader("bytes=100-199", 1000), {
    start: 100,
    end: 199,
  });
});

test("parses a suffix byte range", () => {
  assert.deepEqual(core.parseRangeHeader("bytes=-128", 1000), {
    start: 872,
    end: 999,
  });
});

test("rejects a range outside the cached file", () => {
  assert.equal(core.parseRangeHeader("bytes=1000-", 1000), null);
});
